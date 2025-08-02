using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace Backend.Services
{
    public class GemmaVisionServices
    {
        private readonly HttpClient _httpClient;

        public GemmaVisionServices(HttpClient httpClient)
        {
            _httpClient = httpClient;
            _httpClient.Timeout = TimeSpan.FromSeconds(30); // Timeout configurado
        }

        public async Task<string> AnalyzeImageAsync(string base64Image, string apiKey)
        {
            var url = $"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={apiKey}";
            var payload = new
            {
                contents = new[] {
                    new {
                        role = "user",
                        parts = new object[] {
                            new { text = "Describe detalladamente el contenido de la imagen. Responde en español, de forma casual y amistosa, como si fueras un amigo. Evita sonar robótico y utiliza expresiones naturales." },
                            new { inline_data = new { mime_type = "image/png", data = base64Image } }
                        }
                    }
                }
            };
            
            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            
            try
            {
                var response = await _httpClient.PostAsync(url, content);
                if (!response.IsSuccessStatusCode)
                {
                    var errorString = await response.Content.ReadAsStringAsync();
                    throw new HttpRequestException($"Gemini Vision error: {errorString}");
                }
                var responseJson = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(responseJson);
                return doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? string.Empty;
            }
            catch (TaskCanceledException)
            {
                return "[Error: Timeout al procesar imagen con Gemini Vision]";
            }
            catch (HttpRequestException)
            {
                return "[Error al procesar imagen con Gemini Vision]";
            }
        }
    }
}
