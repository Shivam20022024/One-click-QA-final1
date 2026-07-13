import React, { useState, useEffect } from "react";
import { Link as LinkIcon, RefreshCw, Globe, Save, Download, PlayCircle, Cpu } from "lucide-react";
import { api } from "../../utils/api";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

export default function AutonomousQA() {
  const { activeProject, loadTestCases } = useData();
  const { triggerToast } = useToast();

  const [targetUrl, setTargetUrl] = useState("");
  const [crawlStatus, setCrawlStatus] = useState("idle"); // idle, crawling, analyzing, complete
  const [discoveredFlows, setDiscoveredFlows] = useState([]);
  const [selectedFlows, setSelectedFlows] = useState({});

  useEffect(() => {
    if (activeProject) {
      loadExistingFlows();
    }
  }, [activeProject]);

  const loadExistingFlows = async () => {
    try {
      const data = await api.getDiscoveredFlows(activeProject.id);
      if (data && data.length > 0) {
        setDiscoveredFlows(data);
        setCrawlStatus("complete");
      } else {
        setDiscoveredFlows([]);
        setCrawlStatus("idle");
      }
    } catch (err) {
      console.error("Failed to load existing flows", err);
    }
  };

  const startAutonomousDiscovery = async () => {
    if (!activeProject) {
      triggerToast("Please select an active project first.", true);
      return;
    }
    if (!targetUrl) {
      triggerToast("Target URL is required.", true);
      return;
    }

    try {
      setCrawlStatus("crawling");
      await api.crawlWebsite(activeProject.id, targetUrl, 1); // Depth 1 for speed
      
      triggerToast("Crawling complete. Analyzing data...");
      setCrawlStatus("analyzing");
      
      const flows = await api.generateAutonomousFlows(activeProject.id, targetUrl);
      setDiscoveredFlows(flows);
      triggerToast(`AI generated ${flows.length} flows!`);
      setCrawlStatus("complete");
    } catch (err) {
      triggerToast("Autonomous Discovery Failed: " + err.message, true);
      setCrawlStatus("idle");
    }
  };

  const handleDownloadSpec = async (flow) => {
    try {
      const data = await api.generatePlaywrightCode(flow.name, targetUrl, flow.generated_steps);
      const blob = new Blob([data.code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${flow.name.replace(/\s+/g, '_').toLowerCase()}.spec.ts`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      triggerToast("Failed to generate code: " + err.message, true);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold dark:text-white text-gray-900 tracking-tight flex items-center gap-2">
          <Cpu className="text-violet-400 w-8 h-8" />
          Autonomous AI QA
        </h2>
        <p className="dark:text-slate-400 text-gray-600 text-sm mt-1">One-Click spidering, analysis, and execution generation.</p>
      </div>

      {!activeProject && (
        <div className="dark:bg-amber-500/10 bg-amber-50 dark:border-amber-500/20 border-amber-200 border dark:text-amber-400 text-amber-700 p-4 rounded-xl text-sm font-semibold">
          Please select a Project from the top navigation dropdown to begin.
        </div>
      )}

      {activeProject && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 glass-panel p-6 rounded-2xl shadow-xl space-y-5 dark:bg-slate-900/40 bg-white/85 dark:border-white/5 border-indigo-100 border">
            <h3 className="text-lg font-bold dark:text-white text-gray-900 flex items-center gap-2 border-b dark:border-white/5 border-gray-200 pb-3">
              <Globe className="w-5 h-5 text-indigo-400" /> Discovery Engine
            </h3>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Target Web Application URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://app.example.com"
                  className="w-full pl-10 pr-4 py-2 text-sm glass-input rounded-xl dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
                />
              </div>
            </div>

            <button
              onClick={startAutonomousDiscovery}
              disabled={crawlStatus === "crawling" || crawlStatus === "analyzing"}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-violet-600/20 disabled:opacity-50 transition"
            >
              {crawlStatus === "idle" || crawlStatus === "complete" ? (
                <>
                  <Cpu className="w-5 h-5" /> Start Auto-Discovery
                </>
              ) : crawlStatus === "crawling" ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" /> Spidering Pages...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" /> AI Analyzing Data...
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl shadow-xl dark:bg-slate-900/40 bg-white/85 dark:border-white/5 border-indigo-100 border">
            <h3 className="text-lg font-bold dark:text-white text-gray-900 flex items-center gap-2 border-b dark:border-white/5 border-gray-200 pb-3 mb-4">
              Generated User Flows
            </h3>

            {discoveredFlows.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-50">
                <Globe className="w-10 h-10" />
                <span>No flows discovered yet. Run the discovery engine.</span>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {discoveredFlows.map((flow) => (
                  <div key={flow.id} className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-white font-bold">{flow.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">{flow.description}</p>
                      </div>
                      <span className="px-2 py-1 bg-violet-500/20 text-violet-300 text-[10px] font-bold rounded-lg uppercase">
                        {flow.flow_type}
                      </span>
                    </div>

                    <div className="bg-slate-900 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-500 mb-2">GENERATED STEPS ({flow.generated_steps?.length || 0})</p>
                      <ul className="space-y-1">
                        {flow.generated_steps?.slice(0, 3).map((s, i) => (
                          <li key={i} className="text-xs text-slate-300 font-mono flex gap-2">
                            <span className="text-emerald-400">{s.action}</span>
                            <span className="text-slate-500 truncate">{s.selector || s.value}</span>
                          </li>
                        ))}
                        {flow.generated_steps?.length > 3 && (
                          <li className="text-xs text-slate-500 italic mt-1">...and {flow.generated_steps.length - 3} more steps</li>
                        )}
                      </ul>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => handleDownloadSpec(flow)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Export .spec.ts
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
