using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;

namespace Backend.Services
{
    public class OpenRouterService
    {
        private readonly HttpClient _httpClient;

        public OpenRouterService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            _httpClient.Timeout = TimeSpan.FromSeconds(30); 
        }

        public async Task<string> GetCompletionAsync(string prompt, string apiKey, string model = "google/gemma-3n-e4b-it:free", int maxTokens = 300, double temperature = 1.0)
        {
            // Instrucciones para el modelo
            string instrucciones = "Responde usando un tono natural, amigable y con acento colombiano (preferiblemente neutro). No uses emoticones, emojis ni los describas, ni uses palabras como 'cara guiño', 'cara feliz', 'emoji', ni ninguna referencia a gestos o símbolos gráficos. Responde solo con texto natural, usando signos de puntuación y gramática correctos para que la respuesta sea fácil de escuchar por voz. Si puedes, haz que la respuesta suene natural para un colombiano.";
            string promptModificado = instrucciones + "\n" + prompt;

            _httpClient.DefaultRequestHeaders.Accept.Clear();
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var requestBody = new
            {
                model = model,
                messages = new[] {
                    new { role = "user", content = promptModificado }
                },
                max_tokens = maxTokens,
                temperature = temperature
            };
            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            
            try
            {
                var response = await _httpClient.PostAsync("https://openrouter.ai/api/v1/chat/completions", content);
                response.EnsureSuccessStatusCode();
                var responseString = await response.Content.ReadAsStringAsync();

                try
                {
                    using var doc = JsonDocument.Parse(responseString);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("choices", out var choicesElem) &&
                        choicesElem.ValueKind == JsonValueKind.Array &&
                        choicesElem.GetArrayLength() > 0)
                    {
                        var firstChoice = choicesElem[0];
                        if (firstChoice.TryGetProperty("message", out var messageElem) &&
                            messageElem.TryGetProperty("content", out var contentElem))
                        {
                            return contentElem.GetString() ?? string.Empty;
                        }
                    }
                    // Si no se encuentra el contenido esperado, mostrar la respuesta completa para depuración
                    return $"[ERROR] Formato inesperado en respuesta OpenRouter:\n{responseString}";
                }
                catch (Exception ex)
                {
                    // Log detallado del error y la respuesta
                    return $"[ERROR] Excepción al procesar respuesta OpenRouter: {ex.Message}\nRespuesta completa:\n{responseString}";
                }
            }
            catch (TaskCanceledException)
            {
                return "[Error: Timeout al procesar con OpenRouter]";
            }
            catch (HttpRequestException)
            {
                return "[Error HTTP al procesar con OpenRouter]";
            }
        }
    }
}
