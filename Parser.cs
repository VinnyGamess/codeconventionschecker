#nullable disable
using System.Text.RegularExpressions;

public class Declaration
{
    public string Kind, Name, Parent;
    public List<string> Modifiers, Attributes;
    public int Line;

    public Declaration(string kind, string name, List<string> modifiers, List<string> attributes, int line, string parent = null)
    {
        Kind = kind; Name = name; Modifiers = modifiers; Attributes = attributes; Line = line; Parent = parent;
    }
}

public static class Parser
{
    static readonly string[] ControlFlow =
    {
        "if", "else", "for", "foreach", "while", "do", "switch",
        "case", "return", "break", "continue", "try", "catch",
        "finally", "throw", "lock", "using", "yield", "await"
    };

    static readonly string[] ReservedWords =
    {
        "if", "else", "for", "foreach", "while", "do", "switch",
        "case", "return", "break", "continue", "try", "catch",
        "finally", "throw", "lock", "using", "yield", "await",
        "public", "private", "protected", "internal", "static", "readonly",
        "abstract", "virtual", "override", "sealed", "partial", "async",
        "const", "extern", "new",
        "class", "struct", "interface", "enum", "record"
    };

    static readonly Regex CommentRe = new Regex(
        @"@""[^""]*(?:""""[^""]*)*""|""(?:[^""\\]|\\.)*""|'(?:[^'\\]|\\.)*'|//[^\n]*|/\*.*?\*/",
        RegexOptions.Singleline
    );

    static readonly Regex TypeRe = new Regex(
        @"^((?:(?:public|private|protected|internal|static|abstract|sealed|partial)\s+)*)(class|struct|interface|enum|record)\s+(\w+)"
    );

    static readonly Regex MethodRe = new Regex(
        @"^((?:(?:public|private|protected|internal|static|abstract|virtual|override|async|sealed|partial|extern|new)\s+)*)[\w<>\[\],?\s]+?\s+(\w+)\s*\("
    );

    static readonly Regex FieldRe = new Regex(
        @"^((?:(?:public|private|protected|internal|static|readonly|const|abstract|virtual|override|extern|new)\s+)*)(?:[\w<>\[\],?]+\s+)+(\w+)\s*[;=]"
    );

    static readonly Regex VarRe = new Regex(@"^(?:var|[\w<>\[\],?]+)\s+(\w+)\s*[;=]");

    static bool Contains(string[] arr, string val) { foreach (var s in arr) if (s == val) return true; return false; }

    static int CountChar(string text, char ch)
    {
        int count = 0;
        foreach (char c in text) if (c == ch) count++;
        return count;
    }

    static string ReplaceComment(Match m)
    {
        if (!m.Value.StartsWith("/")) return m.Value;
        return new string('\n', CountChar(m.Value, '\n'));
    }

    public static string StripComments(string source) => CommentRe.Replace(source, ReplaceComment);

    static string FirstWord(string line)
    {
        var m = Regex.Match(line, @"\w+");
        return m.Success ? m.Value : "";
    }

    static List<string> SplitMods(string s)
    {
        var result = new List<string>();
        foreach (var p in s.Split(' ')) if (p != "") result.Add(p);
        return result;
    }

    static Declaration MatchType(string line, List<string> attrs, int ln)
    {
        var m = TypeRe.Match(line);
        if (!m.Success) return null;
        return new Declaration(m.Groups[2].Value, m.Groups[3].Value, SplitMods(m.Groups[1].Value), attrs, ln);
    }

    static Declaration MatchMethod(string line, List<string> attrs, int ln)
    {
        if (Contains(ControlFlow, FirstWord(line))) return null;
        var m = MethodRe.Match(line);
        if (!m.Success || Contains(ReservedWords, m.Groups[2].Value)) return null;
        return new Declaration("method", m.Groups[2].Value, SplitMods(m.Groups[1].Value), attrs, ln);
    }

    static Declaration MatchField(string line, List<string> attrs, int ln)
    {
        if (Contains(ControlFlow, FirstWord(line))) return null;
        var m = FieldRe.Match(line);
        if (!m.Success || Contains(ReservedWords, m.Groups[2].Value)) return null;
        return new Declaration("field", m.Groups[2].Value, SplitMods(m.Groups[1].Value), attrs, ln);
    }

    static Declaration MatchVariable(string line, int ln)
    {
        if (Contains(ControlFlow, FirstWord(line))) return null;
        var m = VarRe.Match(line);
        if (!m.Success || Contains(ReservedWords, m.Groups[1].Value)) return null;
        return new Declaration("variable", m.Groups[1].Value, new List<string>(), new List<string>(), ln);
    }

    public static List<Declaration> Extract(string[] lines)
    {
        var decls = new List<Declaration>();
        var scopeStack = new Stack<string>();
        var classStack = new Stack<string>();
        var pendingAttrs = new List<string>();
        string scopeForBrace = null;
        string classForBrace = null;

        for (int i = 0; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            int ln = i + 1;

            if (string.IsNullOrEmpty(line)) continue;

            if (line.StartsWith("["))
            {
                var am = Regex.Match(line, @"\[(\w[\w.]*)");
                if (am.Success) pendingAttrs.Add(am.Groups[1].Value);
                continue;
            }

            var scope = scopeStack.Count > 0 ? scopeStack.Peek() : "global";
            Declaration found = null;

            if (Regex.IsMatch(line, @"^namespace\b"))
                scopeForBrace = "namespace";
            else switch (scope)
            {
                case "global": case "namespace":
                    found = MatchType(line, new List<string>(pendingAttrs), ln);
                    if (found != null) { scopeForBrace = "type"; classForBrace = found.Name; }
                    break;
                case "type":
                    found = MatchMethod(line, new List<string>(pendingAttrs), ln)
                         ?? MatchField(line, new List<string>(pendingAttrs), ln);
                    if (found != null)
                    {
                        var parent = classStack.Count > 0 ? classStack.Peek() : null;
                        found = new Declaration(found.Kind, found.Name, found.Modifiers, found.Attributes, found.Line, parent);
                        if (found.Kind == "method" && found.Name == found.Parent) found = null;
                        else if (found?.Kind == "method") scopeForBrace = "method";
                    }
                    break;
                case "method": case "block":
                    found = MatchVariable(line, ln);
                    break;
            }

            if (found != null) decls.Add(found);
            pendingAttrs.Clear();

            int opens = CountChar(line, '{');
            for (int b = 0; b < opens; b++)
            {
                var s = (b == 0 && scopeForBrace != null) ? scopeForBrace : "block";
                scopeStack.Push(s);
                if (s == "type" && classForBrace != null)
                {
                    classStack.Push(classForBrace);
                    classForBrace = null;
                }
                scopeForBrace = null;
            }

            int closes = CountChar(line, '}');
            for (int b = 0; b < closes; b++)
            {
                if (scopeStack.Count > 0)
                {
                    var popped = scopeStack.Pop();
                    if (popped == "type" && classStack.Count > 0) classStack.Pop();
                }
            }
        }

        return decls;
    }
}
