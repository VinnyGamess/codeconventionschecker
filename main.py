#!/usr/bin/env python3
"""
Code Quality Engine (CQE) — C# code convention checker

Usage:
    python main.py <path>            Check all .cs files at <path>
    python main.py <path> --verbose  Also print fix suggestions
    python main.py <path> --no-llm   Skip the LLM naming check (CQE011)

Exit code 1 if any errors were found (suitable for CI pipelines).
"""

import sys
import pathlib

from src.parser   import strip_comments, extract
from src.rules    import run_rules
from src.reporter import print_violation


def find_cs_files(path: str) -> list[pathlib.Path]:
    target = pathlib.Path(path)
    if target.is_file():
        return [target]
    return sorted(target.rglob("*.cs"))


def analyze(filepath: pathlib.Path, use_llm: bool) -> list[dict]:
    source = filepath.read_text(encoding="utf-8", errors="ignore")
    clean  = strip_comments(source)
    decls  = extract(clean.splitlines())
    return run_rules(decls, clean, use_llm)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    path    = sys.argv[1]
    verbose = "--verbose" in sys.argv
    use_llm = "--no-llm" not in sys.argv

    files = find_cs_files(path)
    if not files:
        print(f"No .cs files found at: {path}")
        sys.exit(0)

    error_count = 0

    for filepath in files:
        violations = analyze(filepath, use_llm)
        for v in violations:
            print_violation(filepath, v, verbose)
            if v["severity"] == "error":
                error_count += 1

    sys.exit(1 if error_count > 0 else 0)


if __name__ == "__main__":
    main()
