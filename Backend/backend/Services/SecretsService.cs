using System.Text.Json;

namespace Backend.Services
{
    public static class SecretsService
    {
        private static readonly string secretsPath = Path.Combine(AppContext.BaseDirectory, "appsettings.secrets.json");
        public static string GetOpenRouterApiKey()
        {
            if (!File.Exists(secretsPath)) return string.Empty;
            var json = File.ReadAllText(secretsPath);
            var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("OpenRouterApiKey", out var keyElem))
                return keyElem.GetString() ?? string.Empty;
            return string.Empty;
        }

        public static string GetOpenRouterVisionApiKey()
        {
            if (!File.Exists(secretsPath)) return string.Empty;
            var json = File.ReadAllText(secretsPath);
            var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("OpenRouterVisionApiKey", out var keyElem))
                return keyElem.GetString() ?? string.Empty;
            return string.Empty;
        }

        public static string GetGeminiApiKey()
        {
            if (!File.Exists(secretsPath)) return string.Empty;
            var json = File.ReadAllText(secretsPath);
            var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("GeminiApiKey", out var keyElem))
                return keyElem.GetString() ?? string.Empty;
            return string.Empty;
        }
    }
}
