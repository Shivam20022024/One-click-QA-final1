import React, { useState } from "react";
import { Wand2, PlayCircle, Link as LinkIcon, RefreshCw } from "lucide-react";
import { api } from "../../utils/api";
import { useData } from "../../contexts/DataContext";
import { useToast } from "../../contexts/ToastContext";

export default function AIBuilder() {
  const { activeSuite, loadTestCases } = useData();
  const { triggerToast } = useToast();

  const [aiPrompt, setPrompt] = useState("Verify login flows, account page details, and checkout verification on the site.");
  const [aiUrl, setUrl] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedSuiteResponse, setGeneratedSuiteResponse] = useState(null);
  const [legacyRunning, setLegacyRunning] = useState(false);

  const handleAIGenerateSuite = async () => {
    if (!aiUrl.startsWith("http://") && !aiUrl.startsWith("https://")) {
      triggerToast("Invalid target URL. Please include http:// or https://", true);
      return;
    }
    setAiGenerating(true);
    setGeneratedSuiteResponse(null);
    try {
      const data = await api.generateSuite(aiPrompt, aiUrl);
      setGeneratedSuiteResponse(data);
      triggerToast("AI successfully created the test suite structure.");
      
      if (data?.test_suite?.tests && activeSuite) {
        for (const t of data.test_suite.tests) {
          await api.createTestCase(activeSuite.id, t.test_name, t.steps, t.feature);
        }
        loadTestCases(activeSuite.id);
        triggerToast(`Auto-imported ${data.test_suite.tests.length} cases into ${activeSuite.name}`);
      }
    } catch (err) {
      triggerToast("AI Generation failed: " + err.message, true);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleLegacyRunSuite = async () => {
    if (!generatedSuiteResponse) return;
    setLegacyRunning(true);
    
    const suiteId = `suite_${Date.now()}`;
    try {
      await api.runSuiteAndSaveReport(
        generatedSuiteResponse,
        suiteId,
        aiUrl,
        "chromium",
        true
      );
      triggerToast("AI Suite run succeeded! Check dashboard for reports.");
    } catch (err) {
      triggerToast("AI run failed: " + err.message, true);
    } finally {
      setLegacyRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">AI Suite Generator</h2>
        <p className="text-slate-400 text-sm">Use natural language to automatically generate executable Playwright test cases.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-5 bg-slate-900/40 border border-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Wand2 className="w-5 h-5 text-violet-400" /> Generation Prompt
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Target Web Application URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="url"
                  value={aiUrl}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://app.example.com"
                  className="w-full pl-10 pr-4 py-2 text-sm glass-input rounded-xl bg-slate-900 border border-white/10"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Natural Language Instructions</label>
              <textarea
                rows={4}
                value={aiPrompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what the AI should test..."
                className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 border border-white/10 resize-none"
              />
            </div>
            
            {!activeSuite && (
              <p className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 p-2 rounded">
                Note: No active Test Suite selected. Cases will be generated but not auto-saved to the database.
              </p>
            )}
          </div>

          <button
            onClick={handleAIGenerateSuite}
            disabled={aiGenerating}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-violet-600/20 disabled:opacity-50 transition"
          >
            {aiGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
            {aiGenerating ? "AI is reasoning..." : "Generate Test Suite"}
          </button>
        </div>

        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4 bg-slate-900/40 border border-white/5 flex flex-col">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            Generated Output
          </h3>

          <div className="flex-1 bg-slate-950/60 rounded-xl border border-white/5 p-4 overflow-y-auto font-mono text-[10px] text-slate-300">
            {generatedSuiteResponse ? (
              <pre className="whitespace-pre-wrap">{JSON.stringify(generatedSuiteResponse, null, 2)}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3 opacity-50">
                <Wand2 className="w-10 h-10" />
                <span>Generated JSON structure will appear here</span>
              </div>
            )}
          </div>

          {generatedSuiteResponse && (
            <button
              onClick={handleLegacyRunSuite}
              disabled={legacyRunning}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 border border-white/10 disabled:opacity-50 transition mt-2"
            >
              {legacyRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4 text-emerald-400" />}
              {legacyRunning ? "Executing Sandbox Run..." : "Run Generated Suite in Sandbox"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
