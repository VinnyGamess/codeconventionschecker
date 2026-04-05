"""
Parse C# source files into Declaration objects.

Pipeline per file:
    1. strip_comments  – remove // and /* */ so patterns don't match inside comments
    2. extract         – walk lines line-by-line, track scope depth, match declarations
"""

import re
import pathlib
from dataclasses import dataclass, field


@dataclass
class Declaration:
    kind:       str         # class | struct | interface | enum | record | method | field | variable
    name:       str
    modifiers:  list[str]
    attributes: list[str]
    line:       int
    parent:     str | None = None   # name of the enclosing class (for methods and fields)


# ── Keyword sets ───────────────────────────────────────────────────────────────

MODIFIERS = {
    "public", "private", "protected", "internal",
    "static", "readonly", "abstract", "virtual", "override",
    "sealed", "partial", "async", "const", "extern", "new",
}

ACCESS_MODIFIERS = {"public", "private", "protected", "internal"}

TYPE_KEYWORDS = {"class", "struct", "interface", "enum", "record"}

CONTROL_FLOW = {
    "if", "else", "for", "foreach", "while", "do", "switch",
    "case", "return", "break", "continue", "try", "catch",
    "finally", "throw", "lock", "using", "yield", "await",
}


# ── Step 1: strip comments ─────────────────────────────────────────────────────

_COMMENT_PATTERN = re.compile(
    r'@"[^"]*(?:""[^"]*)*"'   # verbatim string  @"..."
    r'|"(?:[^"\\]|\\.)*"'     # regular string   "..."
    r"|'(?:[^'\\]|\\.)*'"     # char literal     '.'
    r"|//[^\n]*"              # line comment      // ...
    r"|/\*.*?\*/",            # block comment     /* ... */
    re.DOTALL,
)


def strip_comments(source: str) -> str:
    """Remove // and /* */ comments while preserving line numbers."""
    def replace(match: re.Match) -> str:
        text = match.group(0)
        # It's a comment: keep newlines so line numbers stay correct
        if text.startswith("/"):
            return "\n" * text.count("\n")
        # It's a string literal: leave it untouched
        return text

    return _COMMENT_PATTERN.sub(replace, source)


# ── Step 2: regex patterns for each declaration kind ──────────────────────────

# [modifiers] class|struct|... Name
_TYPE_RE = re.compile(
    r"^((?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*)"
    r"(class|struct|interface|enum|record)\s+(\w+)"
)

# [modifiers] ReturnType MethodName(
# The return type is matched lazily so the last word before '(' is the name.
_METHOD_RE = re.compile(
    r"^((?:(?:public|private|protected|internal|static|abstract|virtual|override|"
    r"async|sealed|partial|extern|new)\s+)*)"
    r"[\w<>\[\],?\s]+?\s+(\w+)\s*\("
)

# [modifiers] Type FieldName ; or =
_FIELD_RE = re.compile(
    r"^((?:(?:public|private|protected|internal|static|readonly|const|"
    r"abstract|virtual|override|extern|new)\s+)*)"
    r"(?:[\w<>\[\],?]+\s+)+"
    r"(\w+)\s*[;=]"
)

# Type varName = or var varName =  (local variables)
_VAR_RE = re.compile(
    r"^(?:var|[\w<>\[\],?]+)\s+(\w+)\s*[=;]"
)


def _split_modifiers(raw: str) -> list[str]:
    return raw.split() if raw else []


def _is_reserved(name: str) -> bool:
    return name in CONTROL_FLOW or name in TYPE_KEYWORDS or name in MODIFIERS


def _match_type(line: str, attrs: list[str], lineno: int) -> Declaration | None:
    m = _TYPE_RE.match(line)
    if not m:
        return None
    return Declaration(
        kind=m.group(2), name=m.group(3),
        modifiers=_split_modifiers(m.group(1)), attributes=list(attrs), line=lineno,
    )


def _match_method(line: str, attrs: list[str], lineno: int) -> Declaration | None:
    # Skip lines starting with a control-flow keyword (e.g. "if (", "foreach (")
    first_word = re.match(r"\w+", line)
    if first_word and first_word.group(0) in CONTROL_FLOW:
        return None
    m = _METHOD_RE.match(line)
    if not m or _is_reserved(m.group(2)):
        return None
    return Declaration(
        kind="method", name=m.group(2),
        modifiers=_split_modifiers(m.group(1)), attributes=list(attrs), line=lineno,
    )


def _match_field(line: str, attrs: list[str], lineno: int) -> Declaration | None:
    first_word = re.match(r"\w+", line)
    if first_word and first_word.group(0) in CONTROL_FLOW:
        return None
    m = _FIELD_RE.match(line)
    if not m or _is_reserved(m.group(2)):
        return None
    return Declaration(
        kind="field", name=m.group(2),
        modifiers=_split_modifiers(m.group(1)), attributes=list(attrs), line=lineno,
    )


def _match_variable(line: str, lineno: int) -> Declaration | None:
    first_word = re.match(r"\w+", line)
    if first_word and first_word.group(0) in CONTROL_FLOW:
        return None
    m = _VAR_RE.match(line)
    if not m or _is_reserved(m.group(1)):
        return None
    return Declaration(
        kind="variable", name=m.group(1),
        modifiers=[], attributes=[], line=lineno,
    )


# ── Step 3: extract declarations with scope tracking ──────────────────────────

def extract(lines: list[str]) -> list[Declaration]:
    """
    Walk lines and extract declarations.

    We track a scope_stack where each entry is one of:
      "namespace" | "type" | "method" | "block"

    The current scope tells us what kind of declaration to look for:
      global / namespace  →  type declarations (class, struct, ...)
      type                →  members: methods and fields
      method / block      →  local variables

    When a brace { does not immediately follow a declaration (Allman style),
    pending_push holds the scope to create when we see the next {.
    """
    declarations  = []
    scope_stack   = []      # stack of scope names
    class_names   = []      # stack of enclosing class names (for parent tracking)
    pending_attrs = []      # attributes accumulated before the next declaration
    pending_push  = None    # scope to push when the next { is encountered
    pending_class = None    # class name to push onto class_names alongside pending_push

    for lineno, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()

        if not line:
            continue

        # ── Attribute annotations like [SerializeField] or [Header("...")] ───
        if line.startswith("["):
            match = re.search(r"\[(\w[\w.]*)", line)
            if match:
                pending_attrs.append(match.group(1))
            continue

        current = scope_stack[-1] if scope_stack else "global"
        decl = None

        # ── Namespace block: just track scope, no Declaration needed ─────────
        if re.match(r"^namespace\b", line):
            pending_push = "namespace"

        # ── Global or namespace level: look for type declarations ─────────────
        elif current in ("global", "namespace"):
            decl = _match_type(line, pending_attrs, lineno)
            if decl:
                pending_push = "type"
                pending_class = decl.name

        # ── Inside a class body: look for methods and fields ─────────────────
        elif current == "type":
            decl = (
                _match_method(line, pending_attrs, lineno)
                or _match_field(line, pending_attrs, lineno)
            )
            if decl:
                # A method whose name matches the class name is a constructor – skip it.
                # (The regex can misidentify constructors due to backtracking;
                #  constructors are also intentionally excluded from rule checks.)
                enclosing = class_names[-1] if class_names else None
                if decl.kind == "method" and decl.name == enclosing:
                    decl = None
                else:
                    decl.parent = enclosing
                    if decl.kind == "method":
                        pending_push = "method"

        # ── Inside a method or block: look for local variables ───────────────
        elif current in ("method", "block"):
            decl = _match_variable(line, lineno)

        if decl:
            declarations.append(decl)
            pending_attrs = []
        else:
            pending_attrs = []

        # ── Update scope stack based on { and } on this line ─────────────────
        opens  = line.count("{")
        closes = line.count("}")

        for i in range(opens):
            if i == 0 and pending_push is not None:
                scope_stack.append(pending_push)
                if pending_push == "type" and pending_class:
                    class_names.append(pending_class)
                    pending_class = None
                pending_push = None
            else:
                scope_stack.append("block")

        for _ in range(closes):
            if scope_stack:
                popped = scope_stack.pop()
                if popped == "type" and class_names:
                    class_names.pop()

    return declarations


def parse_file(filepath: pathlib.Path) -> list[Declaration]:
    source = filepath.read_text(encoding="utf-8", errors="ignore")
    clean  = strip_comments(source)
    return extract(clean.splitlines())
