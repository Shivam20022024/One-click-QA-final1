import React, { useState } from "react";
import { motion } from "framer-motion";
import { Cpu, AlertTriangle, User, Globe, Key, RefreshCw, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function AuthPage() {
  const { login, signup, authLoading } = useAuth();
  
  const [authEmail, setAuthEmail] = useState("admin@testplatform.ai");
  const [authPassword, setAuthPassword] = useState("admin123");
  const [authName, setAuthName] = useState("");
  const [authRole, setAuthRole] = useState("QA Engineer");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isSignUp) {
        await signup(authEmail, authPassword, authName, authRole);
        setIsSignUp(false);
      } else {
        await login(authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[#070b13] p-4 relative overflow-hidden text-slate-100">
      {/* Glowing backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md glass-panel-heavy rounded-3xl p-8 relative shadow-2xl glow-indigo border border-white/10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-indigo-600 to-cyan-500 rounded-2xl shadow-lg shadow-indigo-500/20 mb-3 animate-float">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            NovaTest AI
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Autonomous AI QA Orchestration Platform
          </p>
        </div>

        {authError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full pl-10 pr-4 py-2 text-sm glass-input rounded-xl focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-2 text-sm glass-input rounded-xl bg-slate-900 border border-white/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 text-sm glass-input rounded-xl bg-slate-900 border border-white/10"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Platform Role</label>
              <select
                value={authRole}
                onChange={(e) => setAuthRole(e.target.value)}
                className="w-full px-3 py-2 text-sm glass-input rounded-xl bg-slate-950 border border-white/10"
              >
                <option value="Administrator">Administrator</option>
                <option value="QA Engineer">QA Engineer</option>
                <option value="Product Owner">Product Owner</option>
                <option value="Viewer">Viewer (Read Only)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-2.5 mt-2 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-medium rounded-xl text-sm transition-all duration-300 shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {authLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isSignUp ? (
              "Create Enterprise Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {!isSignUp && (
          <div className="mt-5 p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/30 text-xs text-indigo-300">
            <div className="flex gap-2 items-start">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
              <div>
                <p className="font-semibold text-cyan-300 mb-0.5">Sandbox Admin Account Activated</p>
                <p className="text-slate-400">Use pre-provisioned developer login details:</p>
                <code className="block mt-1 font-mono text-[10px] bg-slate-950/60 p-1 rounded border border-white/5">
                  User: admin@testplatform.ai <br /> Pass: admin123
                </code>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
          >
            {isSignUp ? "Already have an account? Sign In" : "Need an enterprise account? Create one"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
