#nullable disable
using System.Text.RegularExpressions;

public class Declaration
{
    public string Kind;
    public string Name;
    public List<string> Modifiers;
    public List<string> Attributes;
    public int Line;
    public string Parent;

    public Declaration(string kind, string name, List<string> modifiers, List<string> attributes, int line, string parent = null)
    {
        Kind = kind;
        Name = name;
        Modifiers = modifiers;
        Attributes = attributes;
        Line = line;
        Parent = parent;
    }
}

public static class Parser
{
    static readonly string[] ControlFlow = new string[]
    {
        "if", "else", "for", "foreach", "while", "do", "switch",
        "case", "return", "break", "continue", "try", "catch",
        "finally", "throw", "lock", "using", "yield", "await",
    };

    static readonly string[] ReservedWords = new string[]
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

    static bool Contains(string[] array, string value)
    {
        foreach (string item in array)
            if (item == value) return true;
        return false;
    }

    static int CountChar(string text, char ch)
    {
        int count = 0;
        for (int i = 0; i < text.Length; i++)
            if (text[i] == ch) count++;
        return count;
    }

    static string ReplaceComment(Match m)
    {
        if (m.Value.StartsWith("/"))
        {
            int newlineCount = CountChar(m.Value, '\n');
            return new string('\n', newlineCount);
        }
        return m.Value;
    }

    public static string StripComments(string source)
    {
        return CommentRe.Replace(source, ReplaceComment);
    }

    static string FirstWord(string line)
    {
        Match m = Regex.Match(line, @"\w+");
        if (m.Success) return m.Value;
        return "";
    }

    static List<string> SplitModifiers(string modifierString)
    {
        List<string> result = new List<string>();
        string[] parts = modifierString.Split(' ');
        foreach (string part in parts)
            if (part != "") result.Add(part);
        return result;
    }

    static Declaration MatchType(string line, List<string> attributes, int lineNumber)
    {
        Match m = TypeRe.Match(line);
        if (!m.Success) return null;
        return new Declaration(m.Groups[2].Value, m.Groups[3].Value,
            SplitModifiers(m.Groups[1].Value), attributes, lineNumber);
    }

    static Declaration MatchMethod(string line, List<string> attributes, int lineNumber)
    {
        if (Contains(ControlFlow, FirstWord(line))) return null;
        Match m = MethodRe.Match(line);
        if (!m.Success || Contains(ReservedWords, m.Groups[2].Value)) return null;
        return new Declaration("method", m.Groups[2].Value,
            SplitModifiers(m.Groups[1].Value), attributes, lineNumber);
    }

    static Declaration MatchField(string line, List<string> attributes, int lineNumber)
    {
        if (Contains(ControlFlow, FirstWord(line))) return null;
        Match m = FieldRe.Match(line);
        if (!m.Success || Contains(ReservedWords, m.Groups[2].Value)) return null;
        return new Declaration("field", m.Groups[2].Value,
            SplitModifiers(m.Groups[1].Value), attributes, lineNumber);
    }

    static Declaration MatchVariable(string line, int lineNumber)
    {
        if (Contains(ControlFlow, FirstWord(line))) return null;
        Match m = VarRe.Match(line);
        if (!m.Success || Contains(ReservedWords, m.Groups[1].Value)) return null;
        return new Declaration("variable", m.Groups[1].Value, new List<string>(), new List<string>(), lineNumber);
    }

    public static List<Declaration> Extract(string[] lines)
    {
        List<Declaration> declarations = new List<Declaration>();
        Stack<string> scopeStack = new Stack<string>();
        Stack<string> classStack = new Stack<string>();
        List<string> pendingAttributes = new List<string>();
        string scopeForBrace = null;
        string classForBrace = null;

        for (int i = 0; i < lines.Length; i++)
        {
            string line = lines[i].Trim();
            int lineNumber = i + 1;

            if (string.IsNullOrEmpty(line)) continue;

            if (line.StartsWith("["))
            {
                Match m = Regex.Match(line, @"\[(\w[\w.]*)");
                if (m.Success) pendingAttributes.Add(m.Groups[1].Value);
                continue;
            }

            string currentScope = scopeStack.Count > 0 ? scopeStack.Peek() : "global";
            Declaration found = null;

            if (Regex.IsMatch(line, @"^namespace\b"))
            {
                scopeForBrace = "namespace";
            }
            else if (currentScope == "global" || currentScope == "namespace")
            {
                found = MatchType(line, new List<string>(pendingAttributes), lineNumber);
                if (found != null)
                {
                    scopeForBrace = "type";
                    classForBrace = found.Name;
                }
            }
            else if (currentScope == "type")
            {
                found = MatchMethod(line, new List<string>(pendingAttributes), lineNumber);
                if (found == null)
                    found = MatchField(line, new List<string>(pendingAttributes), lineNumber);

                if (found != null)
                {
                    string parentClass = classStack.Count > 0 ? classStack.Peek() : null;
                    found = new Declaration(found.Kind, found.Name, found.Modifiers, found.Attributes, found.Line, parentClass);

                    if (found.Kind == "method" && found.Name == found.Parent)
                    {
                        found = null;
                    }
                    else if (found != null && found.Kind == "method")
                    {
                        scopeForBrace = "method";
                    }
                }
            }
            else if (currentScope == "method" || currentScope == "block")
            {
                found = MatchVariable(line, lineNumber);
            }

            if (found != null) declarations.Add(found);
            pendingAttributes.Clear();

            int openBraces = CountChar(line, '{');
            for (int b = 0; b < openBraces; b++)
            {
                string scope = (b == 0 && scopeForBrace != null) ? scopeForBrace : "block";
                scopeStack.Push(scope);
                if (scope == "type" && classForBrace != null)
                {
                    classStack.Push(classForBrace);
                    classForBrace = null;
                }
                scopeForBrace = null;
            }

            int closeBraces = CountChar(line, '}');
            for (int b = 0; b < closeBraces; b++)
            {
                if (scopeStack.Count > 0)
                {
                    string popped = scopeStack.Pop();
                    if (popped == "type" && classStack.Count > 0)
                        classStack.Pop();
                }
            }
        }

        return declarations;
    }
}
