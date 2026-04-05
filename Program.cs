#nullable disable
string path = null;
bool verbose = false;
bool useLlm = true;

for (int i = 0; i < args.Length; i++)
{
    string arg = args[i];
    if (arg == "--verbose")
        verbose = true;
    else if (arg == "--no-llm")
        useLlm = false;
    else
        path = arg;
}

if (path == null)
{
    Console.WriteLine("Usage: CodeChecker <path> [--verbose] [--no-llm]");
    return 0;
}

string[] files;
if (File.Exists(path))
{
    files = new string[] { path };
}
else
{
    files = Directory.GetFiles(path, "*.cs", SearchOption.AllDirectories);
    Array.Sort(files);
}

if (files.Length == 0)
{
    Console.WriteLine("No .cs files found at: " + path);
    return 0;
}

int errorCount = 0;

foreach (string file in files)
{
    string source = File.ReadAllText(file);
    string clean = Parser.StripComments(source);
    string[] lines = clean.Split('\n');
    List<Declaration> declarations = Parser.Extract(lines);
    List<Violation> violations = Rules.Run(declarations, clean, useLlm);

    foreach (Violation violation in violations)
    {
        Reporter.Print(file, violation, verbose);
        if (violation.Severity == "error")
            errorCount++;
    }
}

return errorCount > 0 ? 1 : 0;
