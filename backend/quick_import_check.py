#!/usr/bin/env python3
"""Quick syntax check - import all modules."""
import sys
import traceback

modules = [
    "models.schemas",
    "execution.error_classifier",
    "execution.decision_engine",
    "execution.console_handler",
    "execution.actions",
    "execution.runner",
]

failed = False
for module in modules:
    try:
        __import__(module)
        print(f"✓ {module}")
    except Exception as e:
        print(f"✗ {module}: {e}")
        traceback.print_exc()
        failed = True

sys.exit(1 if failed else 0)
