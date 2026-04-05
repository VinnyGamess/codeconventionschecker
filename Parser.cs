using System.Text.RegularExpressions;

public record Declaration(string Kind, string Name, List<string> Modifiers, List<string> Attributes, int Line, string? Parent = null);

public static class Parser
{
    static readonly HashSet<string> ControlFlow = new()
    {
        "if", "else", "for", "foreach", "while", "do", "switch",
        "case", "return", "break", "continue", "try", "catch",
        "finally", "throw", "lock", "using", "yield", "await",
    };

    static readonly HashSet<string> Modifiers = new()
    {
        "public", "private", "protected", "internal", "static", "readonly",
        "abstract", "virtual", "override", "sealed", "partial", "async",
        "const", "extern", "new",
    };

    static readonly HashSet<string> AccessModifiers = new() { "public", "private", "protected", "internal" };

    static readonly HashSet<string> ReservedWords = new(
        ControlFlow.Concat(Modifiers).Concat(new[] { "class", "struct", "interface", "enum", "record" })
    );

    static readonly Regex CommentRe = new(
        """@"[^"]*(?:""[^"]*)*"|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|//[^\n]*|/\*.*?\*/""",
        RegexOptions.Singleline
    );

    static readonly Regex TypeRe = new(
        """^((?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*)(class|struct|interface|enum|record)\s+(\w+)"""
    );

    static readonly Regex MethodRe = new(
        """^((?:(?:public|private|protected|internal|static|abstract|virtual|override|async|sealed|partial|extern|new)\s+)*)[\w<>\[\],?\s]+?\s+(\w+)\s*\("""
    );

    static readonly Regex FieldRe = new(
        """^((?:(?:public|private|protected|internal|static|readonly|const|abstract|virtual|override|extern|new)\s+)*)(?:[\w<>\[\],?]+\s+)+(\w+)\s*[;=]"""
    );

    static readonly Regex VarRe = new("""^(?:var|[\w<>\[\],?]+)\s+(\w+)\s*[;=]""");

    public static string StripComments(string source) =>
        CommentRe.Replace(source, m =>
            m.Value.StartsWith("/")
                ? new string('\n', m.Value.Count(c => c == '\n'))
                : m.Value
        );

    static string FirstWord(string line)
    {
        var m = Regex.Match(line, @"\w+");
        return m.Success ? m.Value : "";
    }

    static Declaration? MatchType(string line, List<string> attributes, int lineNumber)
    {
        var m = TypeRe.Match(line);
        if (!m.Success) return null;
        return new Declaration(m.Groups[2].Value, m.Groups[3].Value,
            m.Groups[1].Value.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList(),
            attributes, lineNumber);
    }

    static Declaration? MatchMethod(string line, List<string> attributes, int lineNumber)
    {
        if (ControlFlow.Contains(FirstWord(line))) return null;
        var m = MethodRe.Match(line);
        if (!m.Success || ReservedWords.Contains(m.Groups[2].Value)) return null;
        return new Declaration("method", m.Groups[2].Value,
            m.Groups[1].Value.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList(),
            attributes, lineNumber);
    }

    static Declaration? MatchField(string line, List<string> attributes, int lineNumber)
    {
        if (ControlFlow.Contains(FirstWord(line))) return null;
        var m = FieldRe.Match(line);
        if (!m.Success || ReservedWords.Contains(m.Groups[2].Value)) return null;
        return new Declaration("field", m.Groups[2].Value,
            m.Groups[1].Value.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList(),
            attributes, lineNumber);
    }

    static Declaration? MatchVariable(string line, int lineNumber)
    {
        if (ControlFlow.Contains(FirstWord(line))) return null;
        var m = VarRe.Match(line);
        if (!m.Success || ReservedWords.Contains(m.Groups[1].Value)) return null;
        return new Declaration("variable", m.Groups[1].Value, new List<string>(), new List<string>(), lineNumber);
    }

    public static List<Declaration> Extract(string[] lines)
    {
        var declarations       = new List<Declaration>();
        var scopeStack         = new Stack<string>();
        var classStack         = new Stack<string>();
        var pendingAttributes  = new List<string>();
        string? scopeForBrace  = null;
        string? classForBrace  = null;

        for (int i = 0; i < lines.Length; i++)
        {
            var line       = lines[i].Trim();
            var lineNumber = i + 1;

            if (string.IsNullOrEmpty(line)) continue;

            if (line.StartsWith("["))
            {
                var m = Regex.Match(line, @"\[(\w[\w.]*)");
                if (m.Success) pendingAttributes.Add(m.Groups[1].Value);
                continue;
            }

            var currentScope   = scopeStack.Count > 0 ? scopeStack.Peek() : "global";
            Declaration? found = null;

            if (Regex.IsMatch(line, @"^namespace\b"))
            {
                scopeForBrace = "namespace";
            }
            else if (currentScope == "global" || currentScope == "namespace")
            {
                found = MatchType(line, new List<string>(pendingAttributes), lineNumber);
                if (found != null) { scopeForBrace = "type"; classForBrace = found.Name; }
            }
            else if (currentScope == "type")
            {
                found = MatchMethod(line, new List<string>(pendingAttributes), lineNumber)
                     ?? MatchField(line, new List<string>(pendingAttributes), lineNumber);
                if (found != null)
                {
                    found = found with { Parent = classStack.Count > 0 ? classStack.Peek() : null };
                    if (found.Kind == "method" && found.Name == found.Parent)
                        found = null;
                    else if (found?.Kind == "method")
                        scopeForBrace = "method";
                }
            }
            else if (currentScope == "method" || currentScope == "block")
            {
                found = MatchVariable(line, lineNumber);
            }

            if (found != null) declarations.Add(found);
            pendingAttributes.Clear();

            for (int b = 0; b < line.Count(c => c == '{'); b++)
            {
                var scope = b == 0 && scopeForBrace != null ? scopeForBrace : "block";
                scopeStack.Push(scope);
                if (scope == "type" && classForBrace != null)
                {
                    classStack.Push(classForBrace);
                    classForBrace = null;
                }
                scopeForBrace = null;
            }

            for (int b = 0; b < line.Count(c => c == '}'); b++)
            {
                if (scopeStack.Count > 0)
                    if (scopeStack.Pop() == "type" && classStack.Count > 0)
                        classStack.Pop();
            }
        }

        return declarations;
    }
}
