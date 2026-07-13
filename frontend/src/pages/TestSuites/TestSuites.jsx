import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Layers, BookOpen } from "lucide-react";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.30, delay, ease: "easeOut" },
});

export default function TestSuites() {
  const { currentUser } = useAuth();
  const { suites, setSuites, activeSuite, setActiveSuite, activeProject } = useData();
  const { triggerToast } = useToast();

  const [isAddingSuite, setIsAddingSuite] = useState(false);
  const [newSuiteName, setNewSuiteName] = useState("");
  const [newSuiteDesc, setNewSuiteDesc] = useState("");

  const handleCreateSuite = async (e) => {
    e.preventDefault();
    if (!newSuiteName.trim() || !activeProject) return;
    try {
      const suite = await api.createSuite(activeProject.id, newSuiteName, newSuiteDesc);
      setSuites([...suites, suite]);
      setActiveSuite(suite);
      setNewSuiteName("");
      setNewSuiteDesc("");
      setIsAddingSuite(false);
      triggerToast(`Suite "${suite.name}" created.`);
    } catch (err) {
      triggerToast("Create suite failed: " + err.message, true);
    }
  };

  const handleDeleteSuite = async (suiteId) => {
    if (!window.confirm("Delete this suite and all its test cases?")) return;
    try {
      await api.deleteSuite(suiteId);
      const filtered = suites.filter((s) => s.id !== suiteId);
      setSuites(filtered);
      if (activeSuite?.id === suiteId) setActiveSuite(filtered[0] || null);
      triggerToast("Suite deleted.");
    } catch (err) {
      triggerToast("Delete failed: " + err.message, true);
    }
  };

  if (!activeProject) {
    return (
      <div className="glass-panel rounded-2xl p-16 flex flex-col items-center justify-center text-center"
        style={{ border: "1px dashed var(--border-input)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 animate-float"
          style={{ background: "var(--bg-badge)" }}>
          <Layers className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
        </div>
        <h3 className="text-base font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          No active project
        </h3>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Select or create a Project first to manage its Test Suites.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp(0)} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full inline-block mb-1.5"
            style={{ background: "var(--bg-badge)", color: "#6366f1" }}>
            {suites.length} Suite{suites.length !== 1 ? "s" : ""} · {activeProject.name}
          </span>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight gradient-text">Test Suites Space</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Manage logical groups of test cases for&nbsp;
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {activeProject.name}
            </span>.
          </p>
        </div>
        <button onClick={() => setIsAddingSuite(!isAddingSuite)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" />
          <span>Create Suite</span>
        </button>
      </motion.div>

      <AnimatePresence>
        {isAddingSuite && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <form onSubmit={handleCreateSuite}
              className="glass-panel p-6 rounded-2xl space-y-4 max-w-xl"
              style={{ border: "1px solid var(--border-input)" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                New Suite for {activeProject.name}
              </h3>
              <div className="grid gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--text-muted)" }}>Suite Name</label>
                  <input type="text" required value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    placeholder="e.g. Critical Regression Suite"
                    className="w-full px-3 py-2.5 text-sm glass-input rounded-xl" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--text-muted)" }}>Description</label>
                  <textarea rows={3} value={newSuiteDesc}
                    onChange={(e) => setNewSuiteDesc(e.target.value)}
                    placeholder="Which features does this suite validate..."
                    className="w-full px-3 py-2.5 text-sm glass-input rounded-xl resize-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">Create Suite</button>
                <button type="button" onClick={() => setIsAddingSuite(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suites.map((s, i) => {
          const isActive = activeSuite?.id === s.id;
          return (
            <motion.div key={s.id} {...fadeUp(0.05 * i)}
              className="glass-panel card-lift rounded-2xl p-5 flex flex-col justify-between relative"
              style={{
                border: isActive ? "1.5px solid #6366f1" : "1px solid var(--border-subtle)",
                boxShadow: isActive ? "0 0 0 3px rgba(99,102,241,0.12), var(--shadow-card)" : "var(--shadow-card)",
              }}
            >
              {isActive && (
                <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl"
                  style={{ background: "linear-gradient(90deg,#6366f1,#06b6d4)" }} />
              )}

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: isActive ? "rgba(99,102,241,0.12)" : "var(--bg-badge)" }}>
                      <Layers className="w-4 h-4" style={{ color: isActive ? "#6366f1" : "var(--text-muted)" }} />
                    </div>
                    <h3 className="font-extrabold text-base truncate" style={{ color: "var(--text-primary)" }}>
                      {s.name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase shrink-0"
                    style={{ background: "var(--bg-badge)", color: "#6366f1" }}>
                    SUITE-{s.id}
                  </span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-3 min-h-[48px]"
                  style={{ color: "var(--text-muted)" }}>
                  {s.description || "No description provided. Add one to help your team understand this suite's scope."}
                </p>
              </div>

              <div className="flex justify-between items-center mt-5 pt-3"
                style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button onClick={() => setActiveSuite(s)}
                  className="text-xs font-bold transition-all duration-150"
                  style={{ color: isActive ? "#6366f1" : "var(--text-muted)" }}>
                  {isActive ? "✓ Active Suite" : "Set as Active"}
                </button>
                {(currentUser?.role === "Administrator" || currentUser?.role === "QA Engineer") && (
                  <button onClick={() => handleDeleteSuite(s.id)}
                    className="p-1.5 rounded-lg transition-all duration-150 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500"
                    style={{ color: "var(--text-muted)" }} title="Delete Suite">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}

        {suites.length === 0 && (
          <motion.div {...fadeUp(0.05)}
            className="col-span-full glass-panel rounded-2xl p-16 flex flex-col items-center justify-center text-center"
            style={{ border: "1px dashed var(--border-input)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 animate-float"
              style={{ background: "var(--bg-badge)" }}>
              <BookOpen className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              No test suites yet
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
              Create your first suite in <strong>{activeProject.name}</strong> to start grouping test cases.
            </p>
            <button onClick={() => setIsAddingSuite(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create First Suite
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
