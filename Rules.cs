#nullable disable
using System.Globalization;
using System.Text.RegularExpressions;

public class Violation
{
    public string Rule, Severity, Message, Suggestion;
    public int Line;

    public Violation(string rule, string severity, string message, string suggestion, int line)
    {
        Rule = rule; Severity = severity; Message = message; Suggestion = suggestion; Line = line;
    }
}

public static class Rules
{
    static readonly string[] AccessMods = { "public", "private", "protected", "internal" };
    static readonly string[] UnityLifecycle = {
        "Update", "FixedUpdate", "LateUpdate", "OnEnable", "OnDisable", "OnDestroy",
        "OnCollisionEnter", "OnCollisionStay", "OnCollisionExit",
        "OnTriggerEnter", "OnTriggerStay", "OnTriggerExit"
    };
    static readonly Regex NumberRe = new Regex(@"\b\d+(?:\.\d+)?[fFdDmMuUlL]?\b");
    static readonly Regex EnumRe = new Regex(@"^\w+\s*(?:=\s*[\d.]+[fFdDmMuUlL]?\s*)?[,]?$");
    static readonly double[] SafeNums = { 0, 1, 2 };
    static readonly string[] DeclWords = { "public", "private", "protected", "internal", "readonly", "static", "const" };

    static Violation V(string rule, string sev, string msg, string hint, int line) =>
        new Violation(rule, sev, msg, hint, line);

    static bool IsPascal(string n) => n.Length > 0 && char.IsUpper(n[0]) && !n.Contains('_');
    static bool IsCamel(string n) => n.Length > 0 && char.IsLower(n[0]) && !n.Contains('_');
    static bool IsValidField(string n) => n.StartsWith("_") && n.Length > 1 && char.IsLower(n[1]) && !n.Substring(1).Contains('_');
    static string ToPascal(string n) => n.Length == 0 ? n : char.ToUpper(n[0]) + n.Substring(1);
    static string ToCamel(string n) { var s = n.TrimStart('_'); return s.Length == 0 ? s : char.ToLower(s[0]) + s.Substring(1); }
    static bool HasAccessMod(List<string> mods) => mods.Any(m => AccessMods.Contains(m));

    public static List<Violation> Run(List<Declaration> decls, string source, bool useLlm)
    {
        var violations = new List<Violation>();
        violations.AddRange(CheckNoPublicFields(decls));
        violations.AddRange(CheckAccessModifiers(decls));
        violations.AddRange(CheckTypeNames(decls));
        violations.AddRange(CheckMethodNames(decls));
        violations.AddRange(CheckVariableNames(decls));
        violations.AddRange(CheckPrivateFieldNames(decls));
        violations.AddRange(CheckMagicNumbers(source));
        violations.AddRange(CheckSerializeField(decls));
        violations.AddRange(CheckAwakeVsStart(decls));
        if (useLlm) violations.AddRange(CheckNamesWithLlm(decls));
        violations.Sort((a, b) => a.Line - b.Line);
        return violations;
    }

    static List<Violation> CheckNoPublicFields(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        foreach (var d in decls)
        {
            if (d.Kind != "field" || !d.Modifiers.Contains("public") || d.Modifiers.Contains("const")
                || (d.Modifiers.Contains("static") && d.Modifiers.Contains("readonly"))) continue;
            violations.Add(V("CQE001", "error", $"Public field '{d.Name}' should be a property.",
                $"Replace with: public Type {ToPascal(d.Name)} {{ get; set; }}", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckAccessModifiers(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        foreach (var d in decls)
        {
            if (d.Kind == "variable" || HasAccessMod(d.Modifiers)) continue;
            violations.Add(V("CQE002", "error",
                $"{char.ToUpper(d.Kind[0]) + d.Kind.Substring(1)} '{d.Name}' has no access modifier.",
                $"Add 'private' (or another modifier) before '{d.Name}'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckTypeNames(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        foreach (var d in decls)
        {
            if (d.Kind is not ("class" or "struct" or "interface" or "enum" or "record")) continue;
            if (!IsPascal(d.Name))
                violations.Add(V("CQE003", "error", $"Type '{d.Name}' is not PascalCase.", $"Rename to '{ToPascal(d.Name)}'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckMethodNames(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        foreach (var d in decls)
            if (d.Kind == "method" && !IsPascal(d.Name))
                violations.Add(V("CQE004", "error", $"Method '{d.Name}' is not PascalCase.", $"Rename to '{ToPascal(d.Name)}'.", d.Line));
        return violations;
    }

    static List<Violation> CheckVariableNames(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        foreach (var d in decls)
            if (d.Kind == "variable" && !IsCamel(d.Name))
                violations.Add(V("CQE005", "error", $"Variable '{d.Name}' is not camelCase.", $"Rename to '{ToCamel(d.Name)}'.", d.Line));
        return violations;
    }

    static List<Violation> CheckPrivateFieldNames(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        foreach (var d in decls)
        {
            if (d.Kind != "field") continue;
            if (d.Modifiers.Contains("const") || d.Modifiers.Contains("static")) continue;
            bool isPrivate = d.Modifiers.Contains("private") || !HasAccessMod(d.Modifiers);
            if (!isPrivate || IsValidField(d.Name)) continue;
            violations.Add(V("CQE006", "error", $"Private field '{d.Name}' should be '_camelCase'.",
                $"Rename to '_{ToCamel(d.Name)}'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckMagicNumbers(string source)
    {
        var violations = new List<Violation>();
        int lineNum = 0;
        foreach (var rawLine in source.Split('\n'))
        {
            lineNum++;
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line)) continue;
            if (line.Split(' ').Any(w => DeclWords.Contains(w))) continue;
            if (EnumRe.IsMatch(line)) continue;
            foreach (Match m in NumberRe.Matches(line))
            {
                var numStr = m.Value.TrimEnd('f', 'F', 'd', 'D', 'm', 'M', 'u', 'U', 'l', 'L');
                if (!double.TryParse(numStr, NumberStyles.Any, CultureInfo.InvariantCulture, out double val)) continue;
                if (SafeNums.Contains(val)) continue;
                violations.Add(V("CQE008", "warning", $"Magic number '{m.Value}' found.",
                    "Replace with a named constant: const float NAME = value;", lineNum));
            }
        }
        return violations;
    }

    static List<Violation> CheckSerializeField(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        foreach (var d in decls)
        {
            if (d.Kind != "field" || !d.Modifiers.Contains("public") || d.Modifiers.Contains("const")
                || d.Modifiers.Contains("static") || d.Attributes.Contains("SerializeField")) continue;
            violations.Add(V("CQE009", "warning", $"Public field '{d.Name}' exposes Unity serialized data.",
                "Use '[SerializeField] private' instead of 'public'.", d.Line));
        }
        return violations;
    }

    static List<Violation> CheckAwakeVsStart(List<Declaration> decls)
    {
        var violations = new List<Violation>();
        var byClass = new Dictionary<string, List<Declaration>>();
        foreach (var d in decls.Where(d => d.Kind == "method"))
        {
            var cls = d.Parent ?? "__global__";
            if (!byClass.ContainsKey(cls)) byClass[cls] = new List<Declaration>();
            byClass[cls].Add(d);
        }
        foreach (var kv in byClass)
        {
            var methods = kv.Value;
            bool hasAwake = methods.Any(m => m.Name == "Awake");
            bool hasStart = methods.Any(m => m.Name == "Start");
            bool hasLifecycle = methods.Any(m => UnityLifecycle.Contains(m.Name));
            switch (hasAwake, hasStart, hasLifecycle)
            {
                case (true, true, _):
                    var awake = methods.First(m => m.Name == "Awake");
                    violations.Add(V("CQE010", "warning", $"'{kv.Key}' has both Awake() and Start().",
                        "Consolidate initialization into Awake() only.", awake.Line));
                    break;
                case (false, false, true):
                    var first = methods.Where(m => UnityLifecycle.Contains(m.Name)).OrderBy(m => m.Line).First();
                    violations.Add(V("CQE010", "warning", $"'{kv.Key}' has Unity callbacks but no Awake() or Start().",
                        "Add an Awake() method for explicit initialization.", first.Line));
                    break;
            }
        }
        return violations;
    }

    static List<Violation> CheckNamesWithLlm(List<Declaration> decls)
    {
        var candidates = decls.Where(d => d.Kind != "variable").Select(d => new NameKind(d.Name, d.Kind)).ToList();
        var flagged = Llm.FindBadNames(candidates);
        var linePerName = new Dictionary<string, int>();
        foreach (var d in decls) linePerName[d.Name] = d.Line;
        var violations = new List<Violation>();
        foreach (var r in flagged)
        {
            linePerName.TryGetValue(r.Name, out int line);
            violations.Add(V("CQE011", "warning", $"Unclear name '{r.Name}': {r.Reason}",
                "Use a clear, descriptive English identifier.", line));
        }
        return violations;
    }
}
