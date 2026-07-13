#!/usr/bin/env python
"""Validate Python syntax of all core modules."""
import ast
import sys
from pathlib import Path

backend_dir = Path("C:/Users/KIIT/Desktop/Novalantis/ai-testing-platform/backend")

files_to_check = [
    backend_dir / "models/schemas.py",
    backend_dir / "execution/decision_engine.py",
    backend_dir / "execution/console_handler.py",
    backend_dir / "execution/runner.py",
    backend_dir / "execution/actions.py",
]

errors = []
for file_path in files_to_check:
    try:
        with open(file_path, 'r') as f:
            code = f.read()
        ast.parse(code)
        print(f"✓ {file_path.name}")
    except SyntaxError as e:
        print(f"✗ {file_path.name}: {e}")
        errors.append((file_path.name, str(e)))

if errors:
    print(f"\n{len(errors)} file(s) have syntax errors.")
    sys.exit(1)
else:
    print("\nAll files are syntactically correct!")
    sys.exit(0)
