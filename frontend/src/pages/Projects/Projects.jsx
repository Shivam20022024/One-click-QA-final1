import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, FolderOpen, Folders } from "lucide-react";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.30, delay, ease: "easeOut" },
});

export default function Projects() {
  const { currentUser } = useAuth();
  const { projects, setProjects, activeProject, setActiveProject } = useData();
  const { triggerToast } = useToast();

  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const proj = await api.createProject(newProjectName, newProjectDesc);
      setProjects([...projects, proj]);
      setActiveProject(proj);
      setNewProjectName("");
      setNewProjectDesc("");
      setIsAddingProject(false);
      triggerToast(`Project "${proj.name}" created.`);
    } catch (err) {
      triggerToast("Create project failed: " + err.message, true);
    }
  };

  const handleDeleteProject = async (projId) => {
    if (!window.confirm("Delete this project and all its suites?")) return;
    try {
      await api.deleteProject(projId);
      const filtered = projects.filter((p) => p.id !== projId);
      setProjects(filtered);
      if (activeProject?.id === projId) setActiveProject(filtered[0] || null);
      triggerToast("Project deleted.");
    } catch (err) {
      triggerToast("Delete failed: " + err.message, true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full inline-block mb-1.5"
            style={{ background: "var(--bg-badge)", color: "#6366f1" }}>
            {projects.length} Workspace{projects.length !== 1 ? "s" : ""}
          </span>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight gradient-text">Projects Space</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Create and organize environments, test resources, and ownership boundaries.
          </p>
        </div>
        <button
          onClick={() => setIsAddingProject(!isAddingProject)}
          className="btn-primary shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Project</span>
        </button>
      </motion.div>

      {/* Create Form */}
      <AnimatePresence>
        {isAddingProject && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreateProject}
              className="glass-panel p-6 rounded-2xl space-y-4 max-w-xl card-lift"
              style={{ border: "1px solid var(--border-input)" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Register New Workspace
              </h3>
              <div className="grid gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--text-secondary)" }}>Project Name</label>
                  <input type="text" required value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Core SaaS API Gateway"
                    className="w-full px-3 py-2.5 text-sm glass-input rounded-xl" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--text-secondary)" }}>Description</label>
                  <textarea rows={3} value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Target URLs, environment notes, owner tags..."
                    className="w-full px-3 py-2.5 text-sm glass-input rounded-xl resize-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary">Confirm</button>
                <button type="button" onClick={() => setIsAddingProject(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((p, i) => {
          const isActive = activeProject?.id === p.id;
          return (
            <motion.div
              key={p.id}
              {...fadeUp(0.05 * i)}
              className="glass-panel card-lift rounded-2xl p-5 flex flex-col justify-between relative"
              style={{
                border: isActive
                  ? "1.5px solid #6366f1"
                  : "1px solid var(--border-subtle)",
                boxShadow: isActive
                  ? "0 0 0 3px rgba(99,102,241,0.12), var(--shadow-card)"
                  : "var(--shadow-card)",
              }}
            >
              {/* Active glow accent */}
              {isActive && (
                <div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl"
                  style={{ background: "linear-gradient(90deg,#6366f1,#06b6d4)" }} />
              )}

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? "rgba(99,102,241,0.12)" : "var(--bg-badge)",
                      }}>
                      <FolderOpen className="w-4 h-4" style={{ color: isActive ? "#6366f1" : "var(--text-muted)" }} />
                    </div>
                    <h3 className="font-extrabold text-base truncate"
                      style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest shrink-0"
                    style={{ background: "var(--bg-badge)", color: "#6366f1" }}>
                    PROJ-{p.id}
                  </span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-3 min-h-[48px]"
                  style={{ color: "var(--text-secondary)" }}>
                  {p.description || "No documentation specified. Add a description to help your team understand this workspace."}
                </p>
              </div>

              <div className="flex justify-between items-center mt-5 pt-3"
                style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <button
                  onClick={() => setActiveProject(p)}
                  className="text-xs font-bold transition-all duration-150"
                  style={{ color: isActive ? "#6366f1" : "var(--text-secondary)" }}
                >
                  {isActive ? "✓ Active Workspace" : "Set as Active"}
                </button>
                {currentUser?.role === "Administrator" && (
                  <button
                    onClick={() => handleDeleteProject(p.id)}
                    className="p-1.5 rounded-lg transition-all duration-150 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500"
                    style={{ color: "var(--text-secondary)" }}
                    title="Delete Project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Empty State */}
        {projects.length === 0 && (
          <motion.div {...fadeUp(0.05)}
            className="col-span-full glass-panel rounded-2xl p-16 flex flex-col items-center justify-center text-center"
            style={{ border: "1px dashed var(--border-input)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 animate-float"
              style={{ background: "var(--bg-badge)" }}>
              <Folders className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              No projects yet
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Create your first workspace to start organizing test suites and execution environments.
            </p>
            <button onClick={() => setIsAddingProject(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Create First Project
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
