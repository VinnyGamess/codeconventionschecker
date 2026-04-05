"""
All code convention rules.

Each rule is a plain function that receives the declarations list (and sometimes
the cleaned source) and returns a list of violation dicts.

run_rules() calls them all and returns violations sorted by line number.
"""

import re
from .parser import Declaration

ACCESS_MODIFIERS = {"public", "private", "protected", "internal"}

UNITY_LIFECYCLE = {
    "Update", "FixedUpdate", "LateUpdate",
    "OnEnable", "OnDisable", "OnDestroy",
    "OnCollisionEnter", "OnCollisionStay", "OnCollisionExit",
    "OnTriggerEnter", "OnTriggerStay", "OnTriggerExit",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _violation(rule: str, severity: str, message: str, suggestion: str, line: int) -> dict:
    return {"rule": rule, "severity": severity, "message": message,
            "suggestion": suggestion, "line": line}


def _to_pascal(name: str) -> str:
    return name[0].upper() + name[1:] if name else name


def _to_camel(name: str) -> str:
    clean = name.lstrip("_")
    return clean[0].lower() + clean[1:] if clean else name


def _is_pascal(name: str) -> bool:
    return bool(name) and name[0].isupper() and "_" not in name


def _is_camel(name: str) -> bool:
    return bool(name) and name[0].islower() and "_" not in name


def _is_private_field_format(name: str) -> bool:
    """_camelCase: starts with _, second char lowercase, no further underscores."""
    return (
        name.startswith("_")
        and len(name) > 1
        and name[1].islower()
        and "_" not in name[1:]
    )


# ── CQE001: no public fields ───────────────────────────────────────────────────

def check_no_public_fields(declarations: list[Declaration]) -> list[dict]:
    """Public fields should be properties. Exempt: const and static readonly."""
    violations = []
    for decl in declarations:
        if decl.kind != "field":
            continue
        if "public" not in decl.modifiers:
            continue
        if "const" in decl.modifiers:
            continue
        if "static" in decl.modifiers and "readonly" in decl.modifiers:
            continue
        violations.append(_violation(
            rule="CQE001", severity="error",
            message=f"Public field '{decl.name}' should be a property.",
            suggestion=f"Replace with: public Type {_to_pascal(decl.name)} {{ get; set; }}",
            line=decl.line,
        ))
    return violations


# ── CQE002: access modifier required ──────────────────────────────────────────

def check_access_modifiers(declarations: list[Declaration]) -> list[dict]:
    """Every class, method, and field must have an explicit access modifier."""
    violations = []
    for decl in declarations:
        if decl.kind == "variable":
            continue  # local variables don't have access modifiers
        if ACCESS_MODIFIERS & set(decl.modifiers):
            continue
        violations.append(_violation(
            rule="CQE002", severity="error",
            message=f"{decl.kind.capitalize()} '{decl.name}' has no access modifier.",
            suggestion=f"Add 'private' (or another modifier) before '{decl.name}'.",
            line=decl.line,
        ))
    return violations


# ── CQE003: class names PascalCase ────────────────────────────────────────────

def check_type_names(declarations: list[Declaration]) -> list[dict]:
    """Type names (class, struct, interface, enum, record) must be PascalCase."""
    violations = []
    for decl in declarations:
        if decl.kind not in ("class", "struct", "interface", "enum", "record"):
            continue
        if _is_pascal(decl.name):
            continue
        violations.append(_violation(
            rule="CQE003", severity="error",
            message=f"Type '{decl.name}' is not PascalCase.",
            suggestion=f"Rename to '{_to_pascal(decl.name)}'.",
            line=decl.line,
        ))
    return violations


# ── CQE004: method names PascalCase ───────────────────────────────────────────

def check_method_names(declarations: list[Declaration]) -> list[dict]:
    """Method names must be PascalCase."""
    violations = []
    for decl in declarations:
        if decl.kind != "method":
            continue
        if _is_pascal(decl.name):
            continue
        violations.append(_violation(
            rule="CQE004", severity="error",
            message=f"Method '{decl.name}' is not PascalCase.",
            suggestion=f"Rename to '{_to_pascal(decl.name)}'.",
            line=decl.line,
        ))
    return violations


# ── CQE005: variable names camelCase ──────────────────────────────────────────

def check_variable_names(declarations: list[Declaration]) -> list[dict]:
    """Local variable names must be camelCase."""
    violations = []
    for decl in declarations:
        if decl.kind != "variable":
            continue
        if _is_camel(decl.name):
            continue
        violations.append(_violation(
            rule="CQE005", severity="error",
            message=f"Variable '{decl.name}' is not camelCase.",
            suggestion=f"Rename to '{_to_camel(decl.name)}'.",
            line=decl.line,
        ))
    return violations


# ── CQE006: private fields _camelCase ─────────────────────────────────────────

def check_private_field_names(declarations: list[Declaration]) -> list[dict]:
    """Private fields must follow the _camelCase convention."""
    violations = []
    for decl in declarations:
        if decl.kind != "field":
            continue
        if "const" in decl.modifiers or "static" in decl.modifiers:
            continue
        is_private = (
            "private" in decl.modifiers
            or not (ACCESS_MODIFIERS & set(decl.modifiers))
        )
        if not is_private:
            continue
        if _is_private_field_format(decl.name):
            continue
        violations.append(_violation(
            rule="CQE006", severity="error",
            message=f"Private field '{decl.name}' should be '_camelCase'.",
            suggestion=f"Rename to '_{_to_camel(decl.name)}'.",
            line=decl.line,
        ))
    return violations


# ── CQE008: no magic numbers ──────────────────────────────────────────────────

_NUMBER_RE    = re.compile(r"\b\d+(?:\.\d+)?[fFdDmMuUlL]?\b")
_MAGIC_WHITELIST = frozenset({0, 1, 2})

# Matches bare enum value lines like "Active = 10," or "Inactive,"
_ENUM_VALUE_RE = re.compile(r"^\w+\s*(?:=\s*[\d.]+[fFdDmMuUlL]?\s*)?[,]?$")


def check_magic_numbers(source: str) -> list[dict]:
    """Numeric literals that are not 0, 1 or 2 must be named constants."""
    violations = []
    for lineno, line in enumerate(source.splitlines(), start=1):
        stripped = line.strip()

        if not stripped:
            continue

        words = stripped.split()

        # Skip const declarations and field/member initializations with modifiers
        has_const    = "const" in words
        has_modifier = bool({"public", "private", "protected", "internal",
                             "readonly", "static"} & set(words))
        if has_const or has_modifier:
            continue

        # Skip enum value assignments like "Active = 10," or "Deleted = 30"
        if _ENUM_VALUE_RE.fullmatch(stripped):
            continue

        for match in _NUMBER_RE.finditer(stripped):
            raw = match.group(0).rstrip("fFdDmMuUlL")
            try:
                value = float(raw)
            except ValueError:
                continue
            if value in _MAGIC_WHITELIST:
                continue
            violations.append(_violation(
                rule="CQE008", severity="warning",
                message=f"Magic number '{match.group(0)}' found.",
                suggestion="Replace with a named constant: const float NAME = value;",
                line=lineno,
            ))
    return violations


# ── CQE009: Unity SerializeField ──────────────────────────────────────────────

def check_serialize_field(declarations: list[Declaration]) -> list[dict]:
    """Public fields in Unity should use [SerializeField] private instead."""
    violations = []
    for decl in declarations:
        if decl.kind != "field":
            continue
        if "public" not in decl.modifiers:
            continue
        if "const" in decl.modifiers or "static" in decl.modifiers:
            continue
        if "SerializeField" in decl.attributes:
            continue
        violations.append(_violation(
            rule="CQE009", severity="warning",
            message=f"Public field '{decl.name}' exposes Unity serialized data.",
            suggestion="Use '[SerializeField] private' instead of 'public'.",
            line=decl.line,
        ))
    return violations


# ── CQE010: Awake vs Start ────────────────────────────────────────────────────

def check_awake_vs_start(declarations: list[Declaration]) -> list[dict]:
    """Unity classes should not have both Awake() and Start(), and should have
    at least one of them if they use lifecycle callbacks."""
    violations = []
    methods = [d for d in declarations if d.kind == "method"]

    # Group methods by their parent class
    by_class: dict[str, list[Declaration]] = {}
    for method in methods:
        key = method.parent or "__global__"
        by_class.setdefault(key, []).append(method)

    for class_name, class_methods in by_class.items():
        names = {m.name for m in class_methods}
        has_awake     = "Awake" in names
        has_start     = "Start" in names
        has_lifecycle = bool(names & UNITY_LIFECYCLE)

        if has_awake and has_start:
            awake = next(m for m in class_methods if m.name == "Awake")
            violations.append(_violation(
                rule="CQE010", severity="warning",
                message=f"'{class_name}' has both Awake() and Start().",
                suggestion="Consolidate initialization into Awake() only.",
                line=awake.line,
            ))
        elif has_lifecycle and not has_awake and not has_start:
            first = min((m for m in class_methods if m.name in UNITY_LIFECYCLE),
                        key=lambda m: m.line)
            violations.append(_violation(
                rule="CQE010", severity="warning",
                message=f"'{class_name}' has Unity callbacks but no Awake() or Start().",
                suggestion="Add an Awake() method for explicit initialization.",
                line=first.line,
            ))

    return violations


# ── CQE011: LLM naming quality ────────────────────────────────────────────────

def check_names_with_llm(declarations: list[Declaration]) -> list[dict]:
    """Ask the LLM to identify meaningless or non-English identifier names."""
    try:
        from .llm import find_bad_names
    except ImportError:
        return []

    # Check classes, methods and fields – not local variables (too noisy)
    candidates = [(d.name, d.kind) for d in declarations
                  if d.kind not in ("variable",)]

    bad = find_bad_names(candidates)

    name_to_line = {d.name: d.line for d in declarations}
    violations = []
    for name, reason in bad:
        violations.append(_violation(
            rule="CQE011", severity="warning",
            message=f"Unclear name '{name}': {reason}",
            suggestion="Use a clear, descriptive English identifier.",
            line=name_to_line.get(name, 0),
        ))
    return violations


# ── run_rules ─────────────────────────────────────────────────────────────────

def run_rules(declarations: list[Declaration], source: str,
              use_llm: bool = True) -> list[dict]:
    violations = []
    violations += check_no_public_fields(declarations)
    violations += check_access_modifiers(declarations)
    violations += check_type_names(declarations)
    violations += check_method_names(declarations)
    violations += check_variable_names(declarations)
    violations += check_private_field_names(declarations)
    violations += check_magic_numbers(source)
    violations += check_serialize_field(declarations)
    violations += check_awake_vs_start(declarations)

    if use_llm:
        violations += check_names_with_llm(declarations)

    return sorted(violations, key=lambda v: v["line"])
