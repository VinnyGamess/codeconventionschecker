#nullable disable
using System.Text;
using System.Text.Json;

public class NameKind
{
    public string Name;
    public string Kind;

    public NameKind(string name, string kind)
    {
        Name = name;
        Kind = kind;
    }
}

public class NameResult
{
    public string Name;
    public string Reason;

    public NameResult(string name, string reason)
    {
        Name = name;
        Reason = reason;
    }
}

public static class Llm
{
    const string CacheFile = ".llm_cache.json";
    static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };

    static Dictionary<string, string> LoadCache()
    {
        if (!File.Exists(CacheFile)) return new Dictionary<string, string>();
        try
        {
            string json = File.ReadAllText(CacheFile);
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>();
        }
        catch
        {
            return new Dictionary<string, string>();
        }
    }

    static void SaveCache(Dictionary<string, string> cache)
    {
        JsonSerializerOptions options = new JsonSerializerOptions();
        options.WriteIndented = true;
        File.WriteAllText(CacheFile, JsonSerializer.Serialize(cache, options));
    }

    public static List<NameResult> FindBadNames(List<NameKind> names)
    {
        string modelName = Environment.GetEnvironmentVariable("OLLAMA_MODEL");
        if (string.IsNullOrEmpty(modelName)) return new List<NameResult>();

        Dictionary<string, string> cache = LoadCache();

        List<NameKind> notInCache = new List<NameKind>();
        foreach (NameKind n in names)
        {
            if (!cache.ContainsKey(n.Name + ":" + n.Kind))
                notInCache.Add(n);
        }

        if (notInCache.Count > 0)
        {
            List<string[]> nameList = new List<string[]>();
            foreach (NameKind n in notInCache)
                nameList.Add(new string[] { n.Name, n.Kind });
            string namesJson = JsonSerializer.Serialize(nameList);

            string prompt =
                "You review C# identifier names for code quality.\n" +
                "Flag names that are: meaningless (e.g. 'foo', 'test', 'data1'),\n" +
                "too short without context (e.g. 'a', 'x2'), non-English (e.g. Dutch\n" +
                "or German words), or placeholder-like.\n\n" +
                "Names to check: " + namesJson + "\n\n" +
                "Respond with JSON: {\"bad_names\": [{\"name\": \"...\", \"reason\": \"...\"}]}\n" +
                "Only flag genuinely bad names. An empty array is fine.";

            string body = JsonSerializer.Serialize(new { model = modelName, prompt = prompt, stream = false, format = "json" });

            Dictionary<string, string> flagged = new Dictionary<string, string>();
            try
            {
                HttpResponseMessage response = Http.PostAsync("http://localhost:11434/api/generate",
                    new StringContent(body, Encoding.UTF8, "application/json")).Result;
                string responseText = response.Content.ReadAsStringAsync().Result;
                JsonElement outer = JsonDocument.Parse(responseText).RootElement;
                JsonElement inner = JsonDocument.Parse(outer.GetProperty("response").GetString()).RootElement;
                foreach (JsonElement item in inner.GetProperty("bad_names").EnumerateArray())
                    flagged[item.GetProperty("name").GetString()] = item.GetProperty("reason").GetString();
            }
            catch { }

            foreach (NameKind n in notInCache)
            {
                string cacheKey = n.Name + ":" + n.Kind;
                if (flagged.ContainsKey(n.Name))
                    cache[cacheKey] = flagged[n.Name];
                else
                    cache[cacheKey] = "";
            }
            SaveCache(cache);
        }

        List<NameResult> result = new List<NameResult>();
        foreach (NameKind n in names)
        {
            string key = n.Name + ":" + n.Kind;
            if (cache.ContainsKey(key) && !string.IsNullOrEmpty(cache[key]))
                result.Add(new NameResult(n.Name, cache[key]));
        }
        return result;
    }
}
