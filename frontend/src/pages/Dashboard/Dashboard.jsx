import React, { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import {
  Database, Cpu, BarChart3, Wand2, Clock,
  CheckCircle2, AlertTriangle, RefreshCw, XCircle, Globe,
  TrendingUp, Activity, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useNavigate } from "react-router-dom";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: "easeOut" },
});

/* ── Metric card config ───────────────────────────────────── */
const METRIC_ACCENT = {
  indigo: { icon: "text-indigo-500", bg: "rgba(99,102,241,0.08)", blob: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.20)", cssClass: "metric-card-indigo" },
  cyan:   { icon: "text-cyan-500",   bg: "rgba(6,182,212,0.08)",  blob: "rgba(6,182,212,0.15)",  border: "rgba(6,182,212,0.20)",  cssClass: "metric-card-cyan"   },
  violet: { icon: "text-violet-500", bg: "rgba(139,92,246,0.08)", blob: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.20)", cssClass: "metric-card-violet" },
  rose:   { icon: "text-rose-500",   bg: "rgba(244,63,94,0.08)",  blob: "rgba(244,63,94,0.15)",  border: "rgba(244,63,94,0.20)",  cssClass: "metric-card-rose"   },
};

function MetricCard({ label, value, sub, subColor = "text-emerald-500", Icon, accent, delay }) {
  const a = METRIC_ACCENT[accent];
  return (
    <motion.div {...fadeUp(delay)} className={`metric-card ${a.cssClass}`}
      style={{ borderColor: a.border }}>
      {/* Blob */}
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl"
        style={{ background: a.blob }} />
      {/* Icon chip */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest"
          style={{ background: a.bg, color: "var(--text-secondary)" }}>
          {label}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: a.bg }}>
          <Icon className={`w-4.5 h-4.5 ${a.icon}`} style={{ width: 18, height: 18 }} />
        </div>
      </div>
      {/* Value */}
      <p className="text-5xl font-black tracking-tight leading-none"
        style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      {/* Sub */}
      {sub && (
        <p className={`text-[11px] font-semibold mt-2 flex items-center gap-1 ${subColor}`}>
          {sub}
        </p>
      )}
    </motion.div>
  );
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { triggerToast } = useToast();
  const navigate = useNavigate();
  const [runsLimit, setRunsLimit] = useState(10);
  const fetcher = api.fetcher.bind(api);

  const { data: summary, isLoading: summaryLoading, mutate: mutateSummary } = useSWR(
    currentUser ? "/api/v1/dashboard/summary" : null, fetcher, { refreshInterval: 30000 });
  const { data: trend, isLoading: trendLoading, mutate: mutateTrend } = useSWR(
    currentUser ? "/api/v1/dashboard/execution-trend?days=7" : null, fetcher, { refreshInterval: 30000 });
  const { data: browserDist, isLoading: browserDistLoading, mutate: mutateBrowserDist } = useSWR(
    currentUser ? "/api/v1/dashboard/browser-distribution" : null, fetcher, { refreshInterval: 30000 });
  const { data: runs, isLoading: runsLoading, mutate: mutateRuns } = useSWR(
    currentUser ? `/api/v1/dashboard/recent-executions?limit=${runsLimit}` : null, fetcher, { refreshInterval: 30000 });

  const metricsLoading = summaryLoading || trendLoading || browserDistLoading || runsLoading;

  const loadDashboardMetrics = async () => {
    if (!currentUser) return;
    try {
      await Promise.all([mutateSummary(), mutateTrend(), mutateBrowserDist(), mutateRuns()]);
      triggerToast("Telemetry synchronized successfully.");
    } catch (err) {
      triggerToast("Metrics sync failed.", true);
    }
  };

  const PIE_COLORS = ["#6366f1", "#06b6d4", "#a855f7", "#ec4899"];
  const DOT_COLORS = ["bg-indigo-500", "bg-cyan-500", "bg-purple-500", "bg-pink-500"];

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: "var(--bg-badge)", color: "#6366f1" }}>
              Live Analytics
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight gradient-text">
            NovaTest AI Dashboard
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
            Real-time AI execution analytics, healing metrics &amp; swarm orchestration.
          </p>
        </div>
        <button
          onClick={loadDashboardMetrics}
          disabled={metricsLoading}
          className="btn-ghost shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? "animate-spin" : ""}`} />
          <span>Synchronize Telemetry</span>
        </button>
      </motion.div>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!metricsLoading && summary?.totalExecutions === 0 && (
        <motion.div {...fadeUp(0.1)}
          className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center"
          style={{ border: "1px dashed var(--border-input)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 animate-float"
            style={{ background: "var(--bg-badge)" }}>
            <Database className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            No execution data yet
          </h3>
          <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
            Run your first test suite to start seeing live analytics, browser distribution,
            and performance trends here.
          </p>
        </motion.div>
      )}

      {/* ── Skeletons ───────────────────────────────────────────── */}
      {metricsLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
            <div className="skeleton h-72 rounded-2xl" />
          </div>
        </div>
      )}

      {/* ── Metric Cards ────────────────────────────────────────── */}
      {!metricsLoading && summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Executions" value={summary.totalExecutions}
            Icon={Cpu} accent="indigo" delay={0.05}
            sub={<><CheckCircle2 className="w-3 h-3" /> Active database sync</>}
          />
          <MetricCard
            label="Platform Run Success" value={`${summary.successRate}%`}
            Icon={TrendingUp} accent="cyan" delay={0.10}
            sub={<><Activity className="w-3 h-3" /> {summary.passedCount}p / {summary.failedCount}f</>}
            subColor="text-cyan-500"
          />
          <MetricCard
            label="Self-Healing Triggers" value={summary.selfHealingCount}
            Icon={Wand2} accent="violet" delay={0.15}
            sub={<><Zap className="w-3 h-3" /> Selector healed</>}
            subColor="text-violet-500"
          />
          <MetricCard
            label="Average Duration" value={`${summary.avgDuration}s`}
            Icon={Clock} accent="rose" delay={0.20}
            sub={<><AlertTriangle className="w-3 h-3" /> Performance telemetry</>}
            subColor="text-rose-500"
          />
        </div>
      )}

      {/* ── Charts ─────────────────────────────────────────────── */}
      {!metricsLoading && trend && browserDist && summary?.totalExecutions > 0 && (
        <motion.div {...fadeUp(0.25)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Area Chart */}
          <div className="glass-panel rounded-2xl p-5 lg:col-span-2" style={{ border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Historical Execution Trend
              </h3>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background: "var(--bg-badge)", color: "var(--text-secondary)" }}>
                Last 7 days
              </span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="passedColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="failedColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.06)" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={14}
                    tickLine={false}
                    tick={{ fontSize: 14, fontWeight: 600, fill: "var(--text-secondary)" }}
                    tickMargin={10}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={14}
                    tickLine={false}
                    tick={{ fontSize: 14, fontWeight: 600, fill: "var(--text-secondary)" }}
                    tickMargin={8}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-panel)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "14px", fontWeight: 600, paddingTop: "12px" }}
                  />
                  <Area name="Passed Tests" type="monotone" dataKey="passed" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#passedColor)" />
                  <Area name="Failed Tests" type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#failedColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col" style={{ border: "1px solid var(--border-subtle)" }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Cross-Browser Distribution
            </h3>
            <div className="h-56 relative flex items-center justify-center flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={browserDist} innerRadius={62} outerRadius={88} paddingAngle={4} dataKey="count">
                    {browserDist.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-panel)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "12px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl font-black" style={{ color: "var(--text-primary)" }}>
                  {browserDist.reduce((a, c) => a + c.count, 0)}
                </span>
                <span className="text-[13px] uppercase font-bold tracking-widest mt-1" style={{ color: "var(--text-secondary)" }}>
                  Total Runs
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {browserDist.map((entry, idx) => (
                <div key={entry.browser} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${DOT_COLORS[idx % DOT_COLORS.length]}`} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{entry.browser}:</span>
                  <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Recent Executions Table ──────────────────────────────── */}
      {!metricsLoading && runs && summary?.totalExecutions > 0 && (
        <motion.div {...fadeUp(0.30)}
          className="glass-panel rounded-2xl p-5"
          style={{ border: "1px solid var(--border-subtle)" }}>
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Recent Execution Events
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Click any row to view the full report
              </p>
            </div>
            <select
              value={runsLimit}
              onChange={(e) => setRunsLimit(Number(e.target.value))}
              className="glass-input rounded-lg text-xs py-1.5 px-2.5 focus:outline-none"
              style={{ color: "var(--text-primary)" }}
            >
              <option value={10}>10 records</option>
              <option value={25}>25 records</option>
              <option value={50}>50 records</option>
              <option value={100}>100 records</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  background: "var(--bg-badge)",
                }}>
                  {["Test Name / ID", "Browser", "Project", "Status", "Duration", "Executed At"].map(h => (
                    <th key={h} className="py-3.5 px-4 text-left font-bold text-sm uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const passed = r.status === "passed" || r.status === "completed";
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/reports/${r.run_id || r.id}`)}
                      className="table-row"
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    >
                      <td className="py-4 px-4">
                        <span className="text-base font-bold block" style={{ color: "var(--text-primary)" }}>
                          {r.testName || "Sandbox Execution"}
                        </span>
                        <span className="text-xs font-mono mt-0.5 block" style={{ color: "var(--text-secondary)" }}>
                          {r.run_id}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-cyan-500" />
                          <span className="capitalize text-base font-medium" style={{ color: "var(--text-secondary)" }}>
                            {r.browser || "chromium"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-base font-medium" style={{ color: "var(--text-secondary)" }}>
                        {r.projectName || "Production"}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          passed
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                            : "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400"
                        }`}>
                          {passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span className="capitalize">{r.status}</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-base font-bold" style={{ color: "var(--text-secondary)" }}>
                        {r.duration}s
                      </td>
                      <td className="py-4 px-4 text-base font-medium" style={{ color: "var(--text-secondary)" }}>
                        {r.startedAt ? new Date(r.startedAt).toLocaleString() : "Recently"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
