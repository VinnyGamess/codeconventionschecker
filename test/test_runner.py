#!/usr/bin/env python3
"""
Simple test runner — verifies that rules fire (or don't fire) on the sample files.

Run from the project root:
    python test/test_runner.py
"""

import sys
import pathlib

# Make sure the project root is on the path
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from src.parser import strip_comments, extract
from src.rules  import run_rules

SAMPLES = pathlib.Path(__file__).parent


def analyze(filename: str) -> list[dict]:
    filepath = SAMPLES / filename
    source   = filepath.read_text(encoding="utf-8")
    clean    = strip_comments(source)
    decls    = extract(clean.splitlines())
    return run_rules(decls, clean, use_llm=False)


def rules_fired(violations: list[dict]) -> set[str]:
    return {v["rule"] for v in violations}


# ── Tests ──────────────────────────────────────────────────────────────────────

passed = 0
failed = 0


def expect(condition: bool, description: str) -> None:
    global passed, failed
    if condition:
        print(f"  PASS  {description}")
        passed += 1
    else:
        print(f"  FAIL  {description}")
        failed += 1


print("\n── sample.cs ──")
v = analyze("sample.cs")
fired = rules_fired(v)
expect("CQE001" in fired, "CQE001 fires for public field 'Score'")
expect("CQE002" in fired, "CQE002 fires for missing access modifier")
expect("CQE003" in fired, "CQE003 fires for 'myBadClass'")
expect("CQE004" in fired, "CQE004 fires for 'calculate_total'")
expect("CQE005" in fired, "CQE005 fires for 'TotalAmount'")
expect("CQE006" in fired, "CQE006 fires for private field 'name'")
expect("CQE008" in fired, "CQE008 fires for magic number 100 / 42")

# Things that must NOT fire
expect(not any(v["rule"] == "CQE001" and "MaxRetries" in v["message"] for v in v),
       "CQE001 does NOT fire for 'public const int MaxRetries'")
expect(not any(v["rule"] == "CQE001" and "DefaultName" in v["message"] for v in v),
       "CQE001 does NOT fire for 'public static readonly'")


print("\n── sample_unity.cs ──")
v = analyze("sample_unity.cs")
fired = rules_fired(v)
expect("CQE009" in fired, "CQE009 fires for public field 'speed'")
expect("CQE010" in fired, "CQE010 fires for Awake + Start both present")
expect(not any(v["rule"] == "CQE009" and "_jumpForce" in v["message"] for v in v),
       "CQE009 does NOT fire for [SerializeField] private field")


print("\n── Results ──")
print(f"  {passed} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
