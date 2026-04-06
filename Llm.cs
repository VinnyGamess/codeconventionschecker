#nullable disable
using System.Text;
using System.Text.Json;

public class NameKind
{
    public string Name, Kind;
    public NameKind(string name, string kind) { Name = name; Kind = kind; }
}

public class NameResult
{
    public string Name, Reason;
    public NameResult(string name, string reason) { Name = name; Reason = reason; }
}

public static class Llm
{
    const string CacheFile = ".llm_cache.json";
    static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };

    static Dictionary<string, string> LoadCache()
    {
        if (!File.Exists(CacheFile)) return new Dictionary<string, string>();
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(CacheFile)) ?? new Dictionary<string, string>(); }
        catch { return new Dictionary<string, string>(); }
    }

    static void SaveCache(Dictionary<string, string> cache)
    {
        File.WriteAllText(CacheFile, JsonSerializer.Serialize(cache, new JsonSerializerOptions { WriteIndented = true }));
    }

    public static List<NameResult> FindBadNames(List<NameKind> names)
    {
        var model = Environment.GetEnvironmentVariable("OLLAMA_MODEL");
        if (string.IsNullOrEmpty(model)) return new List<NameResult>();

        var cache = LoadCache();
        var uncached = names.Where(n => !cache.ContainsKey($"{n.Name}:{n.Kind}")).ToList();

        if (uncached.Count > 0)
        {
            var nameList = uncached.Select(n => new[] { n.Name, n.Kind });
            var prompt =
                "You review C# identifier names for code quality.\n" +
                "Flag names that are: meaningless (e.g. 'foo', 'test', 'data1'),\n" +
                "too short without context (e.g. 'a', 'x2'), non-English (e.g. Dutch\n" +
                "or German words), or placeholder-like.\n\n" +
                $"Names to check: {JsonSerializer.Serialize(nameList)}\n\n" +
                "Respond with JSON: {\"bad_names\": [{\"name\": \"...\", \"reason\": \"...\"}]}\n" +
                "Only flag genuinely bad names. An empty array is fine.";

            var body = JsonSerializer.Serialize(new { model, prompt, stream = false, format = "json" });
            var flagged = new Dictionary<string, string>();
            try
            {
                var resp = Http.PostAsync("http://localhost:11434/api/generate",
                    new StringContent(body, Encoding.UTF8, "application/json")).Result;
                var outer = JsonDocument.Parse(resp.Content.ReadAsStringAsync().Result).RootElement;
                var inner = JsonDocument.Parse(outer.GetProperty("response").GetString()).RootElement;
                foreach (var item in inner.GetProperty("bad_names").EnumerateArray())
                    flagged[item.GetProperty("name").GetString()] = item.GetProperty("reason").GetString();
            }
            catch { }

            foreach (var n in uncached)
            {
                var key = $"{n.Name}:{n.Kind}";
                cache[key] = flagged.ContainsKey(n.Name) ? flagged[n.Name] : "";
            }
            SaveCache(cache);
        }

        var result = new List<NameResult>();
        foreach (var n in names)
        {
            var key = $"{n.Name}:{n.Kind}";
            if (cache.ContainsKey(key) && !string.IsNullOrEmpty(cache[key]))
                result.Add(new NameResult(n.Name, cache[key]));
        }
        return result;
    }
}
