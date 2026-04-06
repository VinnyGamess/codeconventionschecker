public static class Reporter
{
    const string Cyan = "\x1b[36m", Yellow = "\x1b[33m", Red = "\x1b[31m";
    const string Green = "\x1b[32m", Magenta = "\x1b[35m", Bold = "\x1b[1m", Reset = "\x1b[0m";

    public static void Print(string filepath, Violation v, bool verbose)
    {
        var color = v.Severity == "error" ? Red : Yellow;
        Console.WriteLine($"{Cyan}{filepath}:{v.Line}{Reset}  {color}{Bold}{v.Severity}{Reset}  {Magenta}[{v.Rule}]{Reset}  {v.Message}");
        if (verbose && !string.IsNullOrEmpty(v.Suggestion))
            Console.WriteLine($"  {Green}-> {v.Suggestion}{Reset}");
    }
}
