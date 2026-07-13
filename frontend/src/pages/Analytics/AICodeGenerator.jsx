import React, { useState } from "react";
import { Code2, PlayCircle, Link as LinkIcon, RefreshCw, Copy, Download, Terminal } from "lucide-react";
import { api } from "../../utils/api";
import { useToast } from "../../contexts/ToastContext";

export default function AICodeGenerator() {
  const { triggerToast } = useToast();

  const [aiPrompt, setPrompt] = useState("Login as a premium user, add shoes to the cart, and verify the total is $50");
  const [aiUrl, setUrl] = useState("");
  const [framework, setFramework] = useState("playwright");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState("");

  const handleGenerateCode = async () => {
    if (!aiUrl.startsWith("http://") && !aiUrl.startsWith("https://")) {
      triggerToast("Invalid target URL. Please include http:// or https://", true);
      return;
    }
    if (!aiPrompt.trim()) {
      triggerToast("Please enter instructions for the AI", true);
      return;
    }
    setAiGenerating(true);
    setGeneratedCode("");
    setExecutionLog("");
    try {
      const data = await api.generateRawCode(aiUrl, aiPrompt, framework);
      setGeneratedCode(data.code || "");
      triggerToast("AI successfully generated automation script!");
    } catch (err) {
      triggerToast("Code Generation failed: " + err.message, true);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleExecute = async () => {
    if (!generatedCode) return;
    setExecuting(true);
    setExecutionLog("Executing in sandbox...\n");
    try {
      const data = await api.executeRawCode(generatedCode, framework);
      setExecutionLog((prev) => prev + data.output);
      if (data.success) {
        triggerToast("Sandbox execution completed successfully!", "success");
      } else {
        triggerToast("Sandbox execution failed or encountered errors.", "error");
      }
    } catch (err) {
      setExecutionLog((prev) => prev + `\nExecution Error: ${err.message}`);
      triggerToast("Sandbox execution failed: " + err.message, true);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    triggerToast("Code copied to clipboard!", "success");
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    const ext = framework === 'playwright' ? 'spec.ts' : framework === 'cypress' ? 'cy.js' : 'py';
    link.download = `test.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">AI Code Generator</h2>
        <p className="text-slate-400 text-sm">Write tests in plain English and instantly generate Playwright, Cypress, or Selenium code.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-5 bg-slate-900/40 border border-white/5 h-fit">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Code2 className="w-5 h-5 text-indigo-400" /> Instructions
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
                  className="w-full pl-10 pr-4 py-2 text-sm glass-input rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Target Framework</label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:border-indigo-500/50"
              >
                <option value="playwright">Playwright (TypeScript)</option>
                <option value="cypress">Cypress (JavaScript)</option>
                <option value="selenium">Selenium (Python)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Natural Language Test Steps</label>
              <textarea
                rows={5}
                value={aiPrompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Login as a premium user, add shoes to the cart, and verify the total is $50"
                className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-900 border border-white/10 text-white placeholder-slate-500 resize-none outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateCode}
            disabled={aiGenerating}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white rounded-xl font-bold flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition"
          >
            {aiGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Code2 className="w-5 h-5" />}
            {aiGenerating ? "Writing Code..." : "Generate Automation Code"}
          </button>
        </div>

        <div className="glass-panel p-6 rounded-2xl shadow-xl space-y-4 bg-slate-900/40 border border-white/5 flex flex-col h-full min-h-[500px]">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Generated Code
            </h3>
            {generatedCode && (
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition" title="Copy Code">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={handleDownload} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition" title="Download Script">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 bg-white rounded-xl border border-white/5 p-4 overflow-y-auto font-mono text-[12px] text-slate-800 leading-relaxed shadow-inner">
            {generatedCode ? (
              <pre className="whitespace-pre-wrap">{generatedCode}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-50">
                <Code2 className="w-10 h-10" />
                <span>Script will be displayed here</span>
              </div>
            )}
          </div>

          {generatedCode && (
            <button
              onClick={handleExecute}
              disabled={executing || framework !== 'playwright'}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 border border-white/10 disabled:opacity-50 transition mt-2"
              title={framework !== 'playwright' ? "Sandbox execution only supports Playwright currently" : ""}
            >
              {executing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className={`w-4 h-4 ${framework === 'playwright' ? 'text-emerald-400' : 'text-slate-500'}`} />}
              {executing ? "Executing Sandbox Run..." : framework !== 'playwright' ? "Execution Unsupported for " + framework : "Execute Sandbox Run"}
            </button>
          )}

          {executionLog && (
            <div className="mt-4 bg-slate-50 rounded-xl border border-white/10 p-3 overflow-y-auto max-h-48 font-mono text-[10px] text-slate-800 shadow-inner">
              <div className="flex items-center gap-2 text-slate-500 mb-2 border-b border-slate-200 pb-2">
                <Terminal className="w-4 h-4" /> Sandbox Console
              </div>
              <pre className="whitespace-pre-wrap">{executionLog}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
