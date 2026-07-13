import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import AuthPage from "./pages/AuthPage";
import Layout from "./components/common/Layout";
import LandingPage from "./pages/LandingPage";

import Dashboard from "./pages/Dashboard/Dashboard";
import Projects from "./pages/Projects/Projects";
import TestSuites from "./pages/TestSuites/TestSuites";
import TestCases from "./pages/TestCases/TestCases";
import Execution from "./pages/Execution/Execution";
import AutonomousQA from "./pages/Analytics/AutonomousQA";
import AICodeGenerator from "./pages/Analytics/AICodeGenerator";
import AutonomousRunner from "./pages/Execution/AutonomousRunner";
import SelfHealing from "./pages/SelfHealing/SelfHealingPage";
import Schedules from "./pages/Settings/Schedules";
import Settings from "./pages/Settings/Settings";
import ReportDetails from "./pages/Reports/ReportDetails";

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/welcome" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/welcome" element={!currentUser ? <LandingPage /> : <Navigate to="/" replace />} />
      <Route path="/auth" element={!currentUser ? <AuthPage /> : <Navigate to="/" replace />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      <Route path="/suites" element={<ProtectedRoute><TestSuites /></ProtectedRoute>} />
      <Route path="/cases" element={<ProtectedRoute><TestCases /></ProtectedRoute>} />
      <Route path="/execution" element={<ProtectedRoute><Execution /></ProtectedRoute>} />
      <Route path="/ai-builder" element={<ProtectedRoute><AutonomousQA /></ProtectedRoute>} />
      <Route path="/ai-code" element={<ProtectedRoute><AICodeGenerator /></ProtectedRoute>} />
      <Route path="/autonomous" element={<ProtectedRoute><AutonomousRunner /></ProtectedRoute>} />
      <Route path="/self-healing" element={<ProtectedRoute><SelfHealing /></ProtectedRoute>} />
      <Route path="/schedules" element={<ProtectedRoute><Schedules /></ProtectedRoute>} />
      <Route path="/reports/:runId" element={<ProtectedRoute><ReportDetails /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
}
