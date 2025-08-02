using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;
using System.Text.RegularExpressions;

namespace Backend.Services
{
    public static class OllamaVisionService
    {
        public static async Task<string> AnalyzeImageAsync(string base64Image, string prompt, string model, int maxTokens = 5000, double temperature = 1.0)
        {
            // Usar un timeout más largo para peticiones de imagen
            using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            // LM Studio (OpenAI compatible) espera el mensaje con imagen así:
            // messages: [
            //   { "role": "user", "content": [
            //       { "type": "text", "text": "Describe la imagen" },
            //       { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
            //     ] }
            // ]
            var messageContent = new object[]
            {
                new { type = "text", text = prompt },
                new { type = "image_url", image_url = new { url = $"data:image/png;base64,{base64Image}" } }
            };

            var requestBody = new
            {
                model = model,
                messages = new[] {
                    new {
                        role = "user",
                        content = messageContent
                    }
                },
                max_tokens = maxTokens,
                temperature = temperature
            };

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            var response = await client.PostAsync("http://localhost:1234/v1/chat/completions", content);

            if (!response.IsSuccessStatusCode)
            {
                var errorString = await response.Content.ReadAsStringAsync();
                throw new Exception($"LM Studio error: {response.StatusCode}");
            }

            var responseString = await response.Content.ReadAsStringAsync();
            try
            {
                using var doc = JsonDocument.Parse(responseString);
                var choices = doc.RootElement.GetProperty("choices");
                if (choices.GetArrayLength() > 0)
                {
                    var message = choices[0].GetProperty("message");
                    if (message.TryGetProperty("content", out var contentElem))
                    {
                        var result = contentElem.GetString();
                        // Eliminar bloques <think>...</think> si existen
                        if (!string.IsNullOrEmpty(result))
                        {
                            var pattern = "<think>[\\s\\S]*?</think>";
                            result = Regex.Replace(result, pattern, string.Empty, RegexOptions.IgnoreCase);
                        }
                        return result?.Trim() ?? string.Empty;
                    }
                }
            }
            catch (JsonException)
            {
                // Error parsing response
            }
            return string.Empty;
        }
    }
}
