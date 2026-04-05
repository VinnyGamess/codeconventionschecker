using System.Text;
using System.Text.Json;

public static class Llm
{
    const string CacheFile = ".llm_cache.json";
    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };

    static Dictionary<string, string> LoadCache()
    {
        if (!File.Exists(CacheFile)) return new();
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(CacheFile)) ?? new(); }
        catch { return new(); }
    }

    static void SaveCache(Dictionary<string, string> cache) =>
        File.WriteAllText(CacheFile, JsonSerializer.Serialize(cache, new JsonSerializerOptions { WriteIndented = true }));

    public static List<(string Name, string Reason)> FindBadNames(List<(string Name, string Kind)> names)
    {
        var modelName = Environment.GetEnvironmentVariable("OLLAMA_MODEL");
        if (string.IsNullOrEmpty(modelName)) return new();

        var cache      = LoadCache();
        var notInCache = names.Where(n => !cache.ContainsKey($"{n.Name}:{n.Kind}")).ToList();

        if (notInCache.Count > 0)
        {
            var namesJson = JsonSerializer.Serialize(notInCache.Select(n => new[] { n.Name, n.Kind }));
            var prompt    = $$"""
                You review C# identifier names for code quality.
                Flag names that are: meaningless (e.g. 'foo', 'test', 'data1'),
                too short without context (e.g. 'a', 'x2'), non-English (e.g. Dutch
                or German words), or placeholder-like.

                Names to check: {{namesJson}}

                Respond with JSON: {"bad_names": [{"name": "...", "reason": "..."}]}
                Only flag genuinely bad names. An empty array is fine.
                """;

            var body    = JsonSerializer.Serialize(new { model = modelName, prompt, stream = false, format = "json" });
            var flagged = new Dictionary<string, string>();

            try
            {
                var response     = Http.PostAsync("http://localhost:11434/api/generate",
                                       new StringContent(body, Encoding.UTF8, "application/json")).Result;
                var responseText = response.Content.ReadAsStringAsync().Result;
                var outer        = JsonDocument.Parse(responseText).RootElement;
                var inner        = JsonDocument.Parse(outer.GetProperty("response").GetString()!).RootElement;
                foreach (var item in inner.GetProperty("bad_names").EnumerateArray())
                    flagged[item.GetProperty("name").GetString()!] = item.GetProperty("reason").GetString()!;
            }
            catch { }

            foreach (var (name, kind) in notInCache)
                cache[$"{name}:{kind}"] = flagged.GetValueOrDefault(name, "");

            SaveCache(cache);
        }

        return names
            .Where(n => !string.IsNullOrEmpty(cache.GetValueOrDefault($"{n.Name}:{n.Kind}")))
            .Select(n => (n.Name, cache[$"{n.Name}:{n.Kind}"]))
            .ToList();
    }
}
