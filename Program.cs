var path    = args.Length > 0 ? args[0] : null;
var verbose = args.Contains("--verbose");
var useLlm  = !args.Contains("--no-llm");

if (path == null)
{
    Console.WriteLine("Usage: CodeChecker <path> [--verbose] [--no-llm]");
    return 0;
}

var files = File.Exists(path)
    ? new[] { path }
    : Directory.GetFiles(path, "*.cs", SearchOption.AllDirectories);

if (files.Length == 0)
{
    Console.WriteLine($"No .cs files found at: {path}");
    return 0;
}

int errorCount = 0;

foreach (var file in files.OrderBy(f => f))
{
    var source       = File.ReadAllText(file);
    var clean        = Parser.StripComments(source);
    var declarations = Parser.Extract(clean.Split('\n'));
    var violations   = Rules.Run(declarations, clean, useLlm);

    foreach (var violation in violations)
    {
        Reporter.Print(file, violation, verbose);
        if (violation.Severity == "error") errorCount++;
    }
}

return errorCount > 0 ? 1 : 0;
