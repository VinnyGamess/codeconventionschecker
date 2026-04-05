#nullable disable
using System.Globalization;
using System.Text.RegularExpressions;

public class Violation
{
    public string Rule;
    public string Severity;
    public string Message;
    public string Suggestion;
    public int Line;

    public Violation(string rule, string severity, string message, string suggestion, int line)
    {
        Rule = rule;
        Severity = severity;
        Message = message;
        Suggestion = suggestion;
        Line = line;
    }
}

public static class Rules
{
    static readonly List<string> AccessModifiers = new List<string> { "public", "private", "protected", "internal" };

    static readonly List<string> UnityLifecycle = new List<string>
    {
        "Update", "FixedUpdate", "LateUpdate",
        "OnEnable", "OnDisable", "OnDestroy",
        "OnCollisionEnter", "OnCollisionStay", "OnCollisionExit",
        "OnTriggerEnter", "OnTriggerStay", "OnTriggerExit",
    };

    static readonly Regex NumberRe = new Regex(@"\b\d+(?:\.\d+)?[fFdDmMuUlL]?\b");
    static readonly Regex EnumValueRe = new Regex(@"^\w+\s*(?:=\s*[\d.]+[fFdDmMuUlL]?\s*)?[,]?$");
    static readonly double[] AllowedNumbers = new double[] { 0, 1, 2 };
    static readonly List<string> DeclarationWords = new List<string>
        { "public", "private", "protected", "internal", "readonly", "static", "const" };

    static Violation Make(string rule, string severity, string message, string suggestion, int line)
    {
        return new Violation(rule, severity, message, suggestion, line);
    }

    static string ToPascalCase(string name)
    {
        if (name.Length == 0) return name;
        return char.ToUpper(name[0]) + name.Substring(1);
    }

    static string ToCamelCase(string name)
    {
        string s = name.TrimStart('_');
        if (s.Length == 0) return s;
        return char.ToLower(s[0]) + s.Substring(1);
    }

    static bool IsPascalCase(string name)
    {
        return name.Length > 0 && char.IsUpper(name[0]) && !name.Contains('_');
    }

    static bool IsCamelCase(string name)
    {
        return name.Length > 0 && char.IsLower(name[0]) && !name.Contains('_');
    }

    static bool IsValidPrivateField(string name)
    {
        if (!name.StartsWith("_")) return false;
        if (name.Length <= 1) return false;
        if (!char.IsLower(name[1])) return false;
        if (name.Substring(1).Contains('_')) return false;
        return true;
    }

    static bool IsAllowedNumber(double value)
    {
        foreach (double n in AllowedNumbers)
            if (n == value) return true;
        return false;
    }

    static int CompareByLine(Violation a, Violation b)
    {
        return a.Line - b.Line;
    }

    public static List<Violation> Run(List<Declaration> declarations, string source, bool useLlm)
    {
        List<Violation> violations = new List<Violation>();
        violations.AddRange(CheckNoPublicFields(declarations));
        violations.AddRange(CheckAccessModifiers(declarations));
        violations.AddRange(CheckTypeNames(declarations));
        violations.AddRange(CheckMethodNames(declarations));
        violations.AddRange(CheckVariableNames(declarations));
        violations.AddRange(CheckPrivateFieldNames(declarations));
        violations.AddRange(CheckMagicNumbers(source));
        violations.AddRange(CheckSerializeField(declarations));
        violations.AddRange(CheckAwakeVsStart(declarations));
        if (useLlm) violations.AddRange(CheckNamesWithLlm(declarations));
        violations.Sort(CompareByLine);
        return violations;
    }

    static List<Violation> CheckNoPublicFields(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        foreach (Declaration d in declarations)
        {
            if (d.Kind != "field") continue;
            if (!d.Modifiers.Contains("public")) continue;
            if (d.Modifiers.Contains("const")) continue;
            if (d.Modifiers.Contains("static") && d.Modifiers.Contains("readonly")) continue;
            violations.Add(Make("CQE001", "error",
                "Public field '" + d.Name + "' should be a property.",
                "Replace with: public Type " + ToPascalCase(d.Name) + " { get; set; }", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckAccessModifiers(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        foreach (Declaration d in declarations)
        {
            if (d.Kind == "variable") continue;
            bool hasAccessModifier = false;
            foreach (string mod in d.Modifiers)
            {
                if (AccessModifiers.Contains(mod))
                {
                    hasAccessModifier = true;
                    break;
                }
            }
            if (hasAccessModifier) continue;
            string kindCapitalized = char.ToUpper(d.Kind[0]) + d.Kind.Substring(1);
            violations.Add(Make("CQE002", "error",
                kindCapitalized + " '" + d.Name + "' has no access modifier.",
                "Add 'private' (or another modifier) before '" + d.Name + "'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckTypeNames(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        foreach (Declaration d in declarations)
        {
            if (d.Kind != "class" && d.Kind != "struct" && d.Kind != "interface"
                && d.Kind != "enum" && d.Kind != "record") continue;
            if (IsPascalCase(d.Name)) continue;
            violations.Add(Make("CQE003", "error",
                "Type '" + d.Name + "' is not PascalCase.",
                "Rename to '" + ToPascalCase(d.Name) + "'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckMethodNames(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        foreach (Declaration d in declarations)
        {
            if (d.Kind != "method") continue;
            if (IsPascalCase(d.Name)) continue;
            violations.Add(Make("CQE004", "error",
                "Method '" + d.Name + "' is not PascalCase.",
                "Rename to '" + ToPascalCase(d.Name) + "'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckVariableNames(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        foreach (Declaration d in declarations)
        {
            if (d.Kind != "variable") continue;
            if (IsCamelCase(d.Name)) continue;
            violations.Add(Make("CQE005", "error",
                "Variable '" + d.Name + "' is not camelCase.",
                "Rename to '" + ToCamelCase(d.Name) + "'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckPrivateFieldNames(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        foreach (Declaration d in declarations)
        {
            if (d.Kind != "field") continue;
            if (d.Modifiers.Contains("const") || d.Modifiers.Contains("static")) continue;
            bool isPrivate = d.Modifiers.Contains("private");
            if (!isPrivate)
            {
                bool hasAccessModifier = false;
                foreach (string mod in d.Modifiers)
                {
                    if (AccessModifiers.Contains(mod))
                    {
                        hasAccessModifier = true;
                        break;
                    }
                }
                isPrivate = !hasAccessModifier;
            }
            if (!isPrivate) continue;
            if (IsValidPrivateField(d.Name)) continue;
            violations.Add(Make("CQE006", "error",
                "Private field '" + d.Name + "' should be '_camelCase'.",
                "Rename to '_" + ToCamelCase(d.Name) + "'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckMagicNumbers(string source)
    {
        List<Violation> violations = new List<Violation>();
        int lineNumber = 0;
        foreach (string rawLine in source.Split('\n'))
        {
            lineNumber++;
            string line = rawLine.Trim();
            if (string.IsNullOrEmpty(line)) continue;

            string[] words = line.Split(' ');
            bool hasDeclarationWord = false;
            foreach (string word in words)
            {
                if (DeclarationWords.Contains(word))
                {
                    hasDeclarationWord = true;
                    break;
                }
            }
            if (hasDeclarationWord) continue;
            if (EnumValueRe.IsMatch(line)) continue;

            foreach (Match match in NumberRe.Matches(line))
            {
                string numStr = match.Value.TrimEnd('f', 'F', 'd', 'D', 'm', 'M', 'u', 'U', 'l', 'L');
                double numValue;
                if (!double.TryParse(numStr, NumberStyles.Any, CultureInfo.InvariantCulture, out numValue)) continue;
                if (IsAllowedNumber(numValue)) continue;
                violations.Add(Make("CQE008", "warning",
                    "Magic number '" + match.Value + "' found.",
                    "Replace with a named constant: const float NAME = value;", lineNumber));
            }
        }
        return violations;
    }

    static List<Violation> CheckSerializeField(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        foreach (Declaration d in declarations)
        {
            if (d.Kind != "field") continue;
            if (!d.Modifiers.Contains("public")) continue;
            if (d.Modifiers.Contains("const") || d.Modifiers.Contains("static")) continue;
            if (d.Attributes.Contains("SerializeField")) continue;
            violations.Add(Make("CQE009", "warning",
                "Public field '" + d.Name + "' exposes Unity serialized data.",
                "Use '[SerializeField] private' instead of 'public'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckAwakeVsStart(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        Dictionary<string, List<Declaration>> byClass = new Dictionary<string, List<Declaration>>();

        foreach (Declaration d in declarations)
        {
            if (d.Kind != "method") continue;
            string className;
            if (d.Parent != null)
                className = d.Parent;
            else
                className = "__global__";
            if (!byClass.ContainsKey(className))
                byClass[className] = new List<Declaration>();
            byClass[className].Add(d);
        }

        foreach (string className in byClass.Keys)
        {
            List<Declaration> methods = byClass[className];
            bool hasAwake = false;
            bool hasStart = false;
            bool hasLifecycle = false;

            foreach (Declaration m in methods)
            {
                if (m.Name == "Awake") hasAwake = true;
                if (m.Name == "Start") hasStart = true;
                if (UnityLifecycle.Contains(m.Name)) hasLifecycle = true;
            }

            if (hasAwake && hasStart)
            {
                Declaration awake = null;
                foreach (Declaration m in methods)
                    if (m.Name == "Awake") { awake = m; break; }
                violations.Add(Make("CQE010", "warning",
                    "'" + className + "' has both Awake() and Start().",
                    "Consolidate initialization into Awake() only.", awake.Line));
            }
            else if (hasLifecycle && !hasAwake && !hasStart)
            {
                Declaration first = null;
                foreach (Declaration m in methods)
                {
                    if (UnityLifecycle.Contains(m.Name))
                    {
                        if (first == null || m.Line < first.Line)
                            first = m;
                    }
                }
                violations.Add(Make("CQE010", "warning",
                    "'" + className + "' has Unity callbacks but no Awake() or Start().",
                    "Add an Awake() method for explicit initialization.", first.Line));
            }
        }
        return violations;
    }

    static List<Violation> CheckNamesWithLlm(List<Declaration> declarations)
    {
        List<Violation> violations = new List<Violation>();
        List<NameKind> candidates = new List<NameKind>();
        foreach (Declaration d in declarations)
            if (d.Kind != "variable")
                candidates.Add(new NameKind(d.Name, d.Kind));

        List<NameResult> flagged = Llm.FindBadNames(candidates);

        Dictionary<string, int> linePerName = new Dictionary<string, int>();
        foreach (Declaration d in declarations)
            linePerName[d.Name] = d.Line;

        foreach (NameResult r in flagged)
        {
            int line = 0;
            if (linePerName.ContainsKey(r.Name))
                line = linePerName[r.Name];
            violations.Add(Make("CQE011", "warning",
                "Unclear name '" + r.Name + "': " + r.Reason,
                "Use a clear, descriptive English identifier.", line));
        }
        return violations;
    }
}
