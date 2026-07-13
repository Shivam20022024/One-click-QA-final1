import React, { useState, useRef, useEffect } from "react";
import { PlayCircle, Globe, Smartphone, RefreshCw } from "lucide-react";
import { api, API_BASE } from "../../utils/api";
import { io } from "socket.io-client";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

export default function Execution() {
  const { activeProject, activeSuite, activeCase } = useData();
  const { triggerToast } = useToast();

  const [execTestName, setExecTestName] = useState(activeCase?.name || "Interactive Checkout Verification");
  const [execUrl, setExecUrl] = useState("");
  const [execBrowsers, setExecBrowsers] = useState(["chromium", "firefox"]);
  const [execDevices, setExecDevices] = useState(["Desktop"]);
  const [execSteps, setExecSteps] = useState(
    activeCase?.steps || []
  );
  const [execStepsStr, setExecStepsStr] = useState(JSON.stringify(execSteps, null, 2));
  
  const [execRunning, setExecRunning] = useState(false);
  const [activeExecutionIds, setActiveExecutionIds] = useState([]);
  const [execResults, setExecResults] = useState(null);
  const [execSummary, setExecSummary] = useState({ total: 0, passed: 0, failed: 0, durationMs: 0 });
  
  const [liveStreamStatus, setLiveStreamStatus] = useState("disconnected");
  const [liveStreamFrames, setLiveStreamFrames] = useState({});
  const [activeStreamSource, setActiveStreamSource] = useState(null);
  const [liveStreamEvents, setLiveStreamEvents] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    if (activeCase) {
      setExecTestName(activeCase.name);
      setExecSteps(activeCase.steps || []);
      setExecStepsStr(JSON.stringify(activeCase.steps || [], null, 2));
    }
  }, [activeCase]);

  // Handle autonomous navigation state
  const location = window.location;
  useEffect(() => {
    // If we're using react-router-dom we should use useLocation, but let's try reading history state
    const state = window.history.state?.usr;
    if (state?.executionIds && state?.autonomous) {
       setExecSummary({ total: state.executionIds.length, passed: 0, failed: 0, durationMs: 0 });
       setActiveExecutionIds(state.executionIds);
       connectLiveWebSocket(state.executionIds);
       setExecRunning(true);
       
       // Clear state so it doesn't re-trigger on refresh
       window.history.replaceState({}, '');
    }
  }, []);

  const connectLiveWebSocket = (executionIds) => {
    if (!executionIds || executionIds.length === 0) return;
    wsRef.current?.disconnect();
    setLiveStreamStatus("connecting");
    setLiveStreamEvents([]);
    setLiveStreamFrames({});
    setActiveStreamSource(null);

    const socket = io(API_BASE);
    wsRef.current = socket;

    socket.on("connect", () => {
      setLiveStreamStatus("live");
      executionIds.forEach(id => {
        socket.emit("subscribe", id);
        // Fix for exact blocker: race condition where fast executions complete before socket connects
        api.getRunDetails(id).then(run => {
          if (run && (run.status === 'PASSED' || run.status === 'FAILED' || run.status === 'COMPLETED' || run.status === 'BLOCKED')) {
            setExecResults(prev => prev ? prev.map(r => r.executionId === id ? { ...r, status: run.status, durationMs: run.durationMs } : r) : null);
            setExecSummary(prev => {
              const passed = (run.status === 'PASSED' || run.status === 'COMPLETED') ? prev.passed + 1 : prev.passed;
              const failed = (run.status === 'FAILED' || run.status === 'BLOCKED') ? prev.failed + 1 : prev.failed;
              const durationMs = prev.durationMs + (run.durationMs || 0);
              if (passed + failed >= prev.total) {
                 setExecRunning(false);
              }
              return { ...prev, passed, failed, durationMs };
            });
          }
        }).catch(() => {});
      });
    });

    socket.on("disconnect", () => {
      setLiveStreamStatus("disconnected");
      setExecRunning(false);
    });
    socket.on("connect_error", () => {
      setLiveStreamStatus("error");
      setExecRunning(false);
    });

    const handleEvent = (type) => (data) => {
      // Check if it's a screenshot event
      if (type === "screenshot_uploaded" && data.url) {
        setLiveStreamFrames((prev) => ({
          ...prev,
          [data.executionId || "screenshot"]: data.url,
        }));
        setActiveStreamSource((prev) => prev ? prev : (data.executionId || "screenshot"));
      }
      
      setLiveStreamEvents((prev) => [
        { type, message: data.message || JSON.stringify(data), time: new Date() },
        ...prev
      ].slice(0, 100));
    };

    socket.on("queued", handleEvent("queued"));
    socket.on("running", handleEvent("running"));
    socket.on("browser_log", handleEvent("browser_log"));
    socket.on("agent_progress", handleEvent("agent_progress"));
    socket.on("screenshot_uploaded", handleEvent("screenshot_uploaded"));
    socket.on("live_frame", (data) => {
      if (data.frame && data.executionId) {
        setLiveStreamFrames((prev) => ({
          ...prev,
          [data.executionId]: `data:image/jpeg;base64,${data.frame}`
        }));
        setActiveStreamSource((prev) => prev ? prev : data.executionId);
      }
    });

    socket.on("execution_completed", (data) => {
      handleEvent("execution_completed")(data);
      
      // Update summary
      setExecSummary(prev => {
         const passed = (data.status === 'PASSED' || data.status === 'COMPLETED') ? prev.passed + 1 : prev.passed;
         const failed = (data.status === 'FAILED' || data.status === 'BLOCKED') ? prev.failed + 1 : prev.failed;
         const durationMs = prev.durationMs + (data.durationMs || 0);
         
         if (passed + failed >= prev.total) {
            setExecRunning(false);
         }
         
         return { ...prev, passed, failed, durationMs };
      });

      // Fetch details to retrieve the video URL and final state
      executionIds.forEach(id => {
        api.getRunDetails(id).then(run => {
           if (run) {
             setExecResults(prev => prev ? prev.map(r => r.executionId === id ? { ...r, status: run.status, durationMs: run.durationMs } : r) : null);
           }
           if (run && run.videos && run.videos.length > 0) {
             setLiveStreamFrames((prev) => ({
               ...prev,
               [id]: run.videos[0].url
             }));
             setActiveStreamSource(id);
           }
        }).catch(() => {});
      });
    });
  };

  const handleExecuteMultiPlatformTest = async () => {
    if (!activeProject) {
      triggerToast("Please select a Project first.", true);
      return;
    }
    setExecRunning(true);
    setExecResults(null);
    setLiveStreamFrames({});
    setActiveExecutionIds([]);
    setActiveStreamSource(null);
    setLiveStreamEvents([]);
    
    try {
      const payload = {
        test_name: execTestName,
        base_url: execUrl,
        steps: execSteps,
        browsers: execBrowsers,
        devices: execDevices,
        environment: "Production",
        project_id: activeProject.id,
        suite_id: activeSuite?.id || null,
        test_case_id: activeCase?.id || null,
      };

      const results = await api.runMultiTest(payload);
      
      if (results.executionIds && results.executionIds.length > 0) {
        const initialResults = results.executionIds.map((id, index) => ({ 
          executionId: id, 
          browser: execBrowsers[index] || 'unknown',
          status: 'QUEUED', 
          durationMs: 0 
        }));
        setExecResults(initialResults);
        
        setExecSummary({ total: results.executionIds.length, passed: 0, failed: 0, durationMs: 0 });
        setActiveExecutionIds(results.executionIds);
        connectLiveWebSocket(results.executionIds);
      }
      
      triggerToast("Parallel cross-platform run queued successfully.");
    } catch (err) {
      triggerToast("Execution failed: " + err.message, true);
      setExecRunning(false);
    }
  };

  const handleStopExecution = async () => {
    try {
      await Promise.all(activeExecutionIds.map(id => 
        fetch(`${API_BASE}/api/v1/executions/${id}/cancel`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      ));
      setExecRunning(false);
      triggerToast("Execution stopped.", false);
    } catch(err) {
      triggerToast("Failed to stop execution", true);
    }
  };

  const toggleBrowser = (browser) => {
    setExecBrowsers((prev) => 
      prev.includes(browser) ? prev.filter((b) => b !== browser) : [...prev, browser]
    );
  };

  const toggleDevice = (device) => {
    setExecDevices((prev) => 
      prev.includes(device) ? prev.filter((d) => d !== device) : [...prev, device]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold dark:text-white text-gray-900 tracking-tight">Parallel Execution Runner</h2>
        <p className="dark:text-slate-400 text-gray-600 text-sm">Run test cases concurrently across multiple browsers and devices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-6 dark:bg-slate-900/40 bg-white/85 dark:border-white/5 border-indigo-100 border">
          <h3 className="text-lg font-bold dark:text-white text-gray-900 flex items-center gap-2 border-b dark:border-white/5 border-gray-200 pb-3">
            <PlayCircle className="w-5 h-5 text-indigo-400" /> Run Configuration
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Execution Name</label>
              <input
                type="text"
                value={execTestName}
                onChange={(e) => setExecTestName(e.target.value)}
                className="w-full px-3 py-2 text-sm glass-input rounded-xl dark:text-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
              />
            </div>
            
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Target Base URL</label>
              <input
                type="url"
                value={execUrl}
                onChange={(e) => setExecUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm glass-input rounded-xl dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
              />
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Execution Steps (JSON Array)</label>
              <textarea
                value={execStepsStr}
                onChange={(e) => {
                  setExecStepsStr(e.target.value);
                  try {
                    setExecSteps(JSON.parse(e.target.value));
                  } catch(err) {
                    // Ignore parsing errors while typing
                  }
                }}
                rows={6}
                className="w-full px-3 py-2 text-[10px] font-mono glass-input rounded-xl dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all duration-150"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Browser Engines</label>
                <div className="flex flex-wrap gap-2">
                  {["chromium", "firefox", "webkit", "edge"].map((b) => (
                    <button
                      key={b}
                      onClick={() => toggleBrowser(b)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition ${
                        execBrowsers.includes(b)
                          ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                          : "dark:bg-slate-800 bg-gray-100 border-white/10 dark:text-slate-400 text-gray-600 hover:text-indigo-500"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold mb-2" style={{color:"var(--text-secondary)"}}>
                  Device Emulation
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Windows",  value: "Desktop"   },
                    { label: "iOS",      value: "iPhone 13" },
                    { label: "Android",  value: "Pixel 5"   },
                  ].map((d) => (
                    <button
                      key={d.value}
                      onClick={() => toggleDevice(d.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all duration-150 ${
                        execDevices.includes(d.value)
                          ? "bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-200 dark:shadow-cyan-900/40"
                          : "bg-white dark:bg-slate-800 border-gray-300 dark:border-white/10 text-gray-900 dark:text-slate-300 hover:border-cyan-300 dark:hover:border-cyan-500/40"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleExecuteMultiPlatformTest}
              disabled={execRunning || execBrowsers.length === 0 || execDevices.length === 0}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition"
            >
              {execRunning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
              {execRunning ? "Executing Distributed Run..." : "Launch Parallel Execution"}
            </button>
            
            {execRunning && (
              <button
                onClick={handleStopExecution}
                className="px-6 py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/50 rounded-xl font-bold flex justify-center items-center transition"
              >
                STOP
              </button>
            )}
          </div>
        </div>

        {/* Live Tracking Panel */}
        <div className="rounded-2xl shadow-xl overflow-hidden border"
          style={{ background: "var(--bg-panel)", borderColor: "var(--border-subtle)" }}>
          <div className="px-6 py-4 flex justify-between items-center"
            style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-panel-hover)" }}>
            <h3 className="text-lg font-bold flex items-center gap-2.5" style={{ color: "var(--text-primary)" }}>
              <Globe className="w-5 h-5 text-indigo-500" /> Live Stream Telemetry
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
              liveStreamStatus === "live"
                ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30"
                : liveStreamStatus === "connecting"
                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
            }`}>
              {liveStreamStatus === "live" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
              {liveStreamStatus}
            </span>
          </div>

          <div className="p-6 flex flex-col gap-5">
            {/* Main Video View */}
            <div className="rounded-2xl overflow-hidden relative aspect-video flex items-center justify-center border"
              style={{
                background: "linear-gradient(135deg, #eef2ff 0%, #e0f2fe 50%, #f0fdf4 100%)",
                borderColor: "rgba(99,102,241,0.15)",
              }}>
              <div className="absolute inset-0 dark:block hidden" style={{ background: "linear-gradient(135deg,rgba(30,27,75,0.7)0%,rgba(7,89,133,0.5)50%,rgba(6,78,59,0.4)100%)" }} />
              {activeStreamSource && liveStreamFrames[activeStreamSource] ? (
                liveStreamFrames[activeStreamSource].endsWith(".mp4") ? (
                  <video src={liveStreamFrames[activeStreamSource]} controls autoPlay muted className="w-full h-full object-contain relative z-10" />
                ) : (
                  <img src={liveStreamFrames[activeStreamSource]} alt="Execution Artifact" className="w-full h-full object-contain relative z-10" />
                )
              ) : (
                <div className="text-center p-8 flex flex-col items-center gap-4 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800/80 shadow-lg flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
                    <PlayCircle className="w-8 h-8 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-indigo-700 dark:text-indigo-300">Monitoring Station Ready</p>
                    <p className="text-sm font-medium mt-1 text-indigo-500 dark:text-indigo-400">Live frames and video will appear here during execution.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Source Selector */}
            {Object.keys(liveStreamFrames).length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Object.keys(liveStreamFrames).map((source) => (
                  <button
                    key={source}
                    onClick={() => setActiveStreamSource(source)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold font-mono transition-all whitespace-nowrap border ${
                      activeStreamSource === source
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-300 border-gray-200 dark:border-white/10 hover:border-indigo-300"
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            )}

            {/* Live Event Feed */}
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="px-4 py-3 flex items-center justify-between"
                style={{ background: "var(--bg-panel-hover)", borderBottom: "1px solid var(--border-subtle)" }}>
                <span className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Live Event Feed
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                  {liveStreamEvents.length} events
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y" style={{ divideColor: "var(--border-subtle)" }}>
                {liveStreamEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Smartphone className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Waiting for telemetry events...</p>
                  </div>
                ) : (
                  liveStreamEvents.map((evt, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors">
                      <span className={`mt-0.5 text-lg leading-none ${
                        evt.type === "error" ? "text-rose-500"
                        : evt.type === "execution_completed" ? "text-emerald-500"
                        : evt.type === "browser_log" ? "text-slate-400"
                        : "text-indigo-500"
                      }`}>
                        {evt.type === "error" ? "🔴" : evt.type === "execution_completed" ? "✅" : evt.type === "browser_log" ? "📋" : "⚡"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-black uppercase tracking-wider ${
                            evt.type === "error" ? "text-rose-600 dark:text-rose-400"
                            : evt.type === "execution_completed" ? "text-emerald-600 dark:text-emerald-400"
                            : "text-indigo-600 dark:text-indigo-400"
                          }`}>[{evt.type}]</span>
                          <time className="text-xs font-semibold shrink-0" style={{ color: "var(--text-muted)" }}>
                            {evt.time?.toLocaleTimeString()}
                          </time>
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>
                          {evt.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      {execResults && (
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4 dark:bg-emerald-900/10 bg-emerald-50/80 dark:border-emerald-500/20 border-emerald-200 border">
          <h3 className="text-lg font-bold dark:text-white text-gray-900 flex items-center gap-2">
            Execution Results Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
             <div>
               <span className="block text-slate-400 text-xs mb-1">Total Executions</span>
               <span className="font-bold dark:text-white text-gray-900">{execSummary.total}</span>
             </div>
             <div>
               <span className="block text-slate-400 text-xs mb-1">Passed</span>
               <span className="font-bold text-emerald-400">{execSummary.passed}</span>
             </div>
             <div>
               <span className="block text-slate-400 text-xs mb-1">Failed</span>
               <span className="font-bold text-rose-400">{execSummary.failed}</span>
             </div>
             <div>
               <span className="block text-slate-400 text-xs mb-1">Duration</span>
               <span className="font-bold text-white">{(execSummary.durationMs / 1000).toFixed(2)}s</span>
             </div>
          </div>
          
          <div className="mt-6 border-t border-white/5 pt-4">
            <h4 className="text-sm font-bold text-white mb-3">Execution Matrix</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-800/50 text-slate-400">
                  <tr>
                    <th className="px-4 py-2 rounded-tl-lg">Browser</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Duration</th>
                    <th className="px-4 py-2 rounded-tr-lg">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {execResults.map(res => (
                    <tr key={res.executionId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium capitalize flex items-center gap-2">
                        {res.browser === 'chromium' && <Globe className="w-4 h-4 text-blue-400" />}
                        {res.browser === 'firefox' && <Globe className="w-4 h-4 text-orange-400" />}
                        {res.browser === 'webkit' && <Globe className="w-4 h-4 text-blue-300" />}
                        {(res.browser === 'edge' || res.browser === 'msedge') && <Globe className="w-4 h-4 text-cyan-400" />}
                        {res.browser}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          res.status === 'PASSED' ? 'bg-emerald-500/20 text-emerald-400' :
                          res.status === 'FAILED' ? 'bg-rose-500/20 text-rose-400' :
                          res.status === 'RUNNING' ? 'bg-indigo-500/20 text-indigo-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {(res.durationMs / 1000).toFixed(2)}s
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/reports/${res.executionId}`} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">View Report</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
