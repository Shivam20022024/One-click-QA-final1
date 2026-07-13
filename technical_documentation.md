# Nova Test Suite Generator - Technical Documentation

## 1. System Architecture Overview

The Nova Test Suite Generator is an AI-powered UI testing platform that dynamically generates, executes, and analyzes web application tests using natural language prompts.

The system is composed of two main tiers:
- **Backend**: A Python-based FastAPI service responsible for AI generation orchestration, Playwright execution, self-healing locators, and artifact management.
- **Frontend**: A React and Tailwind CSS single-page application (SPA) providing a modern SaaS-style user experience.

---

## 2. Backend Architecture (FastAPI + Playwright)

### 2.1 Core Modules
- **API Router** (`backend/api/`): Defines REST endpoints for generation and execution.
- **LLM Generator** (`backend/llm/generator.py`): Interfaces with LLMs to translate prompts into structured Test Suite schemas.
- **Execution Engine** (`backend/execution/runner.py`): Orchestrates headless Playwright browsers.
- **Self-Healing Layer** (`backend/execution/self_healing.py`): Adapts broken element selectors dynamically using scoring mechanisms and historical memory.

### 2.2 Data Models
Defined using Pydantic (`backend/models/schemas.py`):
- `TestStep`: Atomic actions like `click`, `fill`, `goto`, `assert_visible`.
- `StepResult` / `TestRunResult`: Execution outcomes with metadata (timing, screenshot paths, healing logs).
- `GeneratedTestSuite`: The AI-generated payload containing an array of structured tests.

### 2.3 Key API Endpoints
- `POST /api/v1/ai/generate-suite`: Accepts a target URL and prompt, returning a structured JSON test suite.
- `POST /api/v1/ai/generate-and-run`: Generates a suite and immediately orchestrates execution, returning final results.
- `GET /api/v1/suites` & `/api/v1/reports`: Retrieves saved JSON suites and HTML test run reports.

### 2.4 Artifact Management
The backend utilizes local storage mounted as static routes:
- `/storage/screenshots/`: Stores captured screenshots (on fail, explicit step, or post-run).
- `/storage/reports/`: Stores persistent `.json` suite definitions and `.html` execution results.

---

## 3. Frontend Architecture (React + Vite)

### 3.1 Tech Stack
- **Framework**: React with Vite for fast HMR.
- **Styling**: Tailwind CSS.
- **State Management**: React Hooks (useState, useEffect).

### 3.2 Core Components
- **Dashboard**: Entry point for target URLs and text prompts. Triggers `generate-suite`.
- **Test Cards**: Expandable UI components displaying ordered test steps and expected outcomes.
- **Execution Viewer**: Real-time indication of test execution status, rendering thumbnails of Playwright-captured screenshots.
- **Artifact Explorer**: Displays historical test suites and reports polled from the backend.

### 3.3 State Management
The frontend maintains several key states:
- `generation`: Tracking API request status for suite generation.
- `suite data`: The normalized JSON suite parsed from the backend.
- `execution`: An in-memory map mapping test IDs to their execution status (Pass/Fail) and screenshot URLs.

---

## 4. End-to-End Execution Flow

1. **User Request**: The user submits a URL and prompt via the frontend UI.
2. **AI Generation**: Frontend calls `POST /api/v1/ai/generate-suite`. The backend uses the LLM to structure test steps, normalizes the output, and returns the payload.
3. **Trigger Execution**: The user clicks "Run Suite". The frontend loops through the generated tests, dispatching them to `POST /api/v1/ai/generate-and-run`.
4. **Browser Automation**: `runner.py` executes each step using Playwright.
5. **Self-Healing**: If a selector fails, `self_healing.py` attempts to find the element via semantic matching or alternative attributes.
6. **Result Aggregation**: Screenshots are saved, execution status is finalized, and the response is sent back to the frontend for display.
