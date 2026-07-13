import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Edit2, Play, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

export default function TestCases() {
  const { currentUser } = useAuth();
  const { activeProject, activeSuite, testCases, setTestCases, activeCase, setActiveCase } = useData();
  const { triggerToast } = useToast();
  const navigate = useNavigate();

  const [isAddingCase, setIsAddingCase] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");
  const [newCaseSteps, setNewCaseSteps] = useState([{ action: "goto", selector: "", value: "", step_index: 0 }]);
  const [expandedCases, setExpandedCases] = useState({});

  const toggleCase = (id) => {
    setExpandedCases((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateCaseStepField = (index, field, value) => {
    const updated = [...newCaseSteps];
    updated[index][field] = value;
    setNewCaseSteps(updated);
  };

  const addCaseStepRow = () => {
    setNewCaseSteps([...newCaseSteps, { action: "goto", selector: "", value: "", step_index: newCaseSteps.length }]);
  };

  const deleteCaseStepRow = (index) => {
    const filtered = newCaseSteps.filter((_, idx) => idx !== index);
    const reindexed = filtered.map((s, idx) => ({ ...s, step_index: idx }));
    setNewCaseSteps(reindexed);
  };

  const handleCreateTestCase = async (e) => {
    e.preventDefault();
    if (!activeSuite || !newCaseName.trim()) return;
    try {
      const tcase = await api.createTestCase(activeSuite.id, newCaseName, newCaseSteps, newCaseDesc);
      setTestCases([...testCases, tcase]);
      setActiveCase(tcase);
      setNewCaseName("");
      setNewCaseDesc("");
      setNewCaseSteps([{ action: "goto", selector: "", value: "", step_index: 0 }]);
      setIsAddingCase(false);
      triggerToast(`Test Case "${tcase.name}" added.`);
    } catch (err) {
      triggerToast("Create test case failed: " + err.message, true);
    }
  };

  const handleDeleteTestCase = async (caseId) => {
    if (!window.confirm("Are you sure you want to delete this test case?")) return;
    try {
      await api.deleteTestCase(caseId);
      setTestCases(testCases.filter((c) => c.id !== caseId));
      if (activeCase?.id === caseId) {
        setActiveCase(null);
      }
      triggerToast("Test Case deleted.");
    } catch (err) {
      triggerToast("Delete case failed: " + err.message, true);
    }
  };

  if (!activeSuite) {
    return (
      <div className="py-16 text-center dark:text-slate-500 text-gray-500 glass-panel dark:bg-slate-900/40 bg-white/80 dark:border-white/5 border-gray-200 border rounded-2xl p-6">
        Please select an active Test Suite first to manage its Test Cases.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold dark:text-white text-gray-900 tracking-tight">Test Cases Space</h2>
          <p className="dark:text-slate-400 text-gray-600 text-sm">
            Managing cases for Suite: <span className="text-cyan-400 dark:text-cyan-300 font-semibold">{activeSuite.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddingCase(!isAddingCase)}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            <span>Create Test Case</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAddingCase && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleCreateTestCase} className="glass-panel p-5 rounded-2xl shadow-xl space-y-4 dark:border-white/5 border-indigo-100 border dark:bg-slate-900/40 bg-white/85">
              <h3 className="text-sm font-bold dark:text-white text-gray-900">Create Test Case</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Case Name</label>
                  <input
                    type="text"
                    required
                    value={newCaseName}
                    onChange={(e) => setNewCaseName(e.target.value)}
                    placeholder="e.g. Verify Login Flow"
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Brief Description</label>
                  <input
                    type="text"
                    value={newCaseDesc}
                    onChange={(e) => setNewCaseDesc(e.target.value)}
                    placeholder="Optional description"
                    className="w-full px-3 py-2 text-xs glass-input rounded-xl dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all duration-150"
                  />
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Execution Steps</label>
                {newCaseSteps.map((step, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                   <span className="w-6 h-6 flex items-center justify-center dark:bg-indigo-900/40 bg-indigo-100 dark:text-indigo-300 text-indigo-700 rounded-full text-[10px] font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <select
                      value={step.action}
                      onChange={(e) => updateCaseStepField(idx, "action", e.target.value)}
                      className="w-32 glass-input rounded-lg text-xs py-1.5 px-2 dark:text-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-150"
                    >
                      <option value="goto">Navigate (goto)</option>
                      <option value="click">Click</option>
                      <option value="fill">Type (fill)</option>
                      <option value="assert_text">Assert Text</option>
                      <option value="assert_visible">Assert Visible</option>
                    </select>
                    <input
                      type="text"
                      placeholder={step.action === "goto" ? "URL (e.g., https://...)" : "CSS/XPath Selector"}
                      value={step.action === "goto" ? step.url || "" : step.selector || ""}
                      onChange={(e) => updateCaseStepField(idx, step.action === "goto" ? "url" : "selector", e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs glass-input rounded-lg dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-150"
                    />
                    <input
                      type="text"
                      placeholder="Value (if required)"
                      value={step.value || ""}
                      onChange={(e) => updateCaseStepField(idx, "value", e.target.value)}
                      className="w-1/4 px-3 py-1.5 text-xs glass-input rounded-lg dark:text-white text-gray-900 dark:placeholder-slate-500 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => deleteCaseStepRow(idx)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-md transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addCaseStepRow}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Step
                </button>
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/5">
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition">
                  Save Test Case
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCase(false)}
                  className="px-4 py-2 bg-slate-800 border border-white/10 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {testCases.map((tc) => {
          const isExpanded = expandedCases[tc.id];
          return (
            <div key={tc.id} className="glass-panel rounded-xl overflow-hidden shadow-xl dark:border-white/5 border-indigo-100 border dark:bg-slate-900/40 bg-white/85 transition-all duration-200 hover:shadow-indigo-500/10">
              <div 
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] transition"
                onClick={() => toggleCase(tc.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-white text-gray-900 text-sm">{tc.name}</h4>
                    {tc.description && <p className="text-[10px] dark:text-slate-400 text-gray-500 mt-0.5">{tc.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded dark:bg-cyan-500/10 bg-cyan-50 dark:text-cyan-400 text-cyan-700 dark:border-cyan-500/25 border-cyan-200 border font-bold uppercase tracking-wide">
                    {tc.steps?.length || 0} steps
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setActiveCase(tc); 
                        navigate("/execution");
                      }}
                      className={`p-1.5 rounded-md transition ${activeCase?.id === tc.id ? "text-cyan-400 bg-cyan-500/10" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                      title="Run Test Case"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    {(currentUser?.role === "Administrator" || currentUser?.role === "QA Engineer") && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTestCase(tc.id); }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                        title="Delete Case"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button className="p-1 text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 bg-slate-950/50 border-t border-white/5">
                  <h5 className="text-[10px] dark:text-slate-500 text-gray-500 font-bold uppercase tracking-wider mb-2">Test Script Structure</h5>
                  <div className="space-y-1.5">
                    {tc.steps && tc.steps.length > 0 ? (
                      tc.steps.map((step, idx) => (
                        <div key={idx} className="flex gap-3 text-xs p-2 rounded-lg bg-slate-900 border border-white/5 items-center">
                          <span className="w-5 h-5 flex items-center justify-center bg-slate-800 text-[10px] text-slate-400 rounded-full font-mono shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-indigo-400 uppercase tracking-wide w-20">{step.action}</span>
                          <span className="dark:text-slate-300 text-gray-700 font-mono flex-1 truncate">
                            {step.action === "goto" ? step.url : step.selector}
                          </span>
                          {step.value && (
                            <span className="px-2 py-0.5 bg-slate-800 text-cyan-300 rounded text-[10px]">
                              Value: {step.value}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">No execution steps configured.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {testCases.length === 0 && (
          <div className="col-span-full py-16 text-center dark:text-slate-500 text-gray-500 glass-panel dark:bg-slate-900/40 bg-white/80 dark:border-white/5 border-gray-200 border rounded-2xl p-6">
            No test cases found in this suite.
          </div>
        )}
      </div>
    </div>
  );
}
