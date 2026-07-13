export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8080";

export function wsUrl(executionId) {
  const base = API_BASE.replace("http://", "ws://").replace("https://", "wss://");
  return `${base}/api/v1/ws/executions/${executionId}`;
}

const STORAGE_KEYS = {
  TOKEN: "ai_qa_token",
  USER: "ai_qa_user",
};

export const api = {
  // Token & User Store Helpers
  getToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  },
  setToken(token) {
    if (token) localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    else localStorage.removeItem(STORAGE_KEYS.TOKEN);
  },
  getUser() {
    try {
      if (!this.getToken()) return null;
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
  setUser(user) {
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.USER);
  },
  logout() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
  isAuthenticated() {
    return !!this.getToken();
  },

  // Base HTTP Request Wrapper
  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = { ...options.headers };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      if (response.status === 401) {
        this.logout();
        window.location.href = "/auth";
        throw new Error("Unauthorized");
      }
      
      const errorText = await response.text();
      let errorJson = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // Not JSON
      }
      const errorMsg = errorJson?.detail || errorJson?.message || errorText || "Request failed";
      throw new Error(errorMsg);
    }

    return response.json();
  },

  // --- Auth Endpoints (Handled by Supabase in AuthContext now) ---

  async getMe() {
    const user = await this.request("/api/v1/auth/me");
    this.setUser(user);
    return user;
  },

  // --- Projects Endpoints ---
  async getProjects() {
    return this.request("/api/v1/projects");
  },

  async createProject(name, description) {
    return this.request("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  },

  async deleteProject(projectId) {
    return this.request(`/api/v1/projects/${projectId}`, {
      method: "DELETE",
    });
  },

  // --- Suites Endpoints ---
  async getSuites(projectId) {
    return this.request(`/api/v1/projects/${projectId}/suites`);
  },

  async createSuite(projectId, name, description) {
    return this.request(`/api/v1/projects/${projectId}/suites`, {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  },

  async deleteSuite(suiteId) {
    return this.request(`/api/v1/suites/${suiteId}`, {
      method: "DELETE",
    });
  },

  // --- Test Cases Endpoints ---
  async getTestCases(suiteId) {
    return this.request(`/api/v1/suites/${suiteId}/cases`);
  },

  async createTestCase(suiteId, name, steps, description) {
    return this.request(`/api/v1/suites/${suiteId}/cases`, {
      method: "POST",
      body: JSON.stringify({ name, steps, description }),
    });
  },

  async updateTestCase(caseId, name, steps, description) {
    return this.request(`/api/v1/cases/${caseId}`, {
      method: "PUT",
      body: JSON.stringify({ name, steps, description }),
    });
  },

  async deleteTestCase(caseId) {
    return this.request(`/api/v1/cases/${caseId}`, {
      method: "DELETE",
    });
  },

  // --- SWR Fetcher ---
  async fetcher(url) {
    return this.request(url);
  },

  // --- Analytics ---

  async getRuns(limit = 50) {
    return this.request(`/api/v1/runs?limit=${limit}`);
  },

  // --- Schedules Endpoints ---
  async getSchedules() {
    return this.request("/api/v1/schedules");
  },

  async createSchedule({ name, cron_expression, project_id, suite_id, environment = "Production", browsers = [], devices = [] }) {
    return this.request("/api/v1/schedules", {
      method: "POST",
      body: JSON.stringify({
        name,
        cron_expression,
        project_id,
        suite_id,
        environment,
        browsers,
        devices,
      }),
    });
  },

  async deleteSchedule(scheduleId) {
    return this.request(`/api/v1/schedules/${scheduleId}`, {
      method: "DELETE",
    });
  },

  // --- Execution & AI Endpoints ---
  async runMultiTest({ test_name, base_url, steps, browsers, devices, environment = "Production", project_id, suite_id = null, test_case_id = null }) {
    return this.request("/api/v1/executions/run-multi-test", {
      method: "POST",
      body: JSON.stringify({
        test_name,
        base_url,
        steps,
        browsers,
        devices,
        environment,
        project_id,
        suite_id,
        test_case_id,
      }),
    });
  },
  // MVP Legacy / AI support routes
  async generateSuite(prompt, baseUrl) {
    return this.request("/api/v1/ai/generate-suite", {
      method: "POST",
      body: JSON.stringify({ prompt, base_url: baseUrl }),
    });
  },

  async runSuiteAndSaveReport(suite, suiteId, baseUrl, browser = "chromium", headless = true) {
    return this.request("/api/v1/ai/run-suite-and-save-report", {
      method: "POST",
      body: JSON.stringify({
        suite,
        suite_id: suiteId,
        base_url: baseUrl,
        browser,
        headless,
      }),
    });
  },

  async getRunDetails(runId) {
    return this.request(`/api/v1/executions/${runId}`);
  },

  async getExecutionTrace(runId) {
    return this.request(`/api/v1/executions/${runId}/trace`);
  },

  async getExecutionPlan(runId) {
    return this.request(`/api/v1/executions/${runId}/plan`);
  },

  // --- Autonomous Discovery & AI ---
  async crawlWebsite(projectId, baseUrl, maxDepth = 2) {
    return this.request(`/api/v1/discovery/crawl/${projectId}?base_url=${encodeURIComponent(baseUrl)}&max_depth=${maxDepth}`, {
      method: "POST"
    });
  },

  async generateAutonomousFlows(projectId, targetUrl) {
    return this.request(`/api/v1/discovery/generate-flows/${projectId}?base_url=${encodeURIComponent(targetUrl)}`, {
      method: "POST"
    });
  },

  async getDiscoveredFlows(projectId) {
    return this.request(`/api/v1/discovery/flows/${projectId}`);
  },

  async generatePlaywrightCode(suiteName, url, steps) {
    return this.request("/api/v1/ai/generate-playwright", {
      method: "POST",
      body: JSON.stringify({ suiteName, url, steps }),
    });
  },

  async generateRawCode(url, instructions, framework) {
    return this.request("/api/v1/ai/generate-raw-code", {
      method: "POST",
      body: JSON.stringify({ url, instructions, framework }),
    });
  },

  async executeRawCode(code, framework) {
    return this.request("/api/v1/ai/execute-raw-code", {
      method: "POST",
      body: JSON.stringify({ code, framework }),
    });
  },

  // -------------------------
  // Autonomous QA
  // -------------------------
  triggerAutonomousQA(payload) {
    return this.request("/api/v1/autonomous/run", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
