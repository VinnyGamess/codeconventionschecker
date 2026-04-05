public static class Reporter
{
    const string Cyan    = "\x1b[36m";
    const string Yellow  = "\x1b[33m";
    const string Red     = "\x1b[31m";
    const string Green   = "\x1b[32m";
    const string Magenta = "\x1b[35m";
    const string Bold    = "\x1b[1m";
    const string Reset   = "\x1b[0m";

    public static void Print(string filepath, Violation violation, bool verbose)
    {
        var color = violation.Severity == "error" ? Red : Yellow;
        Console.WriteLine(
            $"{Cyan}{filepath}:{violation.Line}{Reset}  " +
            $"{color}{Bold}{violation.Severity}{Reset}  " +
            $"{Magenta}[{violation.Rule}]{Reset}  " +
            $"{violation.Message}"
        );

        if (verbose && !string.IsNullOrEmpty(violation.Suggestion))
            Console.WriteLine($"  {Green}-> {violation.Suggestion}{Reset}");
    }
}
