import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Plus, Trash2, Clock, Globe, Smartphone, RefreshCw } from "lucide-react";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

export default function Schedules() {
  const { currentUser } = useAuth();
  const { activeProject, activeSuite, schedules, setSchedules } = useData();
  const { triggerToast } = useToast();

  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [newSchedName, setNewSchedName] = useState("");
  const [newSchedCron, setNewSchedCron] = useState("*/15 * * * *");
  const [newSchedEnv, setNewSchedEnv] = useState("Production");
  const [newSchedBrowsers, setNewSchedBrowsers] = useState(["chromium"]);
  const [newSchedDevices, setNewSchedDevices] = useState(["Desktop"]);

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!activeProject || !activeSuite || !newSchedName.trim()) {
      triggerToast("Please ensure project, suite, and schedule name are defined.", true);
      return;
    }
    try {
      const sched = await api.createSchedule({
        name: newSchedName,
        cron_expression: newSchedCron,
        project_id: activeProject.id,
        suite_id: activeSuite.id,
        environment: newSchedEnv,
        browsers: newSchedBrowsers,
        devices: newSchedDevices,
      });
      setSchedules([...schedules, sched]);
      setNewSchedName("");
      setIsAddingSchedule(false);
      triggerToast(`Schedule "${sched.name}" active.`);
    } catch (err) {
      triggerToast("Create schedule failed: " + err.message, true);
    }
  };

  const handleDeleteSchedule = async (schedId) => {
    if (!window.confirm("Delete this scheduled execution runner?")) return;
    try {
      await api.deleteSchedule(schedId);
      setSchedules(schedules.filter((s) => s.id !== schedId));
      triggerToast("Schedule deleted.");
    } catch (err) {
      triggerToast("Delete schedule failed: " + err.message, true);
    }
  };

  const toggleBrowser = (b) => {
    setNewSchedBrowsers(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold dark:text-white text-gray-900 tracking-tight">Automation Scheduler</h2>
          <p className="dark:text-slate-400 text-gray-600 text-sm">
            Configure cron jobs to run test suites continuously in the background.
          </p>
        </div>
        <button
          onClick={() => setIsAddingSchedule(!isAddingSchedule)}
          disabled={!activeProject || !activeSuite}
          className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
        >
          <Calendar className="w-4 h-4" />
          <span>New Cron Schedule</span>
        </button>
      </div>

      {!activeSuite && <div className="mb-4 p-3 dark:bg-indigo-500/10 bg-indigo-50 dark:border-indigo-500/20 border-indigo-200 border rounded-xl dark:text-indigo-300 text-indigo-700 text-xs">
          Select an active Project and Test Suite in their respective tabs to enable scheduling.
        </div>
      }

      <AnimatePresence>
        {isAddingSchedule && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreateSchedule} className="glass-panel p-5 rounded-2xl shadow-xl space-y-4 max-w-2xl dark:border-white/5 border-indigo-100 border dark:bg-slate-900/40 bg-white/85">
              <h3 className="text-sm font-bold dark:text-white text-gray-900 border-b dark:border-white/5 border-gray-200 pb-2">Schedule Runner Config</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Schedule Name</label>
                  <input
                    type="text"
                    required
                    value={newSchedName}
                    onChange={(e) => setNewSchedName(e.target.value)}
                    placeholder="e.g. Nightly Regression"
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Environment</label>
                  <select
                    value={newSchedEnv}
                    onChange={(e) => setNewSchedEnv(e.target.value)}
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl dark:text-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
                  >
                    <option value="Production">Production</option>
                    <option value="Staging">Staging</option>
                    <option value="Development">Development</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Cron Expression</label>
                  <input
                    type="text"
                    required
                    value={newSchedCron}
                    onChange={(e) => setNewSchedCron(e.target.value)}
                    placeholder="*/15 * * * *"
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl font-mono dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">Min Hour Day Month Weekday</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-2">Target Browsers</label>
                  <div className="flex flex-wrap gap-2">
                    {["chromium", "firefox", "webkit", "edge"].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => toggleBrowser(b)}
                        className={`px-3 py-1 rounded text-xs font-semibold capitalize border transition ${
                          newSchedBrowsers.includes(b)
                            ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                            : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/5">
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition">
                  Activate Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSchedule(false)}
                  className="px-4 py-2 bg-slate-800 border border-white/10 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {schedules.map((s) => (
          <div key={s.id} className="glass-panel p-5 rounded-2xl shadow-xl flex flex-col justify-between dark:bg-slate-900/40 bg-white/85 dark:border-white/5 border-indigo-100 border hover:shadow-indigo-500/10 transition-all duration-200">
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-extrabold dark:text-white text-gray-900 text-base truncate">{s.name}</h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                  <RefreshCw className="w-3 h-3" /> Active
                </span>
              </div>
              
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="dark:text-slate-300 text-gray-700 font-mono">{s.cron_expression}</span>
                </div>
                <div className="flex items-center gap-2 dark:text-slate-300 text-gray-700">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="capitalize">{s.browsers?.join(", ") || "chromium"}</span>
                </div>
                <div className="flex items-center gap-2 dark:text-slate-300 text-gray-700">
                  <span className="text-[10px] uppercase font-bold text-slate-500 w-3.5 text-center">ENV</span>
                  <span>{s.environment}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-5 pt-3 border-t dark:border-white/5 border-gray-200">
              <span className="text-[10px] text-slate-500 font-mono">ID: {s.id}</span>
              {(currentUser?.role === "Administrator" || currentUser?.role === "QA Engineer") && (
                <button
                  onClick={() => handleDeleteSchedule(s.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 transition"
                  title="Remove Schedule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {schedules.length === 0 && (
          <div className="col-span-full py-16 text-center dark:text-slate-500 text-gray-500 glass-panel dark:bg-slate-900/40 bg-white/80 dark:border-white/5 border-gray-200 border rounded-2xl p-6">
            No background runner schedules configured.
          </div>
        )}
      </div>
    </div>
  );
}
