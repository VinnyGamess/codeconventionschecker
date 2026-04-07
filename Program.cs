#nullable disable
string path = null;
bool verbose = false, useLlm = true;

for (int i = 0; i < args.Length; i++)
{
    if (args[i] == "--verbose") verbose = true;
    else if (args[i] == "--no-llm") useLlm = false;
    else path = args[i];
}

if (path == null)
{
    Console.WriteLine("Usage: CodeChecker <path> [--verbose] [--no-llm]");
    return 0;
}

var files = File.Exists(path)
    ? new[] { path }
    : Directory.GetFiles(path, "*.cs", SearchOption.AllDirectories).OrderBy(f => f).ToArray();

if (files.Length == 0)
{
    Console.WriteLine($"No .cs files found at: {path}");
    return 0;
}

int errorCount = 0;
foreach (var file in files)
{
    var source = File.ReadAllText(file);
    var clean = Parser.StripComments(source);
    var declarations = Parser.Extract(clean.Split('\n'));
    var violations = Rules.Run(declarations, clean, useLlm);

    foreach (var violation in violations)
    {
        Reporter.Print(file, violation, verbose);
        if (violation.Severity == "error") errorCount++;
    }
}

return errorCount > 0 ? 1 : 0;
