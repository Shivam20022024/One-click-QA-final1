#!/usr/bin/env python3
"""
Comprehensive validation of the Error Classification Layer implementation.
Validates:
1. All modules import successfully
2. ErrorType enum has all required values
3. ErrorSeverity constants are defined
4. Decision engine function signature is correct
5. Console handler methods exist
"""
import sys
import traceback
from enum import Enum
from typing import get_type_hints

print("=" * 70)
print("ERROR CLASSIFICATION LAYER VALIDATION")
print("=" * 70)

# Test 1: Module imports
print("\n[1/5] Testing module imports...")
try:
    from models.schemas import ErrorType, ExecutionStatus, RunConfig
    print("  ✓ models.schemas")
    
    from execution.error_classifier import ErrorSeverity, ErrorCategory
    print("  ✓ execution.error_classifier")
    
    from execution.decision_engine import should_fail
    print("  ✓ execution.decision_engine")
    
    from execution.console_handler import BrowserEventTracker
    print("  ✓ execution.console_handler")
    
    from execution.runner import run_test
    print("  ✓ execution.runner")
    
    from execution.actions import ActionError
    print("  ✓ execution.actions")
    
except Exception as e:
    print(f"  ✗ Import failed: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test 2: ErrorType enum
print("\n[2/5] Validating ErrorType enum...")
try:
    required_types = [
        "NETWORK_CRITICAL_ERROR",
        "NETWORK_NON_CRITICAL_ERROR",
        "CONSOLE_CRITICAL_ERROR",
        "CONSOLE_NON_CRITICAL_ERROR",
        "ASSERTION_FAILURE",
        "TIMEOUT_ERROR",
        "NAVIGATION_ERROR",
        "ELEMENT_NOT_FOUND",
        "INVALID_INPUT",
        "UNKNOWN_ERROR",
    ]
    
    for err_type in required_types:
        if not hasattr(ErrorType, err_type):
            print(f"  ✗ Missing ErrorType.{err_type}")
            sys.exit(1)
    
    print(f"  ✓ All {len(required_types)} ErrorType values present")
    
except Exception as e:
    print(f"  ✗ ErrorType validation failed: {e}")
    sys.exit(1)

# Test 3: ErrorSeverity constants
print("\n[3/5] Validating ErrorSeverity constants...")
try:
    assert ErrorSeverity.CRITICAL == "critical"
    assert ErrorSeverity.NON_CRITICAL == "non_critical"
    assert ErrorSeverity.UNKNOWN == "unknown"
    print("  ✓ ErrorSeverity constants correct")
except Exception as e:
    print(f"  ✗ ErrorSeverity validation failed: {e}")
    sys.exit(1)

# Test 4: Decision engine function
print("\n[4/5] Validating decision engine...")
try:
    # Test should_fail function signature
    import inspect
    sig = inspect.signature(should_fail)
    params = list(sig.parameters.keys())
    assert "critical_errors" in params
    assert "non_critical_errors" in params
    assert "config" in params
    print("  ✓ should_fail function signature correct")
    
    # Test logic: relaxed mode (default) should only fail on critical
    config = RunConfig(strict_mode=False)
    result = should_fail([{"severity": "critical"}], [], config)
    assert result == True, "Should fail with critical error in relaxed mode"
    
    result = should_fail([], [{"severity": "non_critical"}], config)
    assert result == False, "Should not fail on non-critical in relaxed mode"
    
    # Test logic: strict mode should fail on any error
    config_strict = RunConfig(strict_mode=True)
    result = should_fail([], [{"severity": "non_critical"}], config_strict)
    assert result == True, "Should fail on non-critical in strict mode"
    
    print("  ✓ Decision engine logic correct")
    
except Exception as e:
    print(f"  ✗ Decision engine validation failed: {e}")
    traceback.print_exc()
    sys.exit(1)

# Test 5: BrowserEventTracker methods
print("\n[5/5] Validating BrowserEventTracker...")
try:
    from utils.logger import RunLogger
    logger = RunLogger("test")
    tracker = BrowserEventTracker(logger)
    
    required_methods = [
        "get_console_errors",
        "get_network_errors",
        "get_warnings",
        "handle_console",
        "handle_page_error",
        "handle_request_failed",
    ]
    
    for method in required_methods:
        if not hasattr(tracker, method) or not callable(getattr(tracker, method)):
            print(f"  ✗ Missing method: {method}")
            sys.exit(1)
    
    print(f"  ✓ All {len(required_methods)} tracker methods present")
    
    # Verify the methods work
    errors = tracker.get_console_errors()
    assert isinstance(errors, list)
    warnings = tracker.get_warnings()
    assert isinstance(warnings, list)
    print("  ✓ BrowserEventTracker methods functional")
    
except Exception as e:
    print(f"  ✗ BrowserEventTracker validation failed: {e}")
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 70)
print("ALL VALIDATION CHECKS PASSED ✓")
print("=" * 70)
print("\nImplementation Summary:")
print("  • ErrorType enum with 12 error types")
print("  • ErrorSeverity classification (critical/non_critical/unknown)")
print("  • Decision engine with strict/relaxed modes")
print("  • Browser event tracking with warnings")
print("  • ActionError with typed error_type")
print("\nThe error classification layer is ready for integration testing!")
print("=" * 70)
