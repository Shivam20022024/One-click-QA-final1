import React, { useState } from "react";
import {
  PlayCircle, Globe, Shield, Activity, Smartphone,
  Eye, Video as VideoIcon, CheckCircle2, Zap, Bug, Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";
import { useNavigate } from "react-router-dom";
import { ScenarioParser } from "../../services/ScenarioParser";

/* ── Icon accent colours per feature ─────────────────────── */
const FEATURE_ACCENT = {
  aiEyes:        { bg: "bg-teal-100 dark:bg-teal-500/20", icon: "text-teal-600 dark:text-teal-400" },
  video:         { bg: "bg-violet-100 dark:bg-violet-500/20", icon: "text-violet-600 dark:text-violet-400" },
  healing:       { bg: "bg-indigo-100 dark:bg-indigo-500/20", icon: "text-indigo-600 dark:text-indigo-400" },
  accessibility: { bg: "bg-cyan-100   dark:bg-cyan-500/20",   icon: "text-cyan-600   dark:text-cyan-400" },
  security:      { bg: "bg-rose-100   dark:bg-rose-500/20",   icon: "text-rose-600   dark:text-rose-400" },
  responsive:    { bg: "bg-amber-100  dark:bg-amber-500/20",  icon: "text-amber-600  dark:text-amber-400" },
  api:           { bg: "bg-emerald-100 dark:bg-emerald-500/20", icon: "text-emerald-600 dark:text-emerald-400" },
  autoJira:      { bg: "bg-blue-100   dark:bg-blue-500/20",   icon: "text-blue-600   dark:text-blue-400" },
};

const BROWSERS = ["chromium", "firefox", "webkit", "edge"];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: "easeOut" },
});

/* ── Section label ──────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <p className="text-xs font-black uppercase tracking-widest mb-2.5"
      style={{ color: "var(--text-secondary)" }}>
      {children}
    </p>
  );
}

/* ── Styled input/select shared classes ─────────────────── */
const inputCls =
  "w-full rounded-xl px-4 py-3 text-base font-medium border focus:outline-none transition-all duration-150 " +
  "bg-white dark:bg-slate-950 " +
  "border-gray-200 dark:border-white/10 " +
  "text-gray-900 dark:text-white " +
  "placeholder-gray-400 dark:placeholder-slate-500 " +
  "focus:border-indigo-400 dark:focus:border-indigo-500 " +
  "focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/20 " +
  "shadow-sm";

export default function AutonomousRunner() {
  const { triggerToast } = useToast();
  const navigate = useNavigate();

  const [targetUrl, setTargetUrl] = useState("");
  const [customScenarioText, setCustomScenarioText] = useState("");
  const [credentials, setCredentials] = useState({ username: "", password: "", token: "" });
  const [depth, setDepth] = useState("Full Autonomous");
  const [execBrowsers, setExecBrowsers] = useState(["chromium", "firefox", "webkit", "edge"]);
  const [features, setFeatures] = useState({
    video: true, healing: true, accessibility: true,
    api: true, responsive: true, security: true, autoJira: true, aiEyes: true
  });
  const [loading, setLoading] = useState(false);

  const handleToggle = (key) => setFeatures((f) => ({ ...f, [key]: !f[key] }));

  const toggleBrowser = (b) =>
    setExecBrowsers((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );

  const handleRun = async () => {
    if (loading) return;
    if (!targetUrl) { triggerToast("Target URL is required.", true); return; }
    setLoading(true);
    try {
      const parsedScenario = ScenarioParser.parse(customScenarioText);
      const payload = {
        targetUrl, credentials, depth, features,
        browsers: execBrowsers,
        projectId: "demo-project",
        customScenario: parsedScenario?.length > 0 ? parsedScenario : null,
        enableAiEyes: features.aiEyes,
      };
      const result = await api.triggerAutonomousQA(payload);
      triggerToast("Autonomous QA Pipeline Triggered!", false);
      navigate("/execution", { state: { executionIds: result.executionIds, autonomous: true } });
    } catch (err) {
      triggerToast(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const featureCards = [
    { key: "aiEyes",        label: "AI Eyes (Vision)",  icon: Eye,       desc: "GPT-4 Vision layout & CSS checks" },
    { key: "video",         label: "Video Telemetry",   icon: VideoIcon, desc: "Capture 60fps execution replay" },
    { key: "healing",       label: "AI Self-Healing",   icon: Zap,       desc: "Auto-repair broken selectors" },
    { key: "accessibility", label: "Accessibility Scan",icon: Eye,       desc: "Axe-core WCAG compliance" },
    { key: "security",      label: "Security Sanity",   icon: Shield,    desc: "Detect insecure forms & headers" },
    { key: "responsive",    label: "Responsive Testing",icon: Smartphone,desc: "Test mobile viewport layouts" },
    { key: "api",           label: "API Validation",    icon: Activity,  desc: "Verify network payload status" },
    { key: "autoJira",      label: "Auto Jira Bug",     icon: Bug,       desc: "Create bug in Jira on failure" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* ── Header ──────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)} className="text-center space-y-3 mt-4">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500">
          One-Click Autonomous QA
        </h1>
        <p className="max-w-2xl mx-auto text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Paste any live URL and let 20+ specialized AI agents discover, strategize, execute,
          and validate the entire application lifecycle automatically.
        </p>
      </motion.div>

      {/* ── Main Card ───────────────────────────────────────── */}
      <motion.div
        {...fadeUp(0.06)}
        className="rounded-3xl p-7 space-y-7 shadow-2xl"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
          backdropFilter: "blur(18px)",
        }}
      >

        {/* Target URL */}
        <div>
          <SectionLabel>Target URL</SectionLabel>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://your-staging-site.com"
            className={`${inputCls} font-mono`}
          />
        </div>

        {/* Test Depth + Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <SectionLabel>Test Depth</SectionLabel>
            <select value={depth} onChange={(e) => setDepth(e.target.value)} className={inputCls}>
              <option>Smoke Test (Fast)</option>
              <option>Regression Test</option>
              <option>Full Autonomous</option>
            </select>
          </div>
          <div>
            <SectionLabel>Test Username (Optional)</SectionLabel>
            <input type="text" value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
              placeholder="demo@app.com" className={inputCls} />
          </div>
          <div>
            <SectionLabel>Test Password (Optional)</SectionLabel>
            <input type="password" value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="••••••••" className={inputCls} />
          </div>
        </div>

        {/* Custom Scenario */}
        <div>
          <SectionLabel>Custom Test Scenario (Optional)</SectionLabel>
          <textarea
            value={customScenarioText}
            onChange={(e) => setCustomScenarioText(e.target.value)}
            placeholder="Describe your custom testing scenario..."
            className={`${inputCls} h-32 resize-none font-mono`}
          />
        </div>

        {/* Browser Engines */}
        <div>
          <SectionLabel>Browser Engines</SectionLabel>
          <div className="flex flex-wrap gap-2.5">
            {BROWSERS.map((b) => {
              const active = execBrowsers.includes(b);
              return (
                <button
                  key={b}
                  onClick={() => toggleBrowser(b)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize flex items-center gap-2 border transition-all duration-200 ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50"
                      : "bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-200 border-gray-300 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  {b === "webkit" ? "Safari (WebKit)" : b.charAt(0).toUpperCase() + b.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Feature Cards ────────────────────────────────── */}
        <div>
          <SectionLabel>Autonomous Agent Features</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {featureCards.map((feat, i) => {
              const on = features[feat.key];
              const accent = FEATURE_ACCENT[feat.key];
              return (
                <motion.div
                  key={feat.key}
                  {...fadeUp(0.04 * i)}
                  onClick={() => handleToggle(feat.key)}
                  className={`
                    relative p-4 rounded-2xl border cursor-pointer
                    transition-all duration-250 overflow-hidden
                    hover:-translate-y-1
                    ${on
                      ? "bg-gradient-to-br from-indigo-50 to-cyan-50 dark:from-indigo-900/30 dark:to-cyan-900/20 border-indigo-400 dark:border-indigo-500/60 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30"
                      : "bg-white dark:bg-slate-900/60 border-gray-200 dark:border-white/8 shadow-md hover:shadow-xl hover:border-indigo-200 dark:hover:border-white/20"
                    }
                  `}
                >
                  {/* Gradient accent strip on active */}
                  {on && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500" />
                  )}

                  {/* Icon + check row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-xl ${on ? accent.bg : "bg-gray-100 dark:bg-slate-800"}`}>
                      <feat.icon className={`w-4.5 h-4.5 ${on ? accent.icon : "text-gray-500 dark:text-slate-400"}`}
                        style={{ width: 18, height: 18 }} />
                    </div>
                    {on && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 scale-110 drop-shadow-sm" />
                    )}
                  </div>

                  {/* Title */}
                  <h4 className={`text-sm font-bold leading-tight ${
                    on ? "text-gray-900 dark:text-white" : "text-gray-800 dark:text-slate-200"
                  }`}>
                    {feat.label}
                  </h4>

                  {/* Description */}
                  <p className={`text-[11px] mt-1 leading-relaxed font-medium ${
                    on ? "text-gray-700 dark:text-slate-300" : "text-gray-600 dark:text-slate-400"
                  }`}>
                    {feat.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Run Button ──────────────────────────────────── */}
        <div className="pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={handleRun}
            disabled={loading || !targetUrl}
            className="w-full relative overflow-hidden bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 hover:from-indigo-500 hover:via-violet-500 hover:to-cyan-400 text-white font-bold text-base py-5 rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group"
          >
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-white/15 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out skew-x-12" />
            <span className="relative flex items-center justify-center gap-3 tracking-widest uppercase text-sm">
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Provisioning AI Pipeline…</>
              ) : (
                <><PlayCircle className="w-5 h-5" /> Run Autonomous QA</>
              )}
            </span>
          </button>
        </div>

      </motion.div>
    </div>
  );
}
