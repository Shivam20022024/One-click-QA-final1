import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  LayoutDashboard,
  FolderOpen,
  Layers,
  ClipboardList,
  Wand2,
  PlayCircle,
  Calendar,
  Users,
  Cpu,
  LogOut,
  Zap,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";

const sidebarItems = [
  { id: "dashboard",  path: "/",           label: "Dashboard",         icon: LayoutDashboard },
  { id: "autonomous", path: "/autonomous",  label: "One-Click QA",      icon: Zap },
  { id: "projects",   path: "/projects",    label: "Projects Space",     icon: FolderOpen },
  { id: "suites",     path: "/suites",      label: "Test Suites",        icon: Layers },
  { id: "cases",      path: "/cases",       label: "Test Cases",         icon: ClipboardList },
  { id: "live",       path: "/execution",   label: "Parallel Runner",    icon: PlayCircle },
  { id: "ai_builder", path: "/ai-builder",  label: "AI Suite Generator", icon: Wand2 },
  { id: "ai_code",    path: "/ai-code",     label: "AI Code Generator",  icon: Layers },
  { id: "healing",    path: "/self-healing",label: "Self-Healing",       icon: Wand2 },
];

export default function Layout({ children }) {
  const { currentUser, logout } = useAuth();
  const { projects, activeProject, setActiveProject } = useData();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isDark = theme === "dark";

  return (
    <div className="min-h-screen flex flex-col md:flex-row"
      style={{ background: "var(--bg-page)", color: "var(--text-primary)" }}>

      {/* ── Background decorative blobs ──────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-60"
          style={{ background: "var(--blob-1)" }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-50"
          style={{ background: "var(--blob-2)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-30"
          style={{ background: "var(--blob-3)" }} />
      </div>

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside className="relative z-10 w-full md:w-64 shrink-0 flex flex-col"
        style={{
          background: "var(--bg-sidebar)",
          boxShadow: "var(--shadow-sidebar)",
          borderRight: "1px solid var(--border-subtle)",
        }}>

        {/* Logo ------------------------------------------------ */}
        <div className="px-5 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg glow-indigo">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              {/* Live indicator */}
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2"
                style={{ borderColor: "var(--bg-sidebar)" }}>
                <span className="block w-full h-full bg-emerald-400 rounded-full animate-pulse" />
              </span>
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight gradient-text leading-tight">
                NovaTest AI
              </div>
              <div className="text-[9px] font-bold tracking-[0.14em] uppercase mt-0.5"
                style={{ color: "var(--text-secondary)" }}>
                Enterprise QA Platform
              </div>
            </div>
          </div>
        </div>

        {/* Theme Toggle ---------------------------------------- */}
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <span className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}>
            {isDark ? "Dark Mode" : "Light Mode"}
          </span>
          {/* Pill toggle */}
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
            className="theme-toggle"
          >
            <div className={`theme-toggle-thumb ${isDark ? "dark" : ""}`}>
              {isDark
                ? <Moon className="w-3 h-3 text-white" />
                : <Sun  className="w-3 h-3 text-white" />
              }
            </div>
          </button>
        </div>

        {/* Project Selector ------------------------------------ */}
        {projects.length > 0 && (
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <label className="block text-[9px] font-bold uppercase tracking-widest mb-1.5"
              style={{ color: "var(--text-secondary)" }}>
              Active Project
            </label>
            <div className="relative">
              <select
                value={activeProject?.id || ""}
                onChange={(e) => {
                  const p = projects.find((proj) => proj.id === Number(e.target.value));
                  setActiveProject(p);
                }}
                className="glass-input w-full rounded-xl py-2 pl-3 pr-8 text-xs font-semibold appearance-none focus:outline-none"
                style={{ color: "var(--text-primary)" }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: "var(--text-muted)" }} />
            </div>
          </div>
        )}

        {/* Navigation ------------------------------------------ */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {sidebarItems.map((item, i) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`nav-item flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[15px] font-semibold ${active ? "active" : ""}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                  active
                    ? "bg-indigo-100 dark:bg-indigo-500/20"
                    : "bg-transparent group-hover:bg-indigo-50"
                }`}
                  style={active ? {
                    background: "rgba(99,102,241,0.12)",
                  } : {}}>
                  <Icon className={`w-4 h-4 ${active ? "text-indigo-600" : ""}`}
                    style={!active ? { color: "var(--sidebar-text)" } : {}} />
                </div>
                <span className="truncate">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile ---------------------------------------- */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-badge)" }}>
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-extrabold text-sm text-white flex-shrink-0 shadow-md glow-indigo">
              {currentUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                {currentUser?.full_name || currentUser?.email}
              </p>
              <p className="text-[10px] truncate font-semibold" style={{ color: "var(--text-secondary)" }}>
                {currentUser?.role || "QA Engineer"}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg transition-all duration-150 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
              style={{ color: "var(--text-secondary)" }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto p-6 md:p-8 max-w-[1600px] mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
