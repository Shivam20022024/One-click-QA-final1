import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Loader2, Save, Link2, TestTube } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../utils/api";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.30, delay, ease: "easeOut" },
});

export default function Settings() {
  const { activeProject } = useData();
  const { triggerToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState({
    baseUrl: "", email: "", apiToken: "", projectKey: "", issueType: "Bug", isActive: true,
  });

  const [health, setHealth] = useState(null);

  useEffect(() => {
    if (activeProject) {
      loadConfig();
      loadHealth();
    }
  }, [activeProject]);

  const loadHealth = async () => {
    try {
      const data = await api.request(`/api/v1/jira/health?projectId=${activeProject.id}`);
      if (data) setHealth(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await api.request(`/api/v1/jira/config?projectId=${activeProject.id}`);
      if (data) setConfig({ baseUrl: data.baseUrl || "", email: data.email || "", apiToken: data.apiToken || "", projectKey: data.projectKey || "", issueType: data.issueType || "Bug", isActive: data.isActive });
    } catch (err) {
      triggerToast("Failed to load Jira config", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setConfig({ ...config, [e.target.name]: value });
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.request("/api/v1/jira/save", { method: "POST", body: JSON.stringify({ ...config, projectId: activeProject.id }) });
      triggerToast("Jira configuration saved successfully", "success");
      loadConfig();
      loadHealth();
    } catch (err) {
      triggerToast("Failed to save Jira configuration", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await api.request("/api/v1/jira/test", { method: "POST", body: JSON.stringify({ ...config, projectId: activeProject.id }) });
      if (res.success) triggerToast("Connection to Jira successful!", "success");
      loadHealth();
    } catch (err) {
      triggerToast(err.message || "Connection to Jira failed", "error");
    } finally {
      setTesting(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 text-sm glass-input rounded-xl";

  if (!activeProject) {
    return (
      <div className="glass-panel rounded-2xl p-16 flex flex-col items-center justify-center text-center"
        style={{ border: "1px dashed var(--border-input)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 animate-float"
          style={{ background: "var(--bg-badge)" }}>
          <Link2 className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Select an active Project to manage its settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <motion.div {...fadeUp(0)}>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full inline-block mb-1.5"
          style={{ background: "var(--bg-badge)", color: "#6366f1" }}>
          {activeProject.name}
        </span>
        <h1 className="text-3xl font-black tracking-tight gradient-text">Project Settings</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Configure integrations and automations for this workspace.
        </p>
      </motion.div>

      <motion.div {...fadeUp(0.1)}
        className="glass-panel card-lift rounded-2xl p-6"
        style={{ border: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-4 mb-6 pb-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(59,130,246,0.10)" }}>
            <Link2 className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Jira Integration
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Automatically create bug reports for failed test executions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-4">
            {[
              { label: "Jira Base URL", name: "baseUrl", type: "text", placeholder: "https://your-domain.atlassian.net" },
              { label: "Account Email", name: "email", type: "email", placeholder: "you@company.com" },
              { label: "API Token", name: "apiToken", type: "password", placeholder: "Paste your Jira API token" },
            ].map(({ label, name, type, placeholder }) => (
              <div key={name}>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "var(--text-muted)" }}>{label}</label>
                <input type={type} name={name} value={config[name]} onChange={handleChange}
                  placeholder={placeholder} className={inputClass} />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {[
              { label: "Project Key", name: "projectKey", type: "text", placeholder: "e.g. QA, ENG" },
              { label: "Issue Type", name: "issueType", type: "text", placeholder: "e.g. Bug" },
            ].map(({ label, name, type, placeholder }) => (
              <div key={name}>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: "var(--text-muted)" }}>{label}</label>
                <input type={type} name={name} value={config[name]} onChange={handleChange}
                  placeholder={placeholder} className={inputClass} />
              </div>
            ))}
            <div className="flex items-center gap-3 mt-2 pt-2">
              <input type="checkbox" id="isActive" name="isActive" checked={config.isActive}
                onChange={handleChange}
                className="w-4 h-4 rounded accent-indigo-500" />
              <label htmlFor="isActive" className="text-sm font-semibold cursor-pointer"
                style={{ color: "var(--text-primary)" }}>
                Enable Integration
              </label>
            </div>
          </div>
        </div>
        
        {health && (
          <div className="mt-6 p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>Health Check</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Jira Connected</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <div className={`w-2 h-2 rounded-full ${health.jiraConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  {health.jiraConnected ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Auth Status</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <div className={`w-2 h-2 rounded-full ${health.authenticationStatus === 'Valid' ? 'bg-green-500' : 'bg-red-500'}`} />
                  {health.authenticationStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--text-muted)" }}>Project Verified</span>
                <span className="flex items-center gap-1.5 font-medium">
                  <div className={`w-2 h-2 rounded-full ${health.projectVerified ? 'bg-green-500' : (health.jiraConnected ? 'bg-yellow-500' : 'bg-red-500')}`} />
                  {health.projectVerified ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between col-span-2">
                <span style={{ color: "var(--text-muted)" }}>Available Projects</span>
                <span className="font-medium truncate max-w-xs text-right">
                  {health.availableProjects?.map(p => p.key).join(', ') || 'None'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-6 pt-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <button
            onClick={handleTest}
            disabled={testing || !config.baseUrl || !config.apiToken}
            className="btn-ghost"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
            Test Connection
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !config.baseUrl || !config.apiToken}
            className="btn-primary ml-auto"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Configuration
          </button>
        </div>
      </motion.div>
    </div>
  );
}
