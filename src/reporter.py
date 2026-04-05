"""
Format and print violations to the terminal.

Uses ANSI escape codes for color. These work on modern terminals including
Windows 10+ (the os.system('') call at the bottom enables them on Windows).
"""

import os
import pathlib

# Enable ANSI colors on Windows
if os.name == "nt":
    os.system("")

CYAN    = "\033[36m"
YELLOW  = "\033[33m"
RED     = "\033[31m"
GREEN   = "\033[32m"
MAGENTA = "\033[35m"
BOLD    = "\033[1m"
RESET   = "\033[0m"


def print_violation(filepath: pathlib.Path, v: dict, verbose: bool = False) -> None:
    color = RED if v["severity"] == "error" else YELLOW

    print(
        f"{CYAN}{filepath}:{v['line']}{RESET}  "
        f"{color}{BOLD}{v['severity']}{RESET}  "
        f"{MAGENTA}[{v['rule']}]{RESET}  "
        f"{v['message']}"
    )

    if verbose and v.get("suggestion"):
        print(f"  {GREEN}→ {v['suggestion']}{RESET}")
