# AI Testing Platform — Full Project Documentation

## 1. Project Overview

This project is an AI-powered UI testing platform designed to:

- Generate test cases from natural language prompts
- Build complete test suites for target web applications
- Execute tests using Playwright
- Apply self-healing selector logic when elements change
- Classify/validate failures and test intent
- Capture screenshots and logs for both passed and failed outcomes
- Provide a modern frontend interface for generation, execution, review, and report access

The platform currently has:

- A **FastAPI backend** (test generation + execution engine)
- A **React + Tailwind frontend** (SaaS-style UX for users)

---

## 2. High-Level Architecture

### 2.1 Backend

Main responsibilities:

- API endpoints for health, generation, and execution
- LLM-driven test/suite generation
- Browser automation orchestration (Playwright)
- Retry handling, healing logic, intent validation
- Artifact management (screenshots, logs, suite JSON, HTML reports)

Core stack:

- Python 3.11+
- FastAPI
- Playwright
- Pydantic
- httpx (demo/client workflows)

### 2.2 Frontend

Main responsibilities:

- Input target URL + generation prompt
- Trigger backend suite generation
- Display and filter generated tests
- Execute suite tests from UI
- Show execution status and screenshots
- Load backend-saved suites and reports

Core stack:

- React (functional components + hooks)
- Tailwind CSS
- Vite

---

## 3. Repository Structure

```text
ai-testing-platform/
├── backend/
│   ├── api/
│   │   ├── routes.py
│   │   └── ai_routes.py
│   ├── execution/
│   │   ├── runner.py
│   │   ├── actions.py
│   │   ├── self_healing.py
│   │   ├── selector_utils.py
│   │   ├── retry_handler.py
│   │   ├── decision_engine.py
│   │   └── error_classifier.py
│   ├── llm/
│   │   └── generator.py
│   ├── models/
│   │   └── schemas.py
│   ├── utils/
│   │   └── logger.py
│   ├── storage/
│   │   ├── screenshots/
│   │   ├── logs/
│   │   └── reports/
│   ├── demo_ai.py
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
└── PROJECT_FULL_DOCUMENTATION.md
```

---

## 4. Backend Detailed Design

## 4.1 FastAPI App Lifecycle

Entry: `backend/main.py`

- Creates app with startup/shutdown lifespan logging
- Ensures storage folders exist
- Registers global exception handler
- Includes API router under `/api/v1`
- Mounts static storage:
  - `/storage` -> `backend/storage`

This static mount is essential for serving screenshots and reports directly in the frontend.

## 4.2 API Surface

Primary routes:

- `GET /api/v1/health`
  - Service health endpoint

- `POST /api/v1/run-test`
  - Execute a structured test payload directly

- `POST /api/v1/ai/generate-test`
  - AI-generated single test (async job/fallback pattern)

- `POST /api/v1/ai/generate-suite`
  - AI-generated full suite
  - Persists generated suite JSON to `storage/reports/suite_*.json`

- `POST /api/v1/ai/generate-and-run`
  - Generate + execute flow or direct execution flow
  - Returns execution details

- `GET /api/v1/ai/job/{job_id}`
  - Async generation job status

- `GET /api/v1/ai/result/{job_id}`
  - Async generation job result

- `GET /api/v1/suites`
  - Lists saved suite JSON artifacts

- `GET /api/v1/reports`
  - Lists saved HTML execution reports

## 4.3 Data Models (Pydantic)

Defined in `backend/models/schemas.py`:

- `TestStep`: action-level schema (`goto`, `fill`, `click`, `assert_visible`, etc.)
- `TestRequest`: full test execution request
- `StepResult`: per-step output (status, timing, screenshot, logs, healing metadata)
- `TestRunResult`: run-level output (overall status, failed step, screenshot, warnings/errors)
- AI-generation schemas:
  - `GeneratedTestRequest`, `GeneratedTestStep`, `GeneratedTestResponse`
  - `GenerateAndRunRequest`, `GenerateAndRunResponse`

## 4.4 LLM Test/Suite Generation

Module: `backend/llm/generator.py`

Capabilities:

- Generates test suites from prompt + base URL
- Applies normalization to cope with imperfect LLM outputs
  - e.g., handles `target` fields and converts to `selector`/`url`
- Enforces schema and intent consistency:
  - `positive -> success`
  - `negative -> error`
  - `edge -> validation`
  - `e2e -> success`
- Validates step actions and assertion structure
- Applies duplicate and quality checks
- Includes deterministic fallback suite generation if AI output is invalid

## 4.5 Execution Engine

Primary modules:

- `execution/runner.py`
  - Orchestrates browser lifecycle and step execution
  - Handles retry strategy and stopping rules
  - Aggregates step results and run status
  - Captures pass/fail run screenshots

- `execution/actions.py`
  - Action handlers (`goto`, `fill`, `click`, assertions, screenshot)
  - Selector and action-specific failure classification
  - Screenshot capture utility

- `execution/self_healing.py` and related utilities
  - Selector healing and scoring
  - Memory-based and LLM-based adaptation paths

## 4.6 Screenshot Behavior

Current behavior:

- Step-level screenshots can be captured when:
  - step action is explicit screenshot
  - step sets `capture_screenshot=true`
  - step fails
- Run-level screenshot path is returned for:
  - failed tests (failure capture)
  - passed tests (post-run pass capture)

Storage and access:

- Physical location: `backend/storage/screenshots`
- API-accessible URL path: `/storage/screenshots/<file>.png`

## 4.7 Reports and Artifacts

Saved in `backend/storage/reports`:

- `suite_*.json` generated suites
- `report_*.html` execution reports

Backend list endpoints (`/api/v1/suites`, `/api/v1/reports`) provide metadata and URL for frontend usage.

---

## 5. Frontend Detailed Design

Main file: `frontend/src/App.jsx`

## 5.1 Core UX Flows

1. **Dashboard**
   - URL + prompt input
   - Generate suite action
   - Live API health indicator
   - Summary KPI cards

2. **Tests view**
   - Search + feature filter + type filter
   - Expandable cards with structured steps
   - Execution status badges
   - Screenshot preview and open-in-new-tab

3. **Suite execution from frontend**
   - Runs each generated test through backend `/api/v1/ai/generate-and-run`
   - Persists execution results in-memory map per test card
   - Displays run-level and step-derived screenshots

4. **Suites section (backend-integrated)**
   - Fetches `/api/v1/suites`
   - Lists saved suite artifacts with open links

5. **Reports section (backend-integrated)**
   - Fetches `/api/v1/reports`
   - Lists saved HTML reports with open links

## 5.2 Frontend State Management

Key state buckets:

- generation:
  - `url`, `prompt`, `isGenerating`, `progress`
- suite data:
  - `suite`, `tests`, filters/search
- execution:
  - `isRunningSuite`, `executionMap`
- artifacts:
  - `savedSuites`, `savedReports`, `isLoadingArtifacts`
- UX:
  - `view`, `section`, `toast`, `apiStatus`

## 5.3 Backend URL Config

Frontend uses:

- `VITE_API_BASE` if set
- fallback: `http://127.0.0.1:8000`

---

## 6. End-to-End Flow (User Journey)

1. User opens dashboard
2. Frontend health-checks backend
3. User enters URL and prompt, clicks **Generate Test Suite**
4. Frontend calls `/api/v1/ai/generate-suite`
5. Backend generates + validates suite, saves `suite_*.json`, returns JSON
6. Frontend normalizes and renders suite cards
7. User clicks **Run Suite**
8. Frontend executes each test via `/api/v1/ai/generate-and-run`
9. Backend returns execution results + screenshot paths
10. Frontend displays pass/fail badges and screenshot thumbnails
11. User can browse **Test Suites** and **Reports** sections for persisted artifacts

---

## 7. Configuration and Environment

## 7.1 Backend

Common runtime controls:

- `OPENAI_API_KEY`
- `OPENAI_SUITE_MODEL`
- `OPENAI_SUITE_MAX_TOKENS`
- `SUITE_TIMEOUT_SECONDS`

Demo-related flags in `demo_ai.py`:

- `DEMO_BASE_URL`
- `DEMO_PROMPT`
- `DEMO_RUN_FULL_SUITE`
- `DEMO_EXECUTE_SUITE`
- `DEMO_HEADLESS`
- `DEMO_SLOW_MO`

## 7.2 Frontend

- `VITE_API_BASE` (optional override)

---

## 8. Running the Project

## 8.1 Backend

From `backend/`:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
playwright install
uvicorn main:app --host 127.0.0.1 --port 8000 --loop asyncio
```

## 8.2 Frontend

From `frontend/`:

```powershell
npm install
npm run dev
```

Frontend default API target is `http://127.0.0.1:8000`.

---

## 9. Current Strengths

- AI-first suite generation
- Structured Playwright execution with retries and healing
- Intent-aware test semantics
- Run and step level artifact generation
- Backend-integrated frontend with artifact browsing
- Modern, investor-demo-friendly UI foundation

---

## 10. Known Limitations / Improvement Opportunities

- Some generated suites may still need stronger domain-specific prompts per target app
- Full suite execution currently runs sequentially from frontend (can optimize with queue/jobs)
- Report explorer can be extended with pagination, search, and metadata tags
- Could add dedicated backend endpoint for bulk suite execution (`run-suite`) to reduce frontend orchestration complexity
- Screenshot gallery view and step timeline UI can be enhanced further

---

## 11. Recommended Next Enhancements

1. Add a backend `POST /api/v1/ai/run-suite` bulk endpoint
2. Persist execution runs in a structured datastore (SQLite/Postgres)
3. Add report metadata index (status, app, duration, pass rate)
4. Add WebSocket/SSE progress stream for long-running suite execution
5. Implement role-based auth for multi-user usage
6. Add CI/CD trigger endpoint for automated regression runs

---

## 12. Glossary

- **Suite**: collection of generated test cases
- **Test case**: one scenario with typed intent and ordered steps
- **Step**: atomic UI action/assertion
- **Healing**: selector adaptation when element references drift
- **Artifact**: generated output file (JSON suite, HTML report, screenshot)
- **Intent match**: whether assertion outcome matches expected test intent

---

## 13. Summary

This platform combines AI-assisted test creation with robust browser execution and artifact-rich observability. The architecture is modular and production-oriented: FastAPI for orchestration, Playwright for execution, and a modern React frontend for operational UX. It is already suitable for advanced demos and can be evolved into a scalable enterprise QA automation product.
