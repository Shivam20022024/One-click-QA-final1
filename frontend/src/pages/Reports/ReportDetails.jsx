import React, { useState, useEffect, useRef, Component } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowRight, Video, FileText, Image, AlertTriangle, CheckCircle2, XCircle, Copy, Eye, Shield, ShieldAlert, Download, Globe, Bug } from "lucide-react";
import { api } from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

class ReportErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 text-center bg-rose-950/20 border border-rose-500/30 rounded-2xl">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-rose-400 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 mb-4">The report failed to render. The execution data may be corrupted.</p>
          <pre className="text-[10px] text-rose-300 bg-rose-950 p-4 rounded text-left overflow-auto max-w-2xl mx-auto">
            {this.state.error?.message || "Unknown error"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}


function TranscriptPanel({ transcriptEvents, videoRef }) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  if (!transcriptEvents || transcriptEvents.length === 0) return null;

  const scenarios = Array.from(new Set(transcriptEvents.map(e => e.scenarioName).filter(Boolean)));

  const filtered = transcriptEvents.filter(ev => {
    if (filter === 'ERRORS' && ev.status !== 'ERROR' && ev.status !== 'FAILED') return false;
    if (filter !== 'ALL' && filter !== 'ERRORS' && ev.scenarioName !== filter) return false;
    
    if (search) {
       const q = search.toLowerCase();
       if (!ev.action.toLowerCase().includes(q) && !(ev.target || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleScrub = (timestamp) => {
    if (!videoRef.current || !timestamp) return;
    const parts = timestamp.split(':');
    if (parts.length === 2) {
      const secs = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      videoRef.current.currentTime = secs;
      videoRef.current.play().catch(() => {});
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'ERROR' || status === 'FAILED')
      return { card: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/30', ts: 'text-rose-600 dark:text-rose-400', badge: 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30', action: 'text-rose-900 dark:text-rose-100', icon: '🔴' };
    if (status === 'WARNING')
      return { card: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30', ts: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30', action: 'text-amber-900 dark:text-amber-100', icon: '🟡' };
    if (status === 'INFO')
      return { card: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-500/30', ts: 'text-sky-600 dark:text-sky-400', badge: 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/30', action: 'text-sky-900 dark:text-sky-100', icon: 'ℹ️' };
    return { card: 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-500/25', ts: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30', action: 'text-emerald-900 dark:text-emerald-50', icon: '✅' };
  };

  return (
    <div className="rounded-2xl shadow-xl overflow-hidden flex flex-col h-[540px] border"
      style={{ background: "var(--bg-panel)", borderColor: "var(--border-subtle)" }}>
      {/* Header */}
      <div className="px-5 py-4 flex flex-col gap-3"
        style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-panel-hover)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <FileText className="w-5 h-5 text-indigo-500" /> Execution Transcript
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
            {filtered.length} events
          </span>
        </div>
        <div className="flex gap-2">
          <select
            className="text-sm font-semibold rounded-lg px-3 py-1.5 border outline-none transition"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-input)", color: "var(--text-primary)" }}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="ALL">All Events</option>
            <option value="ERRORS">Errors Only</option>
            {scenarios.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="text"
            placeholder="Search actions..."
            className="flex-1 text-sm font-medium rounded-lg px-3 py-1.5 border outline-none transition"
            style={{ background: "var(--bg-input)", borderColor: "var(--border-input)", color: "var(--text-primary)" }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No events match your filter.</p>
          </div>
        ) : (
          filtered.map((ev, i) => {
            const s = getStatusStyle(ev.status);
            return (
              <div
                key={i}
                onClick={() => handleScrub(ev.timestamp)}
                className={`transcript-item ${s.card} rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{s.icon}</span>
                    <span className={`text-[15px] font-bold ${s.action}`}>
                      {ev.action.toUpperCase()}
                      {ev.target && <span className="font-medium opacity-75 ml-1">→ {ev.target}</span>}
                    </span>
                  </div>
                  <span className={`shrink-0 text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${s.badge}`}>
                    {ev.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    {ev.scenarioName && <span className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>Scenario: {ev.scenarioName}</span>}
                    {ev.value && <span className={`text-[13px] font-mono font-semibold ${s.ts} truncate max-w-xs`}>Value: {ev.value}</span>}
                  </div>
                  <span className={`font-mono text-[13px] font-bold ${s.ts}`}>{ev.timestamp}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function TraceModal({ isOpen, onClose, runId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.getExecutionTrace(runId).then(setData).catch(e => console.error(e)).finally(() => setLoading(false));
  }, [isOpen, runId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-400" /> Execution Trace</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400 animate-pulse">Loading trace data...</div>
          ) : !data || !data.traceEvents?.length ? (
            <div className="text-center py-12 text-slate-500">No trace events available.</div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
              {data.traceEvents.map((ev, i) => (
                <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-slate-900 text-slate-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow flex-col">
                    {(ev.status === 'PASSED' || ev.status === 'COMPLETED') ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/10 bg-slate-950/50 hover:bg-slate-900/80 transition-colors shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-indigo-300 text-sm">{ev.action}</span>
                      <time className="text-[10px] font-mono text-slate-500">{new Date(ev.time).toLocaleTimeString()}</time>
                    </div>
                    {ev.details && <div className="text-xs text-slate-300 mb-2">{ev.details}</div>}
                    {ev.value && <div className="text-[10px] text-cyan-400 bg-slate-900 px-2 py-1 rounded w-fit break-all">Value: {ev.value}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanModal({ isOpen, onClose, runId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.getExecutionPlan(runId).then(setData).catch(e => console.error(e)).finally(() => setLoading(false));
  }, [isOpen, runId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Video className="w-5 h-5 text-violet-400" /> Execution Plan Breakdown</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400 animate-pulse">Loading execution plan...</div>
          ) : !data || !data.plan ? (
            <div className="text-center py-12 text-slate-500">No execution plan available.</div>
          ) : (
            <>
              {data.plan.requested_count !== undefined && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-950/50 border border-white/5 rounded-xl text-center">
                    <div className="text-2xl font-bold text-white">{data.plan.requested_count}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Requested Scenarios</div>
                  </div>
                  <div className="p-4 bg-slate-950/50 border border-white/5 rounded-xl text-center">
                    <div className="text-2xl font-bold text-indigo-400">{data.plan.testCases?.length || 0}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest mt-1">Parsed Cases</div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">Generated Script</h3>
                <pre className="text-[10px] text-slate-300 font-mono bg-slate-950 p-4 rounded-xl border border-white/5 overflow-x-auto whitespace-pre-wrap">
                  {data.plan.scriptCode ? (() => {
                     try { return JSON.stringify(JSON.parse(data.plan.scriptCode), null, 2); } catch { return data.plan.scriptCode; }
                  })() : "No script generated"}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportDetailsContent() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { triggerToast } = useToast();
  
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const transcriptEvents = (() => {
      let events = selectedRun?.execution_result?.transcript;
      try {
          if (!events || events.length === 0) {
              const safeLogs = typeof selectedRun?.stepLogs === 'string' ? JSON.parse(selectedRun.stepLogs) : (selectedRun?.stepLogs || []);
              const resLog = safeLogs.find(s => s.action === 'EXECUTION_RESULT');
              if (resLog && resLog.value) {
                  events = JSON.parse(resLog.value).transcript;
              }
              if (!events || events.length === 0) {
                  events = safeLogs.map(s => ({
                      scenarioName: s.action === 'HEAL' ? 'Self Healing Agent' : (selectedRun?.suite?.name || 'Global Execution'),
                      action: s.action || 'Unknown Action',
                      target: s.target || null,
                      value: s.error || s.value || null,
                      status: s.status || 'UNKNOWN',
                      timestamp: s.time ? new Date(s.time).toLocaleTimeString() : new Date().toLocaleTimeString()
                  }));
              }
          }
      } catch (e) {}
      return events || [];
  })();

  const videoRef = useRef(null);

  useEffect(() => {
    let intervalId;
    async function fetchDetails() {
      try {
        const runDetails = await api.getRunDetails(runId);
        setSelectedRun(runDetails);
        
        if (runDetails && ['QUEUED', 'RUNNING', 'HEALING', 'GENERATING_SCRIPT'].includes(runDetails.status)) {
           intervalId = setTimeout(fetchDetails, 3000);
        } else if (runDetails?.reports?.length > 0 && runDetails.reports[0].url.endsWith('.json') && !aiReport) {
           try {
             const res = await fetch(runDetails.reports[0].url);
             const data = await res.json();
             setAiReport(data);
           } catch(e) {
             console.error("Failed to fetch AI report JSON", e);
           }
        }
      } catch (err) {
        triggerToast("Failed to fetch report details: " + err.message, true);
        navigate("/");
      } finally {
        setLoading(false);
      }
    }
    fetchDetails();
    return () => clearTimeout(intervalId);
  }, [runId, navigate, triggerToast]);

  const handleScrubToStep = (step) => {
    if (!videoRef.current || !selectedRun || !selectedRun.stepLogs) return;
    try {
      const firstStep = selectedRun.stepLogs[0];
      if (!firstStep?.time || !step.time) return;
      const baseTime = new Date(firstStep.time).getTime();
      const stepTime = new Date(step.time).getTime();
      const diffMs = stepTime - baseTime;
      const scrubTime = Math.max(0, (diffMs / 1000) + 0.5);
      videoRef.current.currentTime = scrubTime;
      videoRef.current.play().catch(() => {});
    } catch (e) {}
  };

  const handleDownloadReport = async () => {
    if (!selectedRun) return;

    triggerToast("Generating professional PDF report...", false);
    const doc = new jsPDF();
    let currentY = 15;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;

    const addTitle = (title, color = [40, 40, 40]) => {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(color[0], color[1], color[2]);
      if (currentY > 270) { doc.addPage(); currentY = 15; }
      doc.text(title, margin, currentY);
      currentY += 8;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
    };

    const addText = (text, indent = 0, color = [80, 80, 80], isBold = false) => {
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const splitText = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
      if (currentY + (splitText.length * 5) > 280) { doc.addPage(); currentY = 15; }
      doc.text(splitText, margin + indent, currentY);
      currentY += (splitText.length * 5) + 2;
    };

    let safeStepLogs = [];
    try { safeStepLogs = typeof selectedRun.stepLogs === 'string' ? JSON.parse(selectedRun.stepLogs) : (selectedRun.stepLogs || []); } catch (e) {}
    
    let transcriptEvents = [];
    try {
        const resLog = safeStepLogs.find(s => s.action === 'EXECUTION_RESULT');
        if (resLog && resLog.value) transcriptEvents = JSON.parse(resLog.value).transcript || [];
    } catch (e) {}

    if (transcriptEvents.length === 0) {
       transcriptEvents = safeStepLogs.map(s => ({
          scenarioName: s.action === 'HEAL' ? 'Self Healing Agent' : (selectedRun.suite?.name || 'Global Execution'),
          action: s.action || 'Unknown Action',
          target: s.target || null,
          value: s.error || s.value || null,
          status: s.status || 'UNKNOWN'
       }));
    }

    const scenarioMap = {};
    transcriptEvents.forEach(ev => {
       const sName = ev.scenarioName || selectedRun.suite?.name || 'Global Execution';
       if (!scenarioMap[sName]) scenarioMap[sName] = { passed: 0, failed: 0, events: [] };
       scenarioMap[sName].events.push(ev);
       if (ev.status === 'ERROR' || ev.status === 'FAILED') scenarioMap[sName].failed++;
       else if (ev.status === 'PASSED' || ev.status === 'COMPLETED') scenarioMap[sName].passed++;
    });

    const pageHealthMatrix = Object.entries(scenarioMap).map(([scenario, data]) => {
       const status = data.failed > 0 ? "FAIL" : "PASS";
       const total = data.passed + data.failed;
       const score = total > 0 ? Math.round((data.passed / total) * 100) : 100;
       return [scenario, status, data.passed, data.failed, `${score}%`];
    });

    const totalScenarios = pageHealthMatrix.length || 1;
    const passedScenariosCount = pageHealthMatrix.filter(r => r[1] === "PASS").length;
    const failedScenariosCount = pageHealthMatrix.filter(r => r[1] === "FAIL").length;
    
    const accessibility = selectedRun.execution_result?.accessibility;
    const a11yIssues = accessibility?.success === false ? (accessibility.violations || []) : [];
    
    const a11yStepFailed = safeStepLogs.some(s => s.status === 'FAILED' && (s.action?.toLowerCase().includes('access') || (s.error || '').toLowerCase().includes('accessibility')));
    
    let a11yScanStatus = "Success";
    let a11yCompliance = a11yIssues.length === 0 ? "Compliant" : "Non-Compliant";
    let a11yReason = "Accessibility automated scan completed successfully.";
    
    if (a11yStepFailed || accessibility?.error) {
        a11yScanStatus = "Partial Failure";
        a11yCompliance = "Unable to Verify";
        a11yReason = "Accessibility validation step failed during execution.";
    }

    const funcHealth = totalScenarios > 0 ? Math.round((passedScenariosCount / totalScenarios) * 100) : 100;
    const a11yScore = a11yScanStatus === "Partial Failure" ? 0 : Math.max(0, 100 - (a11yIssues.length * 5));
    const secScore = 100; 
    const healthScore = Math.round((funcHealth * 0.7) + (a11yScore * 0.2) + (secScore * 0.1));

    const failedEvents = transcriptEvents.filter(ev => ev.status === 'ERROR' || ev.status === 'FAILED');

    let executionStatus = "READY FOR PRODUCTION";
    if (failedScenariosCount > 0 || a11yIssues.length > 0 || a11yScanStatus === "Partial Failure") {
       if (failedScenariosCount > Math.ceil(totalScenarios / 2) || a11yIssues.length > 10) {
          executionStatus = "BLOCKED";
       } else if (failedScenariosCount > 1) {
          executionStatus = "PARTIALLY READY";
       } else {
          executionStatus = "READY FOR STAGING";
       }
    }

    const classifyIssue = (err, tgt) => {
        const errorMsg = (err || '').toLowerCase();
        const targetStr = (tgt || '').toLowerCase();
        
        let isFramework = errorMsg.includes('locator parsing') || errorMsg.includes('getby') || errorMsg.includes('unexpected token') || errorMsg.includes('engine');
        if (!isFramework && (targetStr.includes('getby') || targetStr.includes('role'))) isFramework = true;
        
        const category = isFramework ? "Framework Issue" : "Website Issue";
        const owner = isFramework ? "Automation Team" : (errorMsg.includes('access') ? "Frontend Team" : "Frontend Team");
        const type = isFramework ? "Locator Parsing Error" : "Element Not Found";
        
        let effort = "10 Minutes";
        if (isFramework) effort = "15 Minutes";
        if (errorMsg.includes('access')) effort = "30 Minutes";
        if (errorMsg.includes('text')) effort = "5 Minutes";
        
        return { type, category, owner, effort };
    };

    const getBusinessImpact = (scenario) => {
        const name = (scenario || '').toLowerCase();
        if (name.includes('login') || name.includes('auth')) return "Users may be unable to authenticate.";
        if (name.includes('checkout')) return "Order completion cannot be verified.";
        if (name.includes('cart')) return "Users cannot add items to cart.";
        if (name.includes('order')) return "Successful purchases cannot be confirmed.";
        return "Core functionality cannot be verified.";
    };

    let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
    failedEvents.forEach(f => {
       const n = (f.scenarioName || '').toLowerCase();
       if (n.includes('login') || n.includes('checkout') || n.includes('order') || executionStatus === "BLOCKED") criticalCount++;
       else highCount++;
    });
    mediumCount = a11yIssues.length;
    lowCount = 0;

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138);
    doc.text("Quality Engineering Report", margin, currentY);
    currentY += 15;

    addTitle("1. EXECUTIVE SUMMARY");
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`Execution Status: ${executionStatus}`, margin, currentY); currentY += 7;
    doc.text(`Overall Health Score: ${healthScore}%`, margin, currentY); currentY += 10;
    
    const healEvents = safeStepLogs.filter(s => s.action === 'HEAL');
    const scoresData = [
      ["Total Scenarios", `${totalScenarios}`],
      ["Passed Scenarios", `${passedScenariosCount}`],
      ["Failed Scenarios", `${failedScenariosCount}`],
      ["Critical Issues", `${failedEvents.length}`],
      ["Accessibility Issues", `${a11yIssues.length}`],
      ["Security Issues", `0`],
      ["Self-Healing Events", `${healEvents.length}`]
    ];
    autoTable(doc, { startY: currentY, body: scoresData, theme: 'plain', styles: { fontSize: 10, fontStyle: 'bold' } });
    currentY = doc.lastAutoTable.finalY + 5;
    
    const conclusion = failedScenariosCount > 0 
       ? `${failedScenariosCount} of ${totalScenarios} scenarios failed. Core business flows are partially functional. Production deployment is not recommended until validation issues are resolved.` 
       : `All ${totalScenarios} scenarios passed. System is fully functional and ready for production deployment.`;
    addText("Conclusion:");
    addText(conclusion, 5, failedScenariosCount > 0 ? [220, 38, 38] : [22, 163, 74], true);
    currentY += 10;

    addTitle("2. DEVELOPER PRIORITY DASHBOARD");
    autoTable(doc, { 
      startY: currentY, 
      head: [["Priority", "Issue Count"]], 
      body: [
          ["Critical", `${criticalCount}`],
          ["High", `${highCount}`],
          ["Medium", `${mediumCount}`],
          ["Low", `${lowCount}`]
      ],
      theme: 'grid',
      didParseCell: function(data) {
          if (data.column.index === 0 && data.cell.text[0] === 'Critical') data.cell.styles.textColor = [220, 38, 38];
          else if (data.column.index === 0 && data.cell.text[0] === 'High') data.cell.styles.textColor = [234, 88, 12];
          else if (data.column.index === 0 && data.cell.text[0] === 'Medium') data.cell.styles.textColor = [234, 179, 8];
          else if (data.column.index === 0 && data.cell.text[0] === 'Low') data.cell.styles.textColor = [59, 130, 246];
      }
    });
    currentY = doc.lastAutoTable.finalY + 10;

    addTitle("3. PAGE HEALTH MATRIX");
    if (pageHealthMatrix.length > 0) {
      autoTable(doc, { 
        startY: currentY, 
        head: [["Scenario", "Status", "Passed", "Failed", "Health Score"]], 
        body: pageHealthMatrix,
        theme: 'grid',
        didParseCell: function(data) {
          if (data.column.index === 1 && data.cell.text[0] === 'FAIL') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
          } else if (data.column.index === 1 && data.cell.text[0] === 'PASS') {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
          }
        }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    }

    addTitle("4. ISSUE CLASSIFICATION MATRIX");
    if (failedEvents.length > 0) {
       const issueMatrixData = failedEvents.map(f => {
           const sc = f.scenarioName || "Global Execution";
           const classification = classifyIssue(f.value || f.error, f.target);
           return [sc, classification.type, classification.category, classification.owner];
       });
       autoTable(doc, { 
         startY: currentY, 
         head: [["Scenario", "Issue Type", "Category", "Owner"]], 
         body: issueMatrixData,
         theme: 'grid',
         styles: { fontSize: 8 }
       });
       currentY = doc.lastAutoTable.finalY + 10;
    } else {
       addText("No issues to classify.");
       currentY += 10;
    }

    addTitle("5. FAILED SELECTOR REPORT");
    if (failedEvents.length > 0) {
      const failedSelectorsData = failedEvents.map(f => [
         f.scenarioName || selectedRun.suite?.name || "Global Execution",
         f.target || "N/A (No selector)",
         f.value || f.error || "Action failed to complete",
         "High - Execution blocked",
         "Review locator generation and DOM mapping logic."
      ]);
      autoTable(doc, { 
        startY: currentY, 
        head: [["Scenario", "Selector", "Failure Message", "Impact", "Recommended Fix"]], 
        body: failedSelectorsData,
        theme: 'grid',
        styles: { fontSize: 8 }
      });
      currentY = doc.lastAutoTable.finalY + 10;
    } else {
      addText("No failed selectors found.");
      currentY += 10;
    }

    addTitle("6. ROOT CAUSE ANALYSIS");
    if (failedEvents.length > 0) {
       const rootCauses = {};
       failedEvents.forEach(f => {
          const key = f.target || f.value || f.action || "Unknown Failure";
          if (!rootCauses[key]) {
              const cls = classifyIssue(f.value || f.error, f.target);
              rootCauses[key] = { count: 0, scenarios: new Set(), target: f.target, error: f.value || f.error, owner: cls.owner, effort: cls.effort };
          }
          rootCauses[key].count++;
          rootCauses[key].scenarios.add(f.scenarioName || selectedRun.suite?.name || "Global Execution");
       });

       let index = 1;
       for (const [key, details] of Object.entries(rootCauses)) {
          addText(`ROOT CAUSE GROUP #${index}`, 0, [220, 38, 38], true);
          addText(`What failed?: Target interaction failed`, 5);
          addText(`Which scenario failed?: ${Array.from(details.scenarios).join(', ')}`, 5);
          addText(`Which selector failed?: ${details.target || 'N/A (No selector specified)'}`, 5);
          addText(`Why did it fail?: ${details.error || 'Timeout or invalid locator'}`, 5);
          addText(`What should the developer fix?: Verify the element exists in DOM and update locator.`, 5);
          addText(`Owner: ${details.owner}`, 5, [0,0,0], true);
          addText(`Estimated Fix Time: ${details.effort}`, 5, [0,0,0], true);
          currentY += 5;
          index++;
       }
    } else {
      addText("No failures recorded. Root cause analysis not applicable.");
      currentY += 10;
    }

    addTitle("7. RELEASE BLOCKERS");
    if (failedScenariosCount > 0 || a11yIssues.length > 0) {
       let blockerIdx = 1;
       const failedScenariosList = pageHealthMatrix.filter(r => r[1] === "FAIL").map(r => r[0]);
       
       failedScenariosList.forEach(scenario => {
          addText(`BLOCKER-${blockerIdx}`, 0, [220, 38, 38], true);
          addText(`${scenario} Failed`, 5, [220, 38, 38]);
          addText(`Severity: Critical`, 5);
          addText(`Business Impact: ${getBusinessImpact(scenario)}`, 5);
          currentY += 5;
          blockerIdx++;
       });
       if (a11yIssues.length > 0 || a11yScanStatus === "Partial Failure") {
          addText(`BLOCKER-${blockerIdx}`, 0, [234, 179, 8], true);
          addText(`Accessibility Validation Failed`, 5, [234, 179, 8]);
          addText(`Severity: Medium`, 5);
          addText(`Business Impact: WCAG Compliance Risk`, 5);
          currentY += 5;
       }
    } else {
       addText("No release blockers identified.");
       currentY += 10;
    }

    addTitle("8. DEVELOPER FIX CHECKLIST");
    if (failedEvents.length > 0 || a11yIssues.length > 0) {
       if (failedEvents.length > 0) {
          addText("HIGH PRIORITY", 0, [220, 38, 38], true);
          const targets = new Set(failedEvents.filter(e => e.target).map(e => e.target));
          if (targets.size > 0) {
              Array.from(targets).forEach(t => addText(`• Fix selector: ${t}`, 5));
          } else {
              failedEvents.filter(e => !e.target).forEach(e => addText(`• Fix step: ${e.action}`, 5));
          }
          currentY += 5;
       }
       if (a11yIssues.length > 0) {
          addText("MEDIUM PRIORITY", 0, [234, 179, 8], true);
          addText(`• Resolve ${a11yIssues.length} accessibility violations`, 5);
          currentY += 5;
       }
       addText("LOW PRIORITY", 0, [59, 130, 246], true);
       addText("• Performance optimization and test stabilization", 5);
       currentY += 10;
    } else {
       addText("No fixes required. All checks passed.");
       currentY += 10;
    }

    addTitle("9. ACCESSIBILITY REPORT");
    addText(`Accessibility Scan Status: ${a11yScanStatus}`, 0, a11yScanStatus === "Success" ? [22, 163, 74] : [234, 179, 8], true);
    if (a11yScanStatus === "Partial Failure") addText(`Reason: ${a11yReason}`, 0);
    addText(`Violations ${a11yScanStatus === "Success" ? "Found" : "Returned"}: ${a11yIssues.length}`, 0, [0,0,0], true);
    addText(`Compliance Status: ${a11yCompliance}`, 0, [0,0,0], true);
    currentY += 5;

    if (a11yIssues.length > 0) {
       const a11yData = a11yIssues.map(v => [
         v.id,
         v.impact || 'Unknown',
         selectedRun.suite?.url || "Current Page",
         v.description || "WCAG violation",
         v.id === 'button-name' ? "Add aria-label attributes." : v.id === 'color-contrast' ? "Increase color contrast." : "Resolve according to WCAG guidelines."
       ]);
       autoTable(doc, { 
         startY: currentY, 
         head: [["Issue", "Severity", "Affected Page", "Impact", "Suggested Fix"]], 
         body: a11yData,
         theme: 'grid',
         styles: { fontSize: 8 },
         didParseCell: function(data) {
           if (data.column.index === 1) {
               if (data.cell.text[0] === 'critical') data.cell.styles.textColor = [220, 38, 38];
               else if (data.cell.text[0] === 'serious') data.cell.styles.textColor = [234, 179, 8];
           }
         }
       });
       currentY = doc.lastAutoTable.finalY + 10;
    } else {
       addText("No accessibility violations detected.");
       currentY += 10;
    }

    addTitle("10. SCREENSHOT EVIDENCE");
    if (selectedRun.screenshots && selectedRun.screenshots.length > 0) {
       for (const shot of selectedRun.screenshots) {
         addText(`Screenshot Title: ${shot.name || "Execution Evidence"}`);
         addText(`Failed Page: ${selectedRun.suite?.url || "Internal App Route"}`);
         addText(`Timestamp: ${new Date(selectedRun.createdAt).toLocaleString()}`);
         addText(`Expected Result: Element should be visible and interactable.`);
         const isPassLocal = selectedRun.status === 'PASSED' || selectedRun.status === 'COMPLETED';
         addText(`Actual Result: ${isPassLocal ? "Element verified." : "Selector could not be resolved."}`);
         addText(`Suggested Fix: Verify heading exists or update locator.`);
         currentY += 5;
         try {
            const res = await fetch(shot.url);
            const blob = await res.blob();
            const base64 = await new Promise((resolve) => {
               const reader = new FileReader();
               reader.onloadend = () => resolve(reader.result);
               reader.readAsDataURL(blob);
            });
            if (currentY + 100 > 280) { doc.addPage(); currentY = 15; }
            doc.addImage(base64, 'JPEG', margin, currentY, 150, 100);
            currentY += 110;
         } catch(e) {
            addText(`[Screenshot embedded URL: ${shot.url}]`);
            currentY += 5;
         }
       }
    } else {
       addText("Execution payload did not contain screenshot artifacts.");
       currentY += 10;
    }

    addTitle("11. FINAL RELEASE DECISION");
    addText(`Environment: Staging`, 0, [0,0,0], true);
    addText(`Status: ${executionStatus === 'BLOCKED' ? 'NOT APPROVED FOR STAGING' : 'APPROVED FOR STAGING'}`, 0, executionStatus === 'BLOCKED' ? [220, 38, 38] : [22, 163, 74], true);
    addText(`Production: ${executionStatus === 'READY FOR PRODUCTION' ? 'APPROVED' : 'NOT APPROVED'}`, 0, executionStatus === 'READY FOR PRODUCTION' ? [22, 163, 74] : [220, 38, 38], true);
    addText(`Risk Level: ${executionStatus === 'BLOCKED' ? 'High' : (executionStatus === 'READY FOR PRODUCTION' ? 'Low' : 'Medium')}`, 0, [0,0,0], true);
    currentY += 5;
    
    addText(`Reason:`, 0, [0,0,0], true);
    if (funcHealth >= 80) addText(`✓ Core functionality operational`, 5, [22, 163, 74]);
    if (failedScenariosCount === 0) addText(`✓ All flows successful`, 5, [22, 163, 74]);
    
    if (failedEvents.length > 0) {
        addText(`✗ Validation failures detected`, 5, [220, 38, 38]);
        if (failedEvents.some(f => classifyIssue(f.value || f.error, f.target).type === 'Locator Parsing Error')) {
            addText(`✗ Locator parsing issues detected`, 5, [220, 38, 38]);
        }
    }
    if (a11yScanStatus === "Partial Failure") addText(`✗ Accessibility validation step failed`, 5, [220, 38, 38]);
    currentY += 5;

    addText(`Required Action:`, 0, [0,0,0], true);
    addText(executionStatus === 'READY FOR PRODUCTION' ? `Proceed with production deployment.` : `Resolve failed validation scenarios before production deployment.`, 5);
    currentY += 10;

    addTitle("12. RAW EXECUTION LOGS");
    addText("Logs are reference material only.", 0, [150, 150, 150], false);
    currentY += 5;
    const rawLogsBody = safeStepLogs.map(s => [
      s.action, s.target || "-", s.value || s.error || "-", s.status, `${s.durationMs || 0}ms`
    ]);
    autoTable(doc, { 
       startY: currentY, 
       head: [["Action", "Target", "Value", "Status", "Duration"]], 
       body: rawLogsBody,
       theme: 'grid', styles: { fontSize: 8 }
    });

    doc.save(`NovaTest_Report_${selectedRun.id.substring(0,8)}.pdf`);
    triggerToast("PDF Report Downloaded Successfully", false);
  };

  if (loading || !selectedRun) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (['QUEUED', 'RUNNING'].includes(selectedRun.status)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 bg-slate-900 rounded-lg text-slate-400 hover:text-white transition border border-white/5 hover:border-white/20"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Replay Analytics Room</span>
              {selectedRun.browser && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold uppercase capitalize">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  {selectedRun.browser}
                </span>
              )}
            </div>
            <h2 className="report-page-title mt-0.5">
              Run Replay: {selectedRun.suite?.name || "QA Automated Run"}
            </h2>
          </div>
        </div>
        <div className="glass-panel p-12 text-center rounded-2xl shadow-xl border border-white/5 bg-slate-900/40">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-lg font-bold text-white mb-2">Execution is {selectedRun.status.toLowerCase()}</h3>
          <p className="text-sm text-slate-400">Execution is queued. Report will be available after processing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-white font-bold shadow-md transition-all hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #6366f1, #06b6d4)" }}
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div>
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400 uppercase tracking-widest">Replay Analytics Room</span>
                {selectedRun.browser && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase capitalize shadow-sm"
                    style={{ background: "linear-gradient(135deg,#e0f2fe,#dbeafe)", color: "#1e40af", border: "1px solid #bfdbfe" }}
                    >
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    {selectedRun.browser}
                  </span>
                )}
              </div>
            <h2 className="report-page-title mt-0.5">
              Run Replay: {selectedRun.suite?.name || "QA Automated Run"}
            </h2>
          </div>
        </div>
        <button 
           onClick={handleDownloadReport}
           className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all"
        >
           <Download className="w-4 h-4" />
           Download PDF Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {aiReport ? (
            <>
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="report-tile border">
                  <span className="report-tile-label block mb-2">Execution Status</span>
                  <div className="flex items-center gap-2">
                    {selectedRun.status === 'PASSED' || selectedRun.status === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-rose-500" />}
                    <span className="report-tile-value">{selectedRun.status}</span>
                  </div>
                </div>
                <div className="report-tile border">
                  <span className="report-tile-label block mb-2">AI Confidence</span>
                  <div className="flex items-center gap-2">
                    <span className="report-tile-value text-indigo-600 dark:text-indigo-400">{aiReport.ai_confidence_score}%</span>
                  </div>
                </div>
                <div className="report-tile border">
                  <span className="report-tile-label block mb-2">Interaction Success</span>
                  <div className="flex items-center gap-2">
                    <span className="report-tile-value text-cyan-600 dark:text-cyan-400">{aiReport.interaction_success_rate}%</span>
                  </div>
                </div>
                <div className="report-tile border">
                  <span className="report-tile-label block mb-2">DOM Stability</span>
                  <div className="flex items-center gap-2">
                    <span className={`report-tile-value ${aiReport.dom_stability === 'High' ? 'text-emerald-600 dark:text-emerald-400' : aiReport.dom_stability === 'Low' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>{aiReport.dom_stability}</span>
                  </div>
                </div>
                {selectedRun.jiraTicketId && (
                  <>
                    <div className="glass-panel p-4 rounded-2xl shadow-xl bg-slate-900/40 border border-white/5">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1 mb-1"><Bug className="w-3 h-3"/> Jira Ticket</span>
                      <a href={selectedRun.jiraTicketUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-0.5 underline">
                        {selectedRun.jiraTicketId}
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] rounded uppercase ml-1 no-underline transition-colors hover:bg-blue-500/30">Open</span>
                      </a>
                    </div>
                    <div className="glass-panel p-4 rounded-2xl shadow-xl bg-slate-900/40 border border-white/5">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Jira Sync</span>
                      <span className={`font-bold text-sm block mt-0.5 ${selectedRun.jiraSyncTimestamp ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {selectedRun.jiraSyncTimestamp ? 'SUCCESS' : 'PENDING'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* AI Analysis & Validation Section */}
              <div className="panel-neutral rounded-2xl shadow-xl overflow-hidden">
                <div className="report-panel-header p-5 flex items-center justify-between">
                  <h3 className="report-section-heading flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-500" /> AI Execution Intelligence
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="report-tile-label block">Health Score</span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{aiReport.health_score}</span>
                    </div>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <span className="report-tile-label block mb-2">AI Summary</span>
                    <p className="text-sm leading-relaxed font-medium p-4 rounded-xl log-panel">
                      {aiReport.ai_summary}
                    </p>
                  </div>
                  <div>
                    <span className="report-tile-label block mb-2">Validation Checklist</span>
                    <ul className="space-y-2">
                      {aiReport.validation_results?.map((res, i) => (
                        <li key={i} className="validation-pass flex items-start gap-2 p-2.5 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{res}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Timeline UI */}
              <div className="panel-neutral p-5 rounded-2xl shadow-xl space-y-4">
                <h4 className="report-section-heading flex items-center gap-2 border-b pb-2" style={{borderColor:"var(--border-subtle)"}}>
                  <FileText className="w-4 h-4 text-indigo-500" /> Execution Timeline
                </h4>
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[15px] before:h-full before:w-0.5 before:bg-indigo-100 dark:before:bg-white/5">
                  {aiReport.timeline?.map((item, i) => (
                    <div key={i} className="relative flex items-start gap-4">
                      <div className={`w-8 h-8 rounded-full border-2 shrink-0 relative z-10 flex items-center justify-center ${item.status === 'FAILED' ? 'bg-rose-50 dark:bg-rose-950 border-rose-400' : 'bg-emerald-50 dark:bg-emerald-950 border-emerald-400'}`}>
                        {item.status === 'FAILED' ? <XCircle className="w-4 h-4 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      </div>
                      <div className="flex-1 timeline-item p-4 rounded-xl flex justify-between items-center hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-colors">
                        <span className="text-sm font-semibold">{item.event}</span>
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-slate-950 px-2 py-1 rounded">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Expandable Technical Logs */}
              <div className="technical-logs-collapsible-panel overflow-hidden transition-all duration-300">
                <button 
                  onClick={() => setLogsExpanded(!logsExpanded)}
                  className="w-full px-5 py-4 flex items-center justify-between transition-colors border-b"
                  style={{
                    background: "linear-gradient(90deg, rgba(99,102,241,0.10), rgba(168,85,247,0.08))",
                    borderColor: "rgba(99,102,241,0.12)"
                  }}
                >
                  <span className="flex items-center gap-3 text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-cyan-400" /> View Technical Logs
                  </span>
                  <span className="px-4 py-1.5 text-xs font-semibold text-white rounded-xl shadow-sm transition-all hover:scale-105 hover:-translate-y-0.5 active:translate-y-0"
                        style={{
                          background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                          boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)"
                        }}>
                    Raw Trace
                  </span>
                </button>
                
                {logsExpanded && (
                  <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
                    {(() => {
                      const safeStepLogs = (() => {
                        try {
                          if (Array.isArray(selectedRun?.stepLogs)) return selectedRun.stepLogs;
                          if (typeof selectedRun?.stepLogs === "string") {
                            const parsed = JSON.parse(selectedRun.stepLogs);
                            return Array.isArray(parsed) ? parsed : [];
                          }
                          return [];
                        } catch {
                          return [];
                        }
                      })();
                      
                      return safeStepLogs.map((step, idx) => {
                        const action = (step.action || "").toUpperCase();
                        const status = (step.status || "").toUpperCase();
                        let logClass = "status-info";
                        if (status === "FAILED" || action === "ERROR") logClass = "status-failed";
                        else if (action.includes("ACCESSIBILITY")) logClass = "status-accessibility";
                        else if (action.includes("SECURITY")) logClass = "status-security";
                        else if (status === "PASSED" || status === "COMPLETED" || action === "SUCCESS") logClass = "status-passed";
                        
                        return (
                          <div 
                            key={idx} 
                            onClick={() => handleScrubToStep(step)}
                            className={`step-log-row ${logClass} p-4 rounded-xl flex items-start gap-4 cursor-pointer transition-all duration-200`}
                          >
                            <div className="flex items-start gap-4 w-full">
                              <span className="w-8 h-8 bg-white/40 dark:bg-black/20 border border-current rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="block mt-0.5 log-action-title">
                                  {step.action || "Step"}
                                </span>
                                <span className="block mt-1 log-details-desc">
                                  {step.details || "Page Navigation"}
                                </span>
                                {step.value && (
                                  <div className="mt-3 p-3.5 rounded-xl border border-current/10 bg-white/20 dark:bg-black/10 log-expanded-block font-mono">
                                    <strong className="block text-xs uppercase tracking-wider mb-2 text-current/80 font-bold">Value</strong>
                                    {(() => {
                                      try {
                                        const parsed = JSON.parse(step.value);
                                        return (
                                          <pre className="text-[15px] font-medium leading-[1.8] whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
                                            {JSON.stringify(parsed, null, 2)}
                                          </pre>
                                        );
                                      } catch {
                                        return <span className="break-all text-[15px] font-medium leading-[1.8] font-mono">{step.value}</span>;
                                      }
                                    })()}
                                  </div>
                                )}
                                {step.rawSelector && (
                                  <div className="mt-3 p-3.5 rounded-xl border border-current/10 bg-white/20 dark:bg-black/10 log-expanded-block font-mono">
                                    <strong className="block text-xs uppercase tracking-wider mb-2 text-current/80 font-bold">Selector</strong>
                                    <span className="break-all text-[15px] font-medium leading-[1.8] font-mono">{step.rawSelector}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Fallback Legacy Execution Metrics */}
              <div className="glass-panel p-5 rounded-2xl shadow-xl space-y-4 bg-slate-900/40 border border-white/5">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h3 className="text-sm font-semibold text-white">Execution Metrics</h3>
                  <button 
                     onClick={handleDownloadReport}
                     className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/30 transition-colors"
                  >
                     <Download className="w-3.5 h-3.5" />
                     Download Report
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Status Code</span>
                    <span className={`font-bold capitalize text-sm block mt-0.5 ${(selectedRun.status === "PASSED" || selectedRun.status === "COMPLETED") ? "text-emerald-400" : (selectedRun.status === "FAILED") ? "text-rose-400" : "text-slate-400"}`}>
                      {selectedRun.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Runtime</span>
                    <span className="font-bold text-slate-200 text-sm block mt-0.5">{((selectedRun.durationMs || 0) / 1000).toFixed(2)} seconds</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Agent Framework</span>
                    <span className="font-bold text-slate-200 text-sm block mt-0.5">Playwright v1.40</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Environment Channel</span>
                    <span className="font-bold text-slate-200 text-sm block mt-0.5 uppercase">{selectedRun.environment}</span>
                  </div>
                  {selectedRun.jiraTicketId && (
                    <>
                      <div>
                        <span className="text-slate-500 flex items-center gap-1"><Bug className="w-3 h-3"/> Jira Ticket</span>
                        <a href={selectedRun.jiraTicketUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 mt-0.5 underline">
                          {selectedRun.jiraTicketId}
                          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] rounded uppercase ml-1 no-underline transition-colors hover:bg-blue-500/30">Open</span>
                        </a>
                      </div>
                      <div>
                        <span className="text-slate-500 flex items-center gap-1">Jira Sync Status</span>
                        <span className={`font-bold text-sm block mt-0.5 ${selectedRun.jiraSyncTimestamp ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {selectedRun.jiraSyncTimestamp ? 'SUCCESS' : 'PENDING'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="glass-panel p-5 rounded-2xl shadow-xl space-y-4 bg-slate-900/40 border border-white/5">
                <div className="space-y-3">
                  {(() => {
                    const safeStepLogs = (() => {
                      try {
                        if (Array.isArray(selectedRun?.stepLogs)) return selectedRun.stepLogs;
                        if (typeof selectedRun?.stepLogs === "string") {
                          const parsed = JSON.parse(selectedRun.stepLogs);
                          return Array.isArray(parsed) ? parsed : [];
                        }
                        return [];
                      } catch {
                        return [];
                      }
                    })();
                    
                    return safeStepLogs.map((step, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleScrubToStep(step)}
                      className="p-3 bg-slate-950/40 border border-white/5 rounded-xl flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-900/80 hover:border-indigo-500/30 transition-all duration-200 group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-5 h-5 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-400 shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                            {step.details || "Page Navigation"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ));
                  })()}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-0 rounded-2xl shadow-xl overflow-hidden border border-white/10 relative bg-slate-900/40">
            <div className="p-3 border-b border-white/5 bg-slate-950/50 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-400" /> Live Execution Replay
              </h3>
            </div>
            <div className="bg-black relative aspect-video flex items-center justify-center">
              {['QUEUED', 'RUNNING', 'HEALING'].includes(selectedRun.status) ? (
                <div className="text-center p-8 flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                  <span className="text-sm font-medium text-indigo-400 animate-pulse">Processing Video Artifact...</span>
                  <span className="text-xs text-slate-500 mt-2 max-w-[250px]">Replay will be available shortly after execution completes.</span>
                </div>
              ) : selectedRun.videos?.length > 0 && selectedRun.videos[0].url.includes('.mp4') ? (
                <video 
                  ref={videoRef}
                  controls 
                  className="w-full h-full object-contain bg-black"
                  controlsList="nodownload"
                  autoPlay
                  muted
                >
                  <source src={selectedRun.videos[0].url} type="video/mp4" />
                </video>
              ) : (
                <div className="text-center p-8 flex flex-col items-center">
                  <Video className="w-12 h-12 text-slate-700 mb-3" />
                  <span className="text-sm font-medium text-slate-500">No valid video artifact</span>
                  <span className="text-xs text-slate-600 mt-1 max-w-[250px]">Video recording failed or generated an invalid format.</span>
                </div>
              )}
            </div>
            <div className="technical-log-card px-5 py-4 flex gap-3 flex-wrap items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{color:"var(--text-secondary)"}}>Technical Actions</span>
              </div>
              <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setTraceModalOpen(true)}
                className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-sm"
                style={{ background: "linear-gradient(135deg,#eef2ff,#e0e7ff)", color: "#3730a3", border: "1px solid #c7d2fe" }}
              >
                <FileText className="w-4 h-4" /> Raw Trace
              </button>
              {selectedRun.screenshots?.length > 0 && (
                <a
                  href={selectedRun.screenshots[0].url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-sm"
                  style={{ background: "linear-gradient(135deg,#ecfdf5,#d1fae5)", color: "#065f46", border: "1px solid #6ee7b7" }}
                >
                  <Image className="w-4 h-4" /> Snapshot
                </a>
              )}
              {selectedRun.stepLogs && (
                <button
                  onClick={() => setPlanModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-sm"
                  style={{ background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", color: "#5b21b6", border: "1px solid #c4b5fd" }}
                >
                  <FileText className="w-4 h-4" /> Execution Plan
                </button>
              )}
              </div>
            </div>
          </div>

          <TranscriptPanel transcriptEvents={transcriptEvents} videoRef={videoRef} />

          {selectedRun.visualRegressionData && (() => {
            try {
              const vrData = typeof selectedRun.visualRegressionData === 'string' ? JSON.parse(selectedRun.visualRegressionData) : selectedRun.visualRegressionData;
              return (
                <div className={`glass-panel p-5 rounded-2xl shadow-xl border ${vrData.hasVisualBugs ? 'border-rose-500/20 bg-rose-950/10' : 'border-teal-500/20 bg-teal-950/10'} space-y-4`}>
                  <div className={`flex items-center gap-2 ${vrData.hasVisualBugs ? 'text-rose-400' : 'text-teal-400'}`}>
                    <Eye className="w-5 h-5 shrink-0" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">AI Eyes (Visual Regression)</h4>
                    <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase ${!vrData.hasVisualBugs ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-rose-500/20 border-rose-500/30 text-rose-300"}`}>
                      {!vrData.hasVisualBugs ? "Visually Perfect" : "Visual Bugs Detected"}
                    </span>
                  </div>
                  {vrData.hasVisualBugs && vrData.issues?.length > 0 && (
                    <div className="space-y-2">
                      {vrData.issues.map((issue, i) => (
                        <div key={i} className="p-3 bg-slate-950/60 rounded-xl font-mono text-[10px] text-slate-300 break-words border border-white/5">
                          <span className="font-bold text-rose-400">Detected:</span> {issue}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            } catch (e) {
              return null;
            }
          })()}

          {selectedRun.execution_result?.accessibility && (
            <div className="glass-panel p-5 rounded-2xl shadow-xl border border-indigo-500/20 bg-indigo-950/10 space-y-4">
              <div className="flex items-center gap-2 text-indigo-400">
                <Eye className="w-5 h-5 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Accessibility Scan</h4>
                <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedRun.execution_result.accessibility.success ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-rose-500/20 border-rose-500/30 text-rose-300"}`}>
                  {selectedRun.execution_result.accessibility.success ? "Passed" : `${selectedRun.execution_result.accessibility.violations.length} Violations`}
                </span>
              </div>
              {!selectedRun.execution_result.accessibility.success && selectedRun.execution_result.accessibility.violations.length > 0 && (
                <div className="space-y-2">
                  {selectedRun.execution_result.accessibility.violations.map((v, i) => (
                    <div key={i} className="p-3 bg-slate-950/60 rounded-xl font-mono text-[10px] text-slate-300 break-words border border-white/5">
                      <span className="font-bold text-rose-400">[{v.impact}]</span> {v.description} (Nodes: {v.nodes})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedRun.execution_result?.security && (
            <div className="glass-panel p-5 rounded-2xl shadow-xl border border-cyan-500/20 bg-cyan-950/10 space-y-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <Shield className="w-5 h-5 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Security Sanity Checks</h4>
                <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold uppercase ${selectedRun.execution_result.security.success ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-amber-500/20 border-amber-500/30 text-amber-300"}`}>
                  {selectedRun.execution_result.security.success ? "Passed" : "Issues Detected"}
                </span>
              </div>
              {!selectedRun.execution_result.security.success && (
                <div className="p-3 bg-slate-950/60 rounded-xl font-mono text-[10px] text-slate-300 break-words border border-white/5 space-y-1">
                  {selectedRun.execution_result.security.issues?.mixedContent && <div><AlertTriangle className="w-3 h-3 inline text-amber-400 mr-1"/> Mixed Content detected on HTTPS page.</div>}
                  {selectedRun.execution_result.security.issues?.insecureForms && <div><AlertTriangle className="w-3 h-3 inline text-amber-400 mr-1"/> Insecure Forms (HTTP action) detected.</div>}
                </div>
              )}
            </div>
          )}

          {(selectedRun.error || selectedRun.bug_report || selectedRun.execution_result?.bug_report) && !aiReport && (() => {
            const br = selectedRun.bug_report || selectedRun.execution_result?.bug_report;
            return (
              <div className="diagnosis-card status-error p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-30 rounded-full blur-3xl" style={{background:"radial-gradient(circle, #fca5a5, transparent)"}} />
                <div className="flex items-center gap-3 relative z-10">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{background:"linear-gradient(135deg,#fee2e2,#fecaca)",border:"1px solid #fca5a5"}}>
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  </span>
                  <div>
                    <h4 className="text-base font-extrabold text-rose-700 dark:text-rose-300">Error Classification</h4>
                    {br?.severity && <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Severity: {br.severity}</span>}
                  </div>
                </div>
                {br?.title && (
                  <h5 className="text-sm font-bold text-rose-800 dark:text-rose-200 border-b border-rose-200 dark:border-rose-500/20 pb-2 relative z-10">{br.title}</h5>
                )}
                <div className="analytics-card p-4 rounded-xl font-mono text-sm leading-relaxed relative z-10">
                  {selectedRun.error || br?.description || "Unknown Error"}
                </div>
                {br && (
                  <div className="relative z-10">
                    <span className="text-xs font-bold uppercase tracking-widest block mb-2" style={{color:"var(--text-secondary)"}}>AI Diagnostic Recommendation</span>
                    <p className="text-sm leading-relaxed p-4 rounded-xl font-medium" style={{background:"linear-gradient(135deg,#eef2ff,#e0e7ff)",border:"1px solid #c7d2fe",color:"#3730a3"}}>
                      {br.suggested_fix || br.description}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {aiReport && (
            <>
              {/* AI Diagnosis Card – status-adaptive */}
              {(() => {
                const isPassed = aiReport.status === 'PASSED' || aiReport.status === 'COMPLETED';
                const isWarning = aiReport.status === 'WARNING';
                const surface = isPassed
                  ? { card: 'diagnosis-card status-success', glow: '#bbf7d0', icon: 'text-emerald-600 dark:text-emerald-400', title: 'text-emerald-800 dark:text-emerald-200', iconBg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', iconBorder: '#6ee7b7', bodyBg: 'linear-gradient(135deg,#ecfdf5,#f0fdf4)', bodyBorder: '#6ee7b7', bodyText: '#065f46' }
                  : isWarning
                  ? { card: 'diagnosis-card status-warning', glow: '#fde68a', icon: 'text-amber-600 dark:text-amber-400', title: 'text-amber-800 dark:text-amber-200', iconBg: 'linear-gradient(135deg,#fef3c7,#fde68a)', iconBorder: '#fcd34d', bodyBg: 'linear-gradient(135deg,#fffbeb,#fef9c3)', bodyBorder: '#fcd34d', bodyText: '#78350f' }
                  : { card: 'diagnosis-card status-error',   glow: '#fca5a5', icon: 'text-rose-600 dark:text-rose-400',   title: 'text-rose-800 dark:text-rose-200',   iconBg: 'linear-gradient(135deg,#fee2e2,#fecaca)', iconBorder: '#fca5a5', bodyBg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', bodyBorder: '#fca5a5', bodyText: '#9f1239' };
                return (
                  <div className={`${surface.card} p-6 rounded-2xl shadow-xl space-y-4 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-40 h-40 opacity-25 rounded-full blur-3xl pointer-events-none"
                      style={{background:`radial-gradient(circle, ${surface.glow}, transparent)`}} />
                    <div className="flex items-start justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md"
                          style={{background:surface.iconBg,border:`1px solid ${surface.iconBorder}`}}>
                          <ShieldAlert className={`w-5 h-5 ${surface.icon}`} />
                        </span>
                        <h3 className={`text-lg font-extrabold ${surface.title}`}>AI Diagnosis: {aiReport.status}</h3>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-black" style={{color:"var(--text-primary)"}}>{aiReport.health_score}</div>
                        <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{color:"var(--text-secondary)"}}>Health Score</div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl text-sm leading-relaxed relative z-10 font-medium"
                      style={{background:surface.bodyBg,border:`1px solid ${surface.bodyBorder}`,color:surface.bodyText}}>
                      {aiReport.reason}
                    </div>
                    {aiReport.screenshot_analysis && (
                      <div className="rounded-xl p-4 relative z-10" style={{background:"linear-gradient(135deg,#eef2ff,#ede9fe)",border:"1px solid #c7d2fe"}}>
                        <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Image className="w-4 h-4" /> Screenshot Analysis
                        </h4>
                        <p className="text-sm text-indigo-800 dark:text-indigo-200">{aiReport.screenshot_analysis}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Recommendations */}
              {aiReport.recommendations && aiReport.recommendations.length > 0 && (
                <div className="panel-success p-5 rounded-2xl shadow-xl space-y-3">
                  <h4 className="report-section-heading flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Recommended Actions
                  </h4>
                  <ul className="space-y-2">
                    {aiReport.recommendations.map((rec, i) => (
                      <li key={i} className="rec-item flex items-start gap-2 p-2.5 rounded-lg">
                        <ArrowRight className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Network / Page Analysis */}
              {aiReport.detected_issues && aiReport.detected_issues.length > 0 && (
                <div className="panel-warning p-5 rounded-2xl shadow-xl space-y-3">
                  <h4 className="report-section-heading flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Detected Network / Page Issues
                  </h4>
                  <ul className="space-y-2">
                    {aiReport.detected_issues.map((issue, i) => (
                      <li key={i} className="issue-item flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Reconstructed Timeline */}
              {(!transcriptEvents || transcriptEvents.length === 0) && aiReport.timeline && aiReport.timeline.length > 0 && (
                <div className="analytics-card p-5 rounded-2xl shadow-xl space-y-4">
                  <h4 className="report-section-heading flex items-center gap-2 border-b pb-2" style={{borderColor:"var(--border-subtle)"}}>
                    <FileText className="w-4 h-4 text-indigo-500" /> AI Reconstructed Timeline
                  </h4>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-0.5 before:bg-indigo-100 dark:before:bg-indigo-500/20">
                    {aiReport.timeline.map((item, i) => (
                      <div key={i} className="relative flex items-start gap-4">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border-2 border-indigo-400 shrink-0 relative z-10 flex items-center justify-center shadow-sm">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        </div>
                        <div className="flex-1 timeline-item p-3 rounded-xl flex justify-between items-center">
                          <span className="text-sm font-semibold">{item.event}</span>
                          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-slate-950 px-2 py-1 rounded">{item.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {selectedRun.logs && (
            <div className="log-panel p-5 rounded-2xl shadow-xl space-y-2 mt-6 max-h-96 overflow-y-auto">
              <h3 className="report-section-heading sticky top-0 pb-2 mb-2 border-b" style={{borderColor:"var(--border-subtle)",background:"inherit"}}>Raw Execution Logs</h3>
              <pre className="font-mono whitespace-pre-wrap leading-relaxed text-xs">
                {selectedRun.logs}
              </pre>
            </div>
          )}
        </div>
      </div>
      <TraceModal isOpen={traceModalOpen} onClose={() => setTraceModalOpen(false)} runId={runId} />
      <PlanModal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} runId={runId} />
    </div>
  );
}

export default function ReportDetails() {
  return (
    <ReportErrorBoundary>
      <ReportDetailsContent />
    </ReportErrorBoundary>
  );
}
