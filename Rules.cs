using System.Globalization;
using System.Text.RegularExpressions;

public record Violation(string Rule, string Severity, string Message, string Suggestion, int Line);

public static class Rules
{
    static readonly HashSet<string> AccessModifiers = new() { "public", "private", "protected", "internal" };

    static readonly HashSet<string> UnityLifecycle = new()
    {
        "Update", "FixedUpdate", "LateUpdate",
        "OnEnable", "OnDisable", "OnDestroy",
        "OnCollisionEnter", "OnCollisionStay", "OnCollisionExit",
        "OnTriggerEnter", "OnTriggerStay", "OnTriggerExit",
    };

    static readonly Regex  NumberRe       = new(@"\b\d+(?:\.\d+)?[fFdDmMuUlL]?\b");
    static readonly Regex  EnumValueRe    = new(@"^\w+\s*(?:=\s*[\d.]+[fFdDmMuUlL]?\s*)?[,]?$");
    static readonly HashSet<double> AllowedNumbers   = new() { 0, 1, 2 };
    static readonly HashSet<string> DeclarationWords = new() { "public", "private", "protected", "internal", "readonly", "static", "const" };

    static Violation Make(string rule, string severity, string message, string suggestion, int line)
        => new(rule, severity, message, suggestion, line);

    static string ToPascalCase(string name) => name.Length > 0 ? char.ToUpper(name[0]) + name[1..] : name;
    static string ToCamelCase(string name)  { var s = name.TrimStart('_'); return s.Length > 0 ? char.ToLower(s[0]) + s[1..] : s; }
    static bool IsPascalCase(string name)   => name.Length > 0 && char.IsUpper(name[0]) && !name.Contains('_');
    static bool IsCamelCase(string name)    => name.Length > 0 && char.IsLower(name[0]) && !name.Contains('_');
    static bool IsValidPrivateField(string name) =>
        name.StartsWith("_") && name.Length > 1 && char.IsLower(name[1]) && !name[1..].Contains('_');

    public static List<Violation> Run(List<Declaration> declarations, string source, bool useLlm)
    {
        var violations = new List<Violation>();
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
        return violations.OrderBy(v => v.Line).ToList();
    }

    static IEnumerable<Violation> CheckNoPublicFields(List<Declaration> declarations)
    {
        foreach (var d in declarations)
        {
            if (d.Kind != "field") continue;
            if (!d.Modifiers.Contains("public")) continue;
            if (d.Modifiers.Contains("const")) continue;
            if (d.Modifiers.Contains("static") && d.Modifiers.Contains("readonly")) continue;
            yield return Make("CQE001", "error",
                $"Public field '{d.Name}' should be a property.",
                $"Replace with: public Type {ToPascalCase(d.Name)} {{ get; set; }}", d.Line);
        }
    }

    static IEnumerable<Violation> CheckAccessModifiers(List<Declaration> declarations)
    {
        foreach (var d in declarations)
        {
            if (d.Kind == "variable") continue;
            if (d.Modifiers.Any(m => AccessModifiers.Contains(m))) continue;
            yield return Make("CQE002", "error",
                $"{char.ToUpper(d.Kind[0]) + d.Kind[1..]} '{d.Name}' has no access modifier.",
                $"Add 'private' (or another modifier) before '{d.Name}'.", d.Line);
        }
    }

    static IEnumerable<Violation> CheckTypeNames(List<Declaration> declarations)
    {
        foreach (var d in declarations)
        {
            if (d.Kind is not ("class" or "struct" or "interface" or "enum" or "record")) continue;
            if (IsPascalCase(d.Name)) continue;
            yield return Make("CQE003", "error",
                $"Type '{d.Name}' is not PascalCase.",
                $"Rename to '{ToPascalCase(d.Name)}'.", d.Line);
        }
    }

    static IEnumerable<Violation> CheckMethodNames(List<Declaration> declarations)
    {
        foreach (var d in declarations)
        {
            if (d.Kind != "method") continue;
            if (IsPascalCase(d.Name)) continue;
            yield return Make("CQE004", "error",
                $"Method '{d.Name}' is not PascalCase.",
                $"Rename to '{ToPascalCase(d.Name)}'.", d.Line);
        }
    }

    static IEnumerable<Violation> CheckVariableNames(List<Declaration> declarations)
    {
        foreach (var d in declarations)
        {
            if (d.Kind != "variable") continue;
            if (IsCamelCase(d.Name)) continue;
            yield return Make("CQE005", "error",
                $"Variable '{d.Name}' is not camelCase.",
                $"Rename to '{ToCamelCase(d.Name)}'.", d.Line);
        }
    }

    static IEnumerable<Violation> CheckPrivateFieldNames(List<Declaration> declarations)
    {
        foreach (var d in declarations)
        {
            if (d.Kind != "field") continue;
            if (d.Modifiers.Contains("const") || d.Modifiers.Contains("static")) continue;
            var isPrivate = d.Modifiers.Contains("private") || !d.Modifiers.Any(m => AccessModifiers.Contains(m));
            if (!isPrivate) continue;
            if (IsValidPrivateField(d.Name)) continue;
            yield return Make("CQE006", "error",
                $"Private field '{d.Name}' should be '_camelCase'.",
                $"Rename to '_{ToCamelCase(d.Name)}'.", d.Line);
        }
    }

    static IEnumerable<Violation> CheckMagicNumbers(string source)
    {
        int lineNumber = 0;
        foreach (var rawLine in source.Split('\n'))
        {
            lineNumber++;
            var line = rawLine.Trim();
            if (string.IsNullOrEmpty(line)) continue;

            var words = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (words.Any(w => DeclarationWords.Contains(w))) continue;
            if (EnumValueRe.IsMatch(line)) continue;

            foreach (Match match in NumberRe.Matches(line))
            {
                var numStr = match.Value.TrimEnd('f', 'F', 'd', 'D', 'm', 'M', 'u', 'U', 'l', 'L');
                if (!double.TryParse(numStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var numValue)) continue;
                if (AllowedNumbers.Contains(numValue)) continue;
                yield return Make("CQE008", "warning",
                    $"Magic number '{match.Value}' found.",
                    "Replace with a named constant: const float NAME = value;", lineNumber);
            }
        }
    }

    static IEnumerable<Violation> CheckSerializeField(List<Declaration> declarations)
    {
        foreach (var d in declarations)
        {
            if (d.Kind != "field") continue;
            if (!d.Modifiers.Contains("public")) continue;
            if (d.Modifiers.Contains("const") || d.Modifiers.Contains("static")) continue;
            if (d.Attributes.Contains("SerializeField")) continue;
            yield return Make("CQE009", "warning",
                $"Public field '{d.Name}' exposes Unity serialized data.",
                "Use '[SerializeField] private' instead of 'public'.", d.Line);
        }
    }

    static IEnumerable<Violation> CheckAwakeVsStart(List<Declaration> declarations)
    {
        var methods = declarations.Where(d => d.Kind == "method");
        var byClass = methods.GroupBy(m => m.Parent ?? "__global__");

        foreach (var group in byClass)
        {
            var names        = group.Select(m => m.Name).ToHashSet();
            bool hasAwake    = names.Contains("Awake");
            bool hasStart    = names.Contains("Start");
            bool hasLifecycle = names.Overlaps(UnityLifecycle);

            if (hasAwake && hasStart)
            {
                var awake = group.First(m => m.Name == "Awake");
                yield return Make("CQE010", "warning",
                    $"'{group.Key}' has both Awake() and Start().",
                    "Consolidate initialization into Awake() only.", awake.Line);
            }
            else if (hasLifecycle && !hasAwake && !hasStart)
            {
                var first = group.Where(m => UnityLifecycle.Contains(m.Name)).MinBy(m => m.Line)!;
                yield return Make("CQE010", "warning",
                    $"'{group.Key}' has Unity callbacks but no Awake() or Start().",
                    "Add an Awake() method for explicit initialization.", first.Line);
            }
        }
    }

    static IEnumerable<Violation> CheckNamesWithLlm(List<Declaration> declarations)
    {
        var candidates  = declarations.Where(d => d.Kind != "variable").Select(d => (d.Name, d.Kind)).ToList();
        var flagged     = Llm.FindBadNames(candidates);
        var linePerName = declarations.ToDictionary(d => d.Name, d => d.Line);

        foreach (var (name, reason) in flagged)
            yield return Make("CQE011", "warning",
                $"Unclear name '{name}': {reason}",
                "Use a clear, descriptive English identifier.",
                linePerName.GetValueOrDefault(name, 0));
    }
}
