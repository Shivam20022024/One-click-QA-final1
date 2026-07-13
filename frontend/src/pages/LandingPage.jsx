import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bot, TestTube, Zap, Activity, ChevronRight } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#090d16] text-white overflow-hidden flex flex-col relative">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="w-full flex items-center justify-between p-6 z-10 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Bot className="w-8 h-8 text-indigo-400" />
          <span className="text-2xl font-bold tracking-tight">NovaTest AI</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/auth')} className="text-slate-300 hover:text-white transition">Sign In</button>
          <button onClick={() => navigate('/auth')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition shadow-[0_0_15px_rgba(79,70,229,0.3)]">Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 z-10 pb-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 mb-8"
        >
          <Zap className="w-4 h-4" />
          <span className="text-sm font-medium">Autonomous AI QA Orchestration Platform</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl leading-tight mb-6"
        >
          Transform manual QA into <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">Autonomous Execution</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10"
        >
          Enter your website URL, describe what you want to test in plain English, and our 20+ agent AI swarm handles the rest. Generation, execution, and self-healing.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button onClick={() => navigate('/auth')} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-[0_0_20px_rgba(79,70,229,0.4)]">
            Start Free Trial <ChevronRight className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 glass-panel hover:bg-slate-800/50 text-white px-8 py-4 rounded-xl font-semibold text-lg transition">
            <TestTube className="w-5 h-5" /> View Demo
          </button>
        </motion.div>

        {/* Stats / Proof */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl w-full border-t border-white/10 pt-10"
        >
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white mb-2">10x</span>
            <span className="text-sm text-slate-400">Faster Generation</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white mb-2">99%</span>
            <span className="text-sm text-slate-400">Self-Healing Accuracy</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white mb-2">20+</span>
            <span className="text-sm text-slate-400">Specialized AI Agents</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-4xl font-bold text-white mb-2">0</span>
            <span className="text-sm text-slate-400">Lines of Code Needed</span>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default LandingPage;
