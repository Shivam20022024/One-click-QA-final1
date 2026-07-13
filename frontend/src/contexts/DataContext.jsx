import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import useSWR from "swr";

const DataContext = createContext(null);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within DataProvider");
  return context;
};

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { triggerToast } = useToast();

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  
  const [suites, setSuites] = useState([]);
  const [activeSuite, setActiveSuite] = useState(null);
  
  const [testCases, setTestCases] = useState([]);
  const [activeCase, setActiveCase] = useState(null);

  const [schedules, setSchedules] = useState([]);

  // Load Initial Data
  useEffect(() => {
    if (currentUser) {
      loadProjects();
      loadSchedules();
    } else {
      setProjects([]);
      setActiveProject(null);
      setSchedules([]);
    }
  }, [currentUser]);

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProject(data[0]);
      }
    } catch (err) {
      triggerToast("Error listing projects: " + err.message, true);
    }
  };

  useEffect(() => {
    if (activeProject) {
      loadSuites(activeProject.id);
    } else {
      setSuites([]);
      setActiveSuite(null);
    }
  }, [activeProject]);

  const loadSuites = async (projectId) => {
    try {
      const data = await api.getSuites(projectId);
      setSuites(data);
      if (data.length > 0) {
        setActiveSuite(data[0]);
      } else {
        setActiveSuite(null);
      }
    } catch (err) {
      triggerToast("Error listing suites: " + err.message, true);
    }
  };

  useEffect(() => {
    if (activeSuite) {
      loadTestCases(activeSuite.id);
    } else {
      setTestCases([]);
      setActiveCase(null);
    }
  }, [activeSuite]);

  const loadTestCases = async (suiteId) => {
    try {
      const data = await api.getTestCases(suiteId);
      setTestCases(data);
      if (data.length > 0) {
        setActiveCase(data[0]);
      } else {
        setActiveCase(null);
      }
    } catch (err) {
      triggerToast("Error listing test cases: " + err.message, true);
    }
  };

  const loadSchedules = async () => {
    try {
      const data = await api.getSchedules();
      setSchedules(data);
    } catch (err) {
      console.warn("Schedules failed to load");
    }
  };

  const value = {
    projects, setProjects, activeProject, setActiveProject, loadProjects,
    suites, setSuites, activeSuite, setActiveSuite, loadSuites,
    testCases, setTestCases, activeCase, setActiveCase, loadTestCases,
    schedules, setSchedules, loadSchedules
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
