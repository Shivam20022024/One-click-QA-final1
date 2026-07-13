import asyncio
import os
import sys
from pathlib import Path

# Add backend dir to pythonpath
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv()

from models.database import SessionLocal, Base, engine
from models.db_models import User
from services.project_service import create_project, create_suite, create_test_case
from llm.generator import TestGenerator
from execution.multi_executor import run_cross_platform_parallel
from utils.auth import hash_password

async def main():
    print("=== Starting Autonomous AI QA Platform Demo ===")
    
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Authenticate / Create Admin
    admin = db.query(User).filter(User.email == "admin@testplatform.ai").first()
    if not admin:
        admin = User(
            email="admin@testplatform.ai",
            hashed_password=hash_password("admin123"),
            full_name="Sandbox Admin",
            role="Admin"
        )
        db.add(admin)
        db.commit()
    
    # 1. Select Website & Create Project
    base_url = "https://www.saucedemo.com"
    print(f"\n[1] Selected Website: {base_url}")
    print("Reason: SauceDemo is a stable, publicly accessible e-commerce demo that allows full end-to-end testing of workflows like login, catalog browsing, cart management, and checkout without bot protections.")
    
    project = create_project(db, name="SauceDemo E-Commerce QA", description="Comprehensive QA automation for SauceDemo", owner_id=admin.id)
    print(f"-> Created Project: {project.name} (ID: {project.id})")

    # 2. AI Website Analysis & Test Generation
    print("\n[2] Analyzing Website and Generating AI Test Suites...")
    generator = TestGenerator()
    suite_data = generator.generate_test_suite(
        prompt="Analyze the UI and generate smoke and regression tests for login, forms, navigation, buttons, and checkout workflows.",
        base_url=base_url
    )
    
    generated_tests = suite_data.get("test_suite", {}).get("tests", [])
    print(f"-> AI Generated {len(generated_tests)} test cases.")

    # 3. Populate Suites in Database
    print("\n[3] Populating Database Dashboards...")
    smoke_suite = create_suite(db, project_id=project.id, name="Smoke Tests", description="Critical paths (login, navigation)")
    regression_suite = create_suite(db, project_id=project.id, name="Regression Tests", description="Forms, edge cases, negative flows")
    
    db_cases = []
    for t in generated_tests:
        test_type = t.get("test_type", "positive")
        # Smoke tests are positive/e2e, Regression covers negative/edge
        target_suite = regression_suite if test_type in ["negative", "edge"] else smoke_suite
        
        case = create_test_case(db, suite_id=target_suite.id, name=t.get("test_name"), steps=t.get("steps"), description=t.get("feature"))
        db_cases.append(case)
        print(f"-> Mapped: '{case.name}' -> {target_suite.name}")

    # 4. Multi-browser/Device Execution
    print("\n[4] Executing Test Suites Across Platforms...")
    # Using a reduced matrix to ensure execution completes within reasonable time for demo
    browsers = ["chromium", "webkit"] 
    devices = ["Desktop", "iPhone 13"]
    environment = "Production"
    
    print(f"Browsers: {browsers}")
    print(f"Devices: {devices}")
    
    # We will pick 3 representative tests (one smoke, one regression/negative, one checkout)
    smoke_tests = [c for c in db_cases if c.suite_id == smoke_suite.id]
    reg_tests = [c for c in db_cases if c.suite_id == regression_suite.id]
    
    tests_to_run = []
    if smoke_tests:
        tests_to_run.append(smoke_tests[0])
    if reg_tests:
        tests_to_run.append(reg_tests[0])
    if len(smoke_tests) > 1:
        tests_to_run.append(smoke_tests[-1]) # e2e checkout usually at the end
        
    for tc in tests_to_run:
        print(f"\nTriggering parallel run for: {tc.name}")
        results = await run_cross_platform_parallel(
            test_name=tc.name,
            base_url=base_url,
            steps=tc.steps,
            browsers=browsers,
            devices=devices,
            environment=environment,
            project_id=project.id,
            suite_id=tc.suite_id,
            test_case_id=tc.id,
            db=db
        )
        combinations = results.get("combinations", [])
        passed_runs = [r for r in combinations if r.get('status') == 'passed']
        print(f"-> Parallel Execution Complete. Passed: {len(passed_runs)} / {len(combinations)}")

    print("\n=== AI QA Platform Demo Complete ===")
    print("The Dashboard is now populated with Projects, Suites, Test Cases, and Live Execution Runs.")

if __name__ == "__main__":
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(main())
