using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;

namespace Backend.Services
{
	public class OllamaAskClient
	{
		private readonly HttpClient _httpClient;
		private readonly string _apiUrl;
		private readonly string _model;

		public OllamaAskClient(HttpClient httpClient, IConfiguration? configuration = null)
		{
			_httpClient = httpClient;
			_httpClient.Timeout = TimeSpan.FromSeconds(30); // Timeout más agresivo
			_apiUrl = Environment.GetEnvironmentVariable("OLLAMA_URL") ?? "http://ollama-server:11434/api/generate";
			_model = Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? "gemma3n:e4b";
		}

		/// <summary>
		/// Método compatible con OpenRouterService.GetCompletionAsync
		/// </summary>
		public async Task<string> GetCompletionAsync(string prompt, string apiKey = "", string model = "", int maxTokens = 300, double temperature = 0.7)
		{
			// Para Ollama local, no necesitamos apiKey, pero mantenemos la firma compatible
			var modelToUse = string.IsNullOrEmpty(model) ? _model : model;
			
			// Agregar instrucciones similares a OpenRouterService
			string instrucciones = "Responde usando un tono natural, amigable y con acento colombiano (preferiblemente neutro). No uses emoticones, emojis ni los describas, ni uses palabras como 'cara guiño', 'cara feliz', 'emoji', ni ninguna referencia a gestos o símbolos gráficos. Responde solo con texto natural, usando signos de puntuación y gramática correctos para que la respuesta sea fácil de escuchar por voz. Si puedes, haz que la respuesta suene natural para un colombiano.";
			string promptModificado = instrucciones + "\n" + prompt;

			_httpClient.DefaultRequestHeaders.Accept.Clear();
			_httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

			var requestBody = new
			{
				model = modelToUse,
				prompt = promptModificado,
				stream = false,
				options = new
				{
					temperature = temperature,
					num_predict = maxTokens
				}
			};

			var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
			
			try
			{
				var response = await _httpClient.PostAsync(_apiUrl, content);

				if (!response.IsSuccessStatusCode)
				{
					var errorString = await response.Content.ReadAsStringAsync();
					return $"[Error al procesar con Ollama: {response.StatusCode}]";
				}

				var responseString = await response.Content.ReadAsStringAsync();
				
				try
				{
					using var doc = JsonDocument.Parse(responseString);
					var root = doc.RootElement;
					if (root.TryGetProperty("response", out var responseElem))
					{
						var result = responseElem.GetString();
						
						// Eliminar bloques <think>...</think> si existen
						if (!string.IsNullOrEmpty(result))
						{
							var pattern = "<think>[\\s\\S]*?</think>";
							result = Regex.Replace(result, pattern, string.Empty, RegexOptions.IgnoreCase);
						}
						return result?.Trim() ?? string.Empty;
					}
					
					return $"[ERROR] Formato inesperado en respuesta Ollama:\n{responseString}";
				}
				catch (Exception ex)
				{
					return $"[ERROR] Excepción al procesar respuesta Ollama: {ex.Message}\nRespuesta:\n{responseString}";
				}
			}
			catch (TaskCanceledException)
			{
				return "[Error: Timeout al procesar con Ollama]";
			}
			catch (HttpRequestException)
			{
				return "[Error HTTP al procesar con Ollama]";
			}
		}

		public async Task<string> PreguntarConAnalisis(string userText, string imageAnalysis)
		{
			// Combinar las dos preguntas en el prompt
			var combinedPrompt = $"Pregunta del usuario: {userText}\n\nAnálisis previo de imagen: {imageAnalysis}\n\nBasándote en esta información, responde a la pregunta del usuario,. en español unicamente:";

			using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
			client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

			// Formato específico para Ollama API (sin imágenes, solo texto)
			var requestBody = new
			{
				model = _model,
				prompt = combinedPrompt,
				stream = false,
				options = new
				{
					temperature = 0.7,
					num_predict = 3000
				}
			};

			var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
			var response = await client.PostAsync(_apiUrl, content);

			if (!response.IsSuccessStatusCode)
			{
				var errorString = await response.Content.ReadAsStringAsync();
				return $"[Error al procesar pregunta: {response.StatusCode}]";
			}

			var responseString = await response.Content.ReadAsStringAsync();
			try
			{
				using var doc = JsonDocument.Parse(responseString);
				
				// Ollama API devuelve la respuesta en el campo "response"
				if (doc.RootElement.TryGetProperty("response", out var responseElem))
				{
					var result = responseElem.GetString();
					
					// Eliminar bloques <think>...</think> si existen
					if (!string.IsNullOrEmpty(result))
					{
						var pattern = "<think>[\\s\\S]*?</think>";
						result = Regex.Replace(result, pattern, string.Empty, RegexOptions.IgnoreCase);
					}
					return result?.Trim() ?? string.Empty;
				}
				
				// Si no hay campo "response", intentar con "content" como fallback
				if (doc.RootElement.TryGetProperty("content", out var contentElem))
				{
					var result = contentElem.GetString();
					if (!string.IsNullOrEmpty(result))
					{
						var pattern = "<think>[\\s\\S]*?</think>";
						result = Regex.Replace(result, pattern, string.Empty, RegexOptions.IgnoreCase);
					}
					return result?.Trim() ?? string.Empty;
				}
			}
			catch (JsonException)
			{
				// Error parsing response
			}
			return string.Empty;
		}

		/// <summary>
		/// Método sobrecargado que permite personalizar el prompt de combinación
		/// </summary>
		public async Task<string> PreguntarConAnalisis(string userText, string imageAnalysis, string customPromptTemplate)
		{
			// Usar template personalizado para combinar las preguntas
			var combinedPrompt = customPromptTemplate
				.Replace("{userText}", userText)
				.Replace("{imageAnalysis}", imageAnalysis);

			using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
			client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

			var requestBody = new
			{
				model = _model,
				prompt = combinedPrompt,
				stream = false,
				options = new
				{
					temperature = 0.7,
					num_predict = 3000
				}
			};

			var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
			var response = await client.PostAsync(_apiUrl, content);

			if (!response.IsSuccessStatusCode)
			{
				var errorString = await response.Content.ReadAsStringAsync();
				return $"[Error al procesar pregunta: {response.StatusCode}]";
			}

			var responseString = await response.Content.ReadAsStringAsync();
			try
			{
				using var doc = JsonDocument.Parse(responseString);
				
				if (doc.RootElement.TryGetProperty("response", out var responseElem))
				{
					var result = responseElem.GetString();
					
					if (!string.IsNullOrEmpty(result))
					{
						var pattern = "<think>[\\s\\S]*?</think>";
						result = Regex.Replace(result, pattern, string.Empty, RegexOptions.IgnoreCase);
					}
					return result?.Trim() ?? string.Empty;
				}
				
				if (doc.RootElement.TryGetProperty("content", out var contentElem))
				{
					var result = contentElem.GetString();
					if (!string.IsNullOrEmpty(result))
					{
						var pattern = "<think>[\\s\\S]*?</think>";
						result = Regex.Replace(result, pattern, string.Empty, RegexOptions.IgnoreCase);
					}
					return result?.Trim() ?? string.Empty;
				}
			}
			catch (JsonException)
			{
				// Error parsing response
			}
			return string.Empty;
		}

		/// <summary>
		/// Método adicional para verificar si el modelo está disponible en Ollama
		/// </summary>
		public async Task<bool> IsModelAvailable()
		{
			try
			{
				using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
				var listModelsUrl = _apiUrl.Replace("/api/generate", "/api/tags");
				var response = await client.GetAsync(listModelsUrl);
				
				if (response.IsSuccessStatusCode)
				{
					var responseString = await response.Content.ReadAsStringAsync();
					using var doc = JsonDocument.Parse(responseString);
					
					if (doc.RootElement.TryGetProperty("models", out var modelsArray))
					{
						foreach (var model in modelsArray.EnumerateArray())
						{
							if (model.TryGetProperty("name", out var nameElem))
							{
								var modelName = nameElem.GetString();
								if (modelName != null && modelName.Contains(_model.Split(':')[0]))
								{
									return true;
								}
							}
						}
					}
				}
			}
			catch (Exception)
			{
				// Error checking model availability
			}
			return false;
		}

		/// <summary>
		/// Método simple para hacer preguntas sin análisis de imagen previo
		/// </summary>
		public async Task<string> Preguntar(string userText)
		{
			return await PreguntarConAnalisis(userText, "", "Pregunta: {userText}");
		}
	}
}