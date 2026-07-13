#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from copy import deepcopy
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

API_BASE = "http://127.0.0.1:8000"
TIMEOUT_SECONDS = 60.0
CONNECT_TIMEOUT_SECONDS = 10.0
SUITE_TIMEOUT_SECONDS = 180.0
MAX_RETRIES = 2
RETRY_DELAYS = [1.0, 2.0]
POLL_INTERVAL_SECONDS = 1.0
MAX_POLL_SECONDS = 30.0

CLIENT_TIMEOUT = httpx.Timeout(timeout=TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS)
SUITE_CLIENT_TIMEOUT = httpx.Timeout(timeout=SUITE_TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS)
HEADERS = {"Content-Type": "application/json"}
REPORTS_DIR = Path(__file__).resolve().parent / "storage" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
SUITE_JSON_DIR = Path(__file__).resolve().parent / "storage" / "reports"
SUITE_JSON_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_BASE_URL = "https://www.saucedemo.com"

INPUT_HINTS = ("password", "email", "username", "user", "input", "name")
SUCCESS_HINTS = ("success", "dashboard", "home", "inventory", "welcome")
ERROR_HINTS = ("error", "alert", "invalid", "fail", "warning")
DEFAULT_SUCCESS_SELECTOR = ".inventory_list, .dashboard, .home, [data-test='success']"
DEFAULT_ERROR_SELECTOR = ".error-message-container, .error, .alert-error, [role='alert']"
DEFAULT_EDGE_SELECTOR = (
    ".error-message-container, .error, .alert-error, [role='alert'], "
    ".validation-error, [aria-invalid='true']"
)


async def post_with_retries(client: httpx.AsyncClient, path: str, payload: Dict[str, Any]) -> httpx.Response:
    for attempt in range(1, MAX_RETRIES + 1):
        print(f"[POST] {path} attempt {attempt}/{MAX_RETRIES}")
        start = time.time()
        try:
            response = await client.post(path, json=payload, headers=HEADERS)
            elapsed = time.time() - start
            print(f"[POST] status={response.status_code} time={elapsed:.2f}s")
            return response
        except (httpx.ReadTimeout, httpx.RequestError) as exc:
            elapsed = time.time() - start
            print(f"[POST] request error after {elapsed:.2f}s: {exc}")
            if attempt == MAX_RETRIES:
                raise
            delay = RETRY_DELAYS[min(attempt - 1, len(RETRY_DELAYS) - 1)]
            print(f"[POST] retrying in {delay:.1f}s")
            await asyncio.sleep(delay)
    raise RuntimeError("Retries exhausted")


def print_json_result(title: str, data: Dict[str, Any]) -> None:
    print(f"\n{title}")
    print("-" * 60)
    print(json.dumps(data, indent=2))


async def poll_job_until_ready(client: httpx.AsyncClient, job_id: str) -> Optional[Dict[str, Any]]:
    deadline = time.time() + MAX_POLL_SECONDS
    status_path = f"/api/v1/ai/job/{job_id}"

    while time.time() < deadline:
        response = await client.get(status_path)
        if response.status_code != 200:
            raise RuntimeError(f"Job poll failed: {response.text}")

        payload = response.json()
        status = payload.get("status")
        print(f"[POLL] job_id={job_id} status={status}")

        if status == "done":
            return payload.get("result")

        await asyncio.sleep(POLL_INTERVAL_SECONDS)
    return None


def _is_fill_candidate(step: Dict[str, Any]) -> bool:
    if step.get("action") != "fill":
        return False
    selector = str(step.get("selector") or "").lower()
    value = str(step.get("value") or "").lower()
    return any(token in selector or token in value for token in INPUT_HINTS)


def _mutated_value(selector: str, value: str, variant_type: str) -> str:
    sel = selector.lower()
    default_value = value or "demo_value"
    if variant_type == "positive":
        if "password" in sel:
            return "ValidPass123!"
        if "email" in sel:
            return "valid.user@example.com"
        if "user" in sel or "name" in sel:
            return "valid_user"
        return default_value
    if variant_type == "negative":
        if "password" in sel:
            return "wrong_password_123"
        if "email" in sel:
            return "invalid-email"
        if "user" in sel or "name" in sel:
            return "invalid_user"
        return "invalid_value"
    # edge
    if "password" in sel:
        return ""
    if "email" in sel:
        return "a@b"
    if "user" in sel or "name" in sel:
        return "x" * 64
    return ""


def _ensure_screenshot_policy(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out = deepcopy(steps)
    for idx, step in enumerate(out):
        action = str(step.get("action") or "").strip()
        if action.startswith("assert"):
            step["capture_screenshot"] = True
        if idx == len(out) - 1:
            step["capture_screenshot"] = True
    return out


def _classify_selector(selector: str) -> str:
    lowered = selector.lower()
    if any(token in lowered for token in ERROR_HINTS):
        return "error"
    if any(token in lowered for token in SUCCESS_HINTS):
        return "success"
    return "unknown"


def _extract_assertion_candidates(steps: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    success: List[str] = []
    error: List[str] = []
    for step in steps:
        action = str(step.get("action") or "")
        if not action.startswith("assert"):
            continue
        selector = str(step.get("selector") or "").strip()
        if not selector:
            continue
        kind = _classify_selector(selector)
        if kind == "success":
            success.append(selector)
        elif kind == "error":
            error.append(selector)
    return {"success": success, "error": error}


def _choose_assertion_selector(variant_type: str, candidates: Dict[str, List[str]]) -> str:
    success_selector = candidates["success"][0] if candidates["success"] else DEFAULT_SUCCESS_SELECTOR
    error_selector = candidates["error"][0] if candidates["error"] else DEFAULT_ERROR_SELECTOR
    if variant_type == "positive":
        return success_selector
    if variant_type == "negative":
        return error_selector
    # edge case: allow error OR validation indicator.
    if candidates["error"]:
        return f"{error_selector}, [aria-invalid='true'], .validation-error"
    return DEFAULT_EDGE_SELECTOR


def expand_test_cases(base_test: Dict[str, Any]) -> List[Dict[str, Any]]:
    steps = deepcopy(base_test.get("steps", []))
    assert_candidates = _extract_assertion_candidates(steps)
    variants: List[Dict[str, Any]] = []

    for variant_type in ("positive", "negative", "edge"):
        v_steps = deepcopy(steps)
        for step in v_steps:
            if _is_fill_candidate(step):
                selector = str(step.get("selector") or "")
                value = str(step.get("value") or "")
                step["value"] = _mutated_value(selector, value, variant_type)
            if str(step.get("action") or "").startswith("assert"):
                step["selector"] = _choose_assertion_selector(variant_type, assert_candidates)
        v_steps = _ensure_screenshot_policy(v_steps)
        variants.append(
            {
                "test_type": variant_type,
                "test_name": f"{base_test.get('test_name', 'generated_test')}_{variant_type}",
                "base_url": base_test.get("base_url"),
                "steps": v_steps,
            }
        )
    return variants


def generate_html_report(executions: List[Dict[str, Any]]) -> Path:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = REPORTS_DIR / f"report_{ts}.html"
    generated_at = datetime.now().strftime("%d %b %Y, %I:%M:%S %p")

    total_tests = len(executions)
    passed_tests = 0
    failed_tests = 0
    total_steps = 0
    healed_steps = 0

    sections: List[str] = []
    for run in executions:
        test_type = run.get("test_type", "unknown")
        result = run.get("execution_result") or {}
        status = result.get("status", "unknown")
        if status == "passed":
            passed_tests += 1
        else:
            failed_tests += 1

        steps = result.get("steps_executed", []) or []
        total_steps += len(steps)
        steps_html: List[str] = []
        failed_steps_count = 0

        for step in steps:
            screenshot = step.get("screenshot_path")
            image_html = f'<a href="{screenshot}" target="_blank">Open screenshot</a>' if screenshot else "Not captured"
            is_healed = bool(step.get("healed"))
            if is_healed:
                healed_steps += 1
            step_status = step.get("status")
            status_cls = "passed" if step_status == "passed" else "failed" if step_status == "failed" else "other"
            if step_status == "failed":
                failed_steps_count += 1

            healed_badge = "<span class='badge healed'>Yes</span>" if is_healed else "<span class='badge none'>No</span>"
            original_selector = step.get("original_selector")
            new_selector = step.get("new_selector")
            selector_transition = "N/A"
            if original_selector or new_selector:
                selector_transition = f"{escape(str(original_selector))} -> {escape(str(new_selector))}"

            action_desc = {
                "goto": "Open a page",
                "fill": "Type into an input field",
                "click": "Click a button/link",
                "assert_visible": "Check if an element is visible",
            }.get(str(step.get("action")), str(step.get("action")))

            steps_html.append(
                f"<tr class='{status_cls}'>"
                f"<td>{step.get('step_index')}</td>"
                f"<td>{step.get('action')}<br><span class='sub'>{action_desc}</span></td>"
                f"<td>{step_status}</td>"
                f"<td>{healed_badge}</td>"
                f"<td>{step.get('healing_type')}</td>"
                f"<td>{escape(str(step.get('expected_intent')))}</td>"
                f"<td>{escape(str(step.get('actual_detected_type')))}</td>"
                f"<td style='color:{'#b42318' if step.get('intent_match') is False else '#1b7f3b'};font-weight:700'>{step.get('intent_match')}</td>"
                f"<td>{selector_transition}</td>"
                f"<td>{image_html}</td>"
                "</tr>"
            )

        run_status_cls = "ok" if status == "passed" else "bad"
        plain_verdict = (
            "This test passed. The user flow worked as expected."
            if status == "passed"
            else f"This test failed. {failed_steps_count} step(s) did not behave as expected."
        )

        sections.append(
            "<section>"
            f"<h2>{run.get('test_name')} ({test_type})</h2>"
            f"<p><strong>Overall Status:</strong> <span class='{run_status_cls}'>{status}</span></p>"
            f"<p class='plain'>{plain_verdict}</p>"
            "<table cellpadding='6' cellspacing='0'>"
            "<thead><tr><th>Step #</th><th>Action</th><th>Status</th><th>Self-Healed</th><th>Healing Type</th><th>Expected Outcome</th><th>Detected Outcome</th><th>Outcome Match</th><th>Selector Change</th><th>Evidence</th></tr></thead>"
            f"<tbody>{''.join(steps_html)}</tbody>"
            "</table>"
            "</section>"
        )

    overall_plain = (
        "All tests passed. The tested flows are currently behaving correctly."
        if failed_tests == 0
        else "Some tests failed. Please review failed rows and screenshots to identify what broke."
    )

    html = (
        "<html><head><meta charset='utf-8'><title>AI Test Execution Report</title>"
        "<style>"
        "body{font-family:Segoe UI,Arial,sans-serif;padding:20px;background:#f7f7fb;color:#202124;}"
        "table{width:100%;border-collapse:collapse;background:#fff;}"
        "th,td{border:1px solid #e0e0e0;padding:8px;text-align:left;vertical-align:top;}"
        "th{background:#f0f4f8;}"
        "tr.passed td{background:#edf9f0;}"
        "tr.failed td{background:#fdecec;}"
        ".badge{padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;}"
        ".badge.healed{background:#ffe0b2;color:#8a4b00;}"
        ".badge.none{background:#eceff1;color:#455a64;}"
        ".ok{color:#1b7f3b;font-weight:700;}"
        ".bad{color:#b42318;font-weight:700;}"
        ".summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0 18px 0;}"
        ".card{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px;}"
        ".card .k{font-size:12px;color:#607080;}.card .v{font-size:20px;font-weight:700;}"
        ".plain{background:#eef4ff;border:1px solid #d7e4ff;padding:10px;border-radius:8px;}"
        ".sub{font-size:11px;color:#627187;}"
        ".legend{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin:12px 0 18px 0;}"
        ".legend h3{margin:0 0 8px 0;font-size:15px;}"
        ".legend ul{margin:0;padding-left:18px;}"
        "</style></head>"
        "<body>"
        "<h1>AI Test Execution Report</h1>"
        f"<p><strong>Generated on:</strong> {generated_at}</p>"
        "<div class='summary'>"
        f"<div class='card'><div class='k'>Total Tests</div><div class='v'>{total_tests}</div></div>"
        f"<div class='card'><div class='k'>Passed</div><div class='v'>{passed_tests}</div></div>"
        f"<div class='card'><div class='k'>Failed</div><div class='v'>{failed_tests}</div></div>"
        f"<div class='card'><div class='k'>Total Steps</div><div class='v'>{total_steps}</div></div>"
        f"<div class='card'><div class='k'>Healed Steps</div><div class='v'>{healed_steps}</div></div>"
        "</div>"
        f"<p class='plain'><strong>Executive Summary:</strong> {overall_plain}</p>"
        "<div class='legend'>"
        "<h3>How to read this report</h3>"
        "<ul>"
        "<li><strong>Status</strong>: Passed means the step/test worked; Failed means it did not.</li>"
        "<li><strong>Self-Healed</strong>: Yes means the platform auto-corrected a selector and continued.</li>"
        "<li><strong>Outcome Match</strong>: true means actual behavior matched expected intent.</li>"
        "<li><strong>Evidence</strong>: open screenshot links for visual proof of page state.</li>"
        "</ul>"
        "</div>"
        f"{''.join(sections)}"
        "</body></html>"
    )
    report_path.write_text(html, encoding="utf-8")
    return report_path
async def generate_base_test(prompt: str, base_url: Optional[str]) -> Optional[Dict[str, Any]]:
    payload: Dict[str, Any] = {"prompt": prompt}
    if base_url:
        payload["base_url"] = base_url

    async with httpx.AsyncClient(base_url=API_BASE, timeout=CLIENT_TIMEOUT) as client:
        response = await post_with_retries(client, "/api/v1/ai/generate-test", payload)
        immediate = response.json()
        print_json_result("Immediate Fallback Response", immediate)
        job_id = immediate.get("job_id")
        if not job_id:
            return immediate

        print(f"Polling async AI job: {job_id}")
        upgraded = await poll_job_until_ready(client, job_id)
        if upgraded is None:
            print("AI result not ready in poll window. Using immediate fallback.")
            return immediate
        print_json_result("Upgraded AI Test", upgraded)
        return upgraded


async def generate_full_suite(prompt: str, base_url: Optional[str]) -> Optional[Dict[str, Any]]:
    payload: Dict[str, Any] = {"prompt": prompt}
    if base_url:
        payload["base_url"] = base_url

    async with httpx.AsyncClient(base_url=API_BASE, timeout=SUITE_CLIENT_TIMEOUT) as client:
        try:
            response = await post_with_retries(client, "/api/v1/ai/generate-suite", payload)
        except httpx.ReadTimeout:
            print(
                f"[SUITE] Timed out after {SUITE_TIMEOUT_SECONDS:.0f}s. "
                "Increase SUITE_TIMEOUT_SECONDS or set OPENAI_SUITE_MODEL to a faster model."
            )
            return None
        if response.status_code != 200:
            print(f"[SUITE] generation failed: {response.text}")
            return None
        suite = response.json()
        print_json_result("Generated Full Suite", suite)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        suite_path = SUITE_JSON_DIR / f"suite_{ts}.json"
        suite_path.write_text(json.dumps(suite, indent=2), encoding="utf-8")
        print(f"[SUITE] saved: {suite_path}")
        return suite


async def execute_variants(variants: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    demo_headless_env = os.getenv("DEMO_HEADLESS", "false").strip().lower()
    demo_headless = demo_headless_env in {"1", "true", "yes", "on"}
    demo_slow_mo = int(os.getenv("DEMO_SLOW_MO", "150"))
    force_heal_demo = os.getenv("DEMO_FORCE_HEAL", "false").strip().lower() in {"1", "true", "yes", "on"}

    executions: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(base_url=API_BASE, timeout=CLIENT_TIMEOUT) as client:
        for variant in variants:
            print(f"\n[RUN] Executing variant={variant['test_type']} name={variant['test_name']}")
            run_steps = deepcopy(variant["steps"])
            if force_heal_demo:
                for step in run_steps:
                    if str(step.get("action") or "").startswith("assert"):
                        step["selector"] = ".__demo_non_existent_selector__"
                        break
            payload = {
                "test": {
                    "test_name": variant["test_name"],
                    "base_url": variant["base_url"],
                    "steps": run_steps,
                },
                "browser": "chromium",
                "headless": demo_headless,
                "config": {
                    "headless": demo_headless,
                    "slow_mo": demo_slow_mo,
                },
            }
            response = await post_with_retries(client, "/api/v1/ai/generate-and-run", payload)
            result = response.json()
            print_json_result(f"Execution Result ({variant['test_type']})", result)
            executions.append(
                {
                    "test_type": variant["test_type"],
                    "test_name": variant["test_name"],
                    "execution_result": result.get("execution_result"),
                }
            )
    return executions


async def execute_generated_suite(suite: Dict[str, Any], base_url: str) -> List[Dict[str, Any]]:
    tests = ((suite.get("test_suite") or {}).get("tests") or [])
    demo_headless_env = os.getenv("DEMO_HEADLESS", "false").strip().lower()
    demo_headless = demo_headless_env in {"1", "true", "yes", "on"}
    demo_slow_mo = int(os.getenv("DEMO_SLOW_MO", "150"))
    max_tests = int(os.getenv("SUITE_MAX_TESTS", "20"))
    selected_tests = tests[:max_tests]

    executions: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(base_url=API_BASE, timeout=CLIENT_TIMEOUT) as client:
        for idx, test in enumerate(selected_tests, start=1):
            print(f"\n[SUITE RUN] {idx}/{len(selected_tests)} {test.get('test_name')}")
            payload = {
                "test": {
                    "test_name": test.get("test_name") or f"suite_test_{idx}",
                    "base_url": suite.get("application_map", {}).get("base_url")
                    or suite.get("base_url")
                    or base_url,
                    "steps": test.get("steps", []),
                },
                "browser": "chromium",
                "headless": demo_headless,
                "config": {
                    "headless": demo_headless,
                    "slow_mo": demo_slow_mo,
                },
            }
            response = await post_with_retries(client, "/api/v1/ai/generate-and-run", payload)
            result = response.json()
            executions.append(
                {
                    "test_type": test.get("test_type", "unknown"),
                    "test_name": test.get("test_name", f"suite_test_{idx}"),
                    "execution_result": result.get("execution_result"),
                }
            )
    return executions


async def main() -> None:
    print("AI QA Demo (Single Test + Full Website Suite)")
    print("=" * 70)

    parser = argparse.ArgumentParser(description="Run AI QA demo against a target website")
    parser.add_argument("--base-url", dest="base_url", default=None, help="Target website URL")
    parser.add_argument("--prompt", dest="prompt", default=None, help="Suite generation prompt")
    args = parser.parse_args()

    base_url = args.base_url or os.getenv("DEMO_BASE_URL", DEFAULT_BASE_URL)
    prompt = args.prompt or os.getenv("DEMO_PROMPT", "test all features of this website")
    run_full_suite = os.getenv("DEMO_RUN_FULL_SUITE", "true").strip().lower() in {"1", "true", "yes", "on"}
    execute_suite = os.getenv("DEMO_EXECUTE_SUITE", "false").strip().lower() in {"1", "true", "yes", "on"}

    print(f"[CONFIG] base_url={base_url}")
    print(f"[CONFIG] run_full_suite={run_full_suite} execute_suite={execute_suite}")

    if run_full_suite:
        suite = await generate_full_suite(prompt=prompt, base_url=base_url)
        if not suite:
            print("No suite generated.")
            return
        tests = ((suite.get("test_suite") or {}).get("tests") or [])
        app_map = suite.get("application_map") or {}
        print(
            f"[SUITE] pages={len(app_map.get('pages', []))} "
            f"features={len(app_map.get('features', []))} "
            f"flows={len(app_map.get('flows', []))} "
            f"tests={len(tests)}"
        )
        if execute_suite:
            executions = await execute_generated_suite(suite, base_url=base_url)
            report_path = generate_html_report(executions)
            print(f"\nHTML suite report generated: {report_path}")
        print("Suite demo complete.")
        return

    base_test = await generate_base_test(prompt=prompt, base_url=base_url)
    if not base_test:
        print("No base test available.")
        return
    variants = expand_test_cases(base_test)
    print_json_result("Expanded Test Variants", {"variants": variants})

    executions = await execute_variants(variants)
    report_path = generate_html_report(executions)
    print(f"\nHTML report generated: {report_path}")
    print("Demo complete.")


if __name__ == "__main__":
    asyncio.run(main())

