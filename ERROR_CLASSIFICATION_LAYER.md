# Error Classification Layer Implementation

## Overview

The Error Classification Layer is a comprehensive system for distinguishing between critical and non-critical failures in the Playwright-based test execution engine. This implementation enables the system to avoid false negatives caused by non-critical errors and provides configurable execution modes.

## Components

### 1. ErrorType Enum (`models/schemas.py`)

```python
class ErrorType(str, Enum):
    NETWORK_CRITICAL_ERROR = "NETWORK_CRITICAL_ERROR"
    NETWORK_NON_CRITICAL_ERROR = "NETWORK_NON_CRITICAL_ERROR"
    CONSOLE_CRITICAL_ERROR = "CONSOLE_CRITICAL_ERROR"
    CONSOLE_NON_CRITICAL_ERROR = "CONSOLE_NON_CRITICAL_ERROR"
    ASSERTION_FAILURE = "ASSERTION_FAILURE"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    NAVIGATION_ERROR = "NAVIGATION_ERROR"
    ELEMENT_NOT_FOUND = "ELEMENT_NOT_FOUND"
    INVALID_INPUT = "INVALID_INPUT"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
```

**Purpose**: Provides strongly-typed error classification for all failures in the system.

### 2. ErrorSeverity Classification (`execution/error_classifier.py`)

```python
class ErrorSeverity:
    CRITICAL = "critical"          # Failures that should always fail the test
    NON_CRITICAL = "non_critical"  # Warnings that may or may not fail
    UNKNOWN = "unknown"             # Uncategorized errors
```

**Purpose**: Classifies errors into severity levels based on patterns and context.

**Key Functions**:
- `classify_console_error(message: str) -> str`: Analyzes console messages
  - Analytics/tracking errors → non_critical
  - Resource errors (404, 500) → critical
  
- `classify_network_failure(url, resource_type, failure_reason) -> str`: Analyzes network failures
  - Static assets (css, font, image) → non_critical
  - API/XHR failures → critical
  - DNS/connection errors → critical

### 3. Decision Engine (`execution/decision_engine.py`)

```python
def should_fail(
    critical_errors: List,
    non_critical_errors: List,
    config: RunConfig
) -> bool:
```

**Purpose**: Determines if the test should fail based on errors and configuration mode.

**Modes**:
- **Relaxed Mode** (default): Only critical errors fail the test
  - Non-critical warnings are logged but don't cause test failure
  - Perfect for avoiding false negatives from analytics errors
  
- **Strict Mode**: Any error (critical or non-critical) fails the test
  - Use when you want zero tolerance for any issues
  - Useful for quality gates and CI/CD pipelines

### 4. Browser Event Tracking (`execution/console_handler.py`)

The `BrowserEventTracker` class monitors console and network events:

**Key Methods**:
- `handle_console(message)`: Processes console events with severity classification
- `handle_page_error(error)`: Captures uncaught page errors (always critical)
- `handle_request_failed(request)`: Analyzes network failures

**Collections**:
- `console_errors`: All console-level errors with severity and type
- `network_errors`: All network-level errors with severity and type
- `warnings`: Non-critical errors elevated to warnings for visibility

### 5. Test Runner Integration (`execution/runner.py`)

The `run_test()` function integrates the classification layer:

```python
# After all steps execute:
critical_errors = [e for e in all_errors if e.get("severity") == "critical"]
non_critical_errors = [e for e in all_errors if e.get("severity") == "non_critical"]

if should_fail(critical_errors, non_critical_errors, config):
    overall_status = ExecutionStatus.FAILED
    error_type = ErrorType(critical_errors[0]["type"])
```

**Behavior**:
- Collects all console and network errors during execution
- Applies severity classification
- Uses decision engine to determine test outcome
- Returns comprehensive error details in `TestRunResult`

### 6. Action Error Types (`execution/actions.py`)

All action handlers now use typed `ErrorType` values:

```python
class ActionError(Exception):
    def __init__(self, message: str, error_type: ErrorType):
        self.message = message
        self.error_type = error_type

# Usage
raise ActionError(
    "Element not found",
    error_type=ErrorType.ELEMENT_NOT_FOUND
)
```

## Configuration

### RunConfig Extended

```python
class RunConfig(BaseModel):
    headless: bool = True
    timeout: int = 30_000
    retries: int = 2
    fail_on_console_error: bool = True
    strict_mode: bool = False  # NEW: Enable/disable strict mode
```

### Example Request

```json
{
  "test_name": "Login Flow",
  "base_url": "https://app.example.com",
  "browser": "chromium",
  "config": {
    "headless": true,
    "timeout": 30000,
    "retries": 2,
    "fail_on_console_error": true,
    "strict_mode": false
  },
  "steps": [...]
}
```

## Response Structure

### TestRunResult Enhanced

```python
class TestRunResult(BaseModel):
    test_name: str
    status: ExecutionStatus  # PASSED | FAILED | SKIPPED
    steps_executed: List[StepResult]
    failed_step: Optional[int]
    error: Optional[str]
    error_type: Optional[ErrorType]  # Typed error classification
    
    # NEW: Comprehensive error tracking
    warnings: List[Dict]              # Non-critical errors
    console_errors: List[Dict]        # All console errors with severity
    network_errors: List[Dict]        # All network errors with severity
```

### Example Response (Relaxed Mode)

```json
{
  "status": "passed",
  "error": null,
  "error_type": null,
  "warnings": [
    {
      "error_type": "CONSOLE_NON_CRITICAL_ERROR",
      "message": "Console error: Failed to load analytics.js",
      "severity": "non_critical"
    }
  ],
  "console_errors": [
    {
      "type": "CONSOLE_NON_CRITICAL_ERROR",
      "message": "Failed to load analytics.js",
      "severity": "non_critical"
    }
  ]
}
```

### Example Response (Strict Mode)

```json
{
  "status": "failed",
  "error": "Failed to load analytics.js",
  "error_type": "CONSOLE_NON_CRITICAL_ERROR",
  "warnings": [],
  "console_errors": [
    {
      "type": "CONSOLE_NON_CRITICAL_ERROR",
      "message": "Failed to load analytics.js",
      "severity": "non_critical"
    }
  ]
}
```

## Classification Rules

### Network Errors

| URL Pattern | Resource Type | Severity |
|---|---|---|
| Analytics URLs | XHR | non_critical |
| Tracking URLs | fetch | non_critical |
| Static assets | css, font, image | non_critical |
| API endpoints | xhr, fetch | critical |
| DNS/Connection errors | any | critical |

### Console Errors

| Pattern | Severity |
|---|---|
| Analytics/tracking library errors | non_critical |
| "Failed to load" resource | critical* |
| Network errors (4xx, 5xx) | critical |
| Browser API errors | critical |
| Uncaught exceptions | critical |

*Depends on resource type

## Usage Patterns

### Pattern 1: Relaxed Mode (Default)

Best for real-world tests where analytics might occasionally fail:

```json
{
  "config": {
    "strict_mode": false
  }
}
```

**Behavior**: Test passes if all critical errors are resolved, warnings logged for non-critical

### Pattern 2: Strict Mode

For quality gates and regression testing:

```json
{
  "config": {
    "strict_mode": true
  }
}
```

**Behavior**: Test fails on any error (critical or non-critical)

### Pattern 3: Error-Only Tests

Test while accepting expected warnings:

```json
{
  "config": {
    "strict_mode": false,
    "fail_on_console_error": true
  }
}
```

**Behavior**: Critical errors fail immediately, non-critical are warnings

## Implementation Checklist

- [x] ErrorType enum with 12 types
- [x] ErrorSeverity constants (critical/non_critical/unknown)
- [x] Classification functions (console/network)
- [x] Decision engine with strict/relaxed modes
- [x] BrowserEventTracker integration
- [x] ActionError typed error_type
- [x] Runner integration with error collection
- [x] TestRunResult enhanced with errors/warnings
- [x] RunConfig with strict_mode parameter
- [x] Example request updated
- [x] All string error_types converted to enums

## Testing

Run the validation script to verify the implementation:

```bash
python validate_implementation.py
```

This validates:
- All modules import successfully
- ErrorType enum has all required values
- ErrorSeverity constants are defined
- Decision engine logic is correct
- BrowserEventTracker methods exist and work
- Error classification patterns are functional

## Future Enhancements

1. **Machine Learning**: Learn classification rules from historical data
2. **Custom Rules**: Allow user-defined classification patterns
3. **Error Aggregation**: Group similar errors across test runs
4. **Metrics**: Track error frequency and patterns by resource/URL
5. **Remediation**: Suggest fixes for common failures
