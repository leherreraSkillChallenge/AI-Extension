using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;
using System.Text.RegularExpressions;

public class QwenVisionClient
{
    private readonly string _apiUrl;
    private readonly string _model;
    private readonly string _prompt;
    public QwenVisionClient(string apiUrl, string model = "qwen/qwen2.5-vl-7b", string prompt = "Describe la imagen")
    {
        _apiUrl = apiUrl;
        _model = model;
        _prompt = prompt;
    }

    public async Task<string> AnalizarImagen(string imagePath)
    {
        try
        {
            // Verificar que el archivo existe
            if (!File.Exists(imagePath))
            {
                Console.WriteLine($"Archivo de imagen no encontrado: {imagePath}");
                return "[Error: Archivo de imagen no encontrado]";
            }

            // Convertir imagen a base64
            string base64Image = Convert.ToBase64String(await File.ReadAllBytesAsync(imagePath));
            Console.WriteLine($"Analizando imagen: {Path.GetFileName(imagePath)} ({base64Image.Length} bytes en base64)");

            using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
            client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            var messageContent = new object[]
            {
                new { type = "text", text = _prompt },
                new { type = "image_url", image_url = new { url = $"data:image/png;base64,{base64Image}" } }
            };

            var requestBody = new
            {
                model = _model,
                messages = new[] {
                    new {
                        role = "user",
                        content = messageContent
                    }
                },
                max_tokens = 5000,
                temperature = 1.0
            };

            var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
            
            Console.WriteLine("Enviando solicitud a LM Studio...");
            var response = await client.PostAsync(_apiUrl, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorString = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"LM Studio error: {response.StatusCode}");
                Console.WriteLine($"Error detallado: {errorString}");
                return $"[Error al analizar imagen: {response.StatusCode}]";
            }

            var responseString = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Respuesta recibida de LM Studio");
            
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
                        
                        var finalResult = result?.Trim() ?? string.Empty;
                        Console.WriteLine($"Análisis completado ({finalResult.Length} caracteres)");
                        return finalResult;
                    }
                }
            }
            catch (JsonException ex)
            {
                Console.WriteLine($"Error parsing LM Studio response: {ex.Message}");
                Console.WriteLine($"Response: {responseString}");
            }
            return string.Empty;
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"Error de red con LM Studio: {ex.Message}");
            return "[Error de conexión con LM Studio]";
        }
        catch (TaskCanceledException ex)
        {
            Console.WriteLine($"Timeout con LM Studio: {ex.Message}");
            return "[Timeout al analizar imagen]";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error inesperado al analizar imagen: {ex.Message}");
            return $"[Error inesperado: {ex.Message}]";
        }
    }
}
