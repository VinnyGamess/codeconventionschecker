"""
LLM-based naming quality check (CQE011).

Sends all identifier names to OpenAI in one batch per run and asks it to flag
names that are meaningless, too vague, non-English, or placeholder-like.

Results are cached in .llm_cache.json so repeated runs don't re-check names
that were already evaluated.

Requires the OPENAI_API_KEY environment variable to be set.
If it is not set, find_bad_names() returns an empty list and CQE011 is skipped.
"""

import json
import os
import pathlib

CACHE_FILE = pathlib.Path(".llm_cache.json")


def _load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def _save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def find_bad_names(names: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """
    Check a list of (name, kind) pairs for naming quality.
    Returns a list of (name, reason) for names that are considered bad.

    Results are cached so names seen before are not re-checked.
    Returns an empty list if OPENAI_API_KEY is not set.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return []

    cache = _load_cache()

    # Only ask the LLM about names we haven't seen before
    uncached = [(n, k) for n, k in names if f"{n}:{k}" not in cache]

    if uncached:
        _query_llm(uncached, cache, api_key)
        _save_cache(cache)

    # Return all names from this call that the LLM (or cache) marked as bad
    return [(n, cache[f"{n}:{k}"]) for n, k in names
            if cache.get(f"{n}:{k}")]


def _query_llm(names: list[tuple[str, str]], cache: dict, api_key: str) -> None:
    """Ask the LLM which names are poor quality and store results in cache."""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)

    prompt = (
        "You review C# identifier names for code quality.\n"
        "Flag names that are: meaningless (e.g. 'foo', 'test', 'data1'), "
        "too short without context (e.g. 'a', 'x2'), non-English (e.g. Dutch "
        "or German words), or placeholder-like.\n\n"
        f"Names to check: {json.dumps(names)}\n\n"
        'Respond with JSON: {"bad_names": [{"name": "...", "reason": "..."}]}\n'
        "Only include genuinely bad names. An empty array is fine."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        bad  = {b["name"]: b["reason"] for b in data.get("bad_names", [])}
    except Exception:
        bad = {}

    # Store every checked name in cache (empty string = name is fine)
    for name, kind in names:
        cache[f"{name}:{kind}"] = bad.get(name, "")
