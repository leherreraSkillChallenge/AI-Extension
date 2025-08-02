using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;
using System.Text.RegularExpressions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace Backend.Services
{
	public class OllamaVisionClient
	{
		private readonly string _apiUrl;
		private readonly string _model;
		private readonly string _prompt;

		public OllamaVisionClient(string apiUrl = "http://ollama-server:11434/api/generate", string model = "qwen2.5vl:7b", string prompt = "Describe la imagen lo más detallado posible, utiliza columnas si la información persivida lo requiere")
		{
			_apiUrl = apiUrl;
			_model = model;
			_prompt = prompt;
		}

		/// <summary>
		/// Método compatible con el endpoint Gemini - procesa imagen base64 directamente
		/// </summary>
		public async Task<string> AnalyzeImageFromBase64(string base64Image, string customPrompt = "")
		{
			try
			{
				// Usar prompt personalizado o el por defecto, con instrucciones similares a Gemini
				string promptToUse = string.IsNullOrEmpty(customPrompt) 
					? "Describe detalladamente el contenido de la imagen. Si ves un formulario web, describe su estructura (campos, botones, etiquetas) y realiza OCR para extraer y mostrar el texto visible. Si no es un formulario, describe la imagen normalmente. Responde en español, de forma casual y amistosa, como si fueras un amigo. Evita sonar robótico y utiliza expresiones naturales."
					: customPrompt;

				// Limpiar base64: remover prefijos como "data:image/jpeg;base64," si existen
				string cleanBase64 = base64Image;
				if (base64Image.Contains("base64,"))
				{
					cleanBase64 = base64Image.Split("base64,")[1];
				}

				// Validar y redimensionar imagen si es necesario
				cleanBase64 = ValidateAndResizeImageIfNeeded(cleanBase64);

				using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
				client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

				// Formato específico para Ollama API con imagen base64
				var requestBody = new
				{
					model = _model,
					prompt = promptToUse,
					images = new[] { cleanBase64 },
					stream = false,
					options = new
					{
						temperature = 0.7,
						num_predict = 5000
					}
				};

				var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
				
				var response = await client.PostAsync(_apiUrl, content);

				if (!response.IsSuccessStatusCode)
				{
					var errorString = await response.Content.ReadAsStringAsync();
					return $"[Error al analizar imagen con Ollama Vision: {response.StatusCode}] - {errorString}";
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
					
					return $"[ERROR] Formato inesperado en respuesta Ollama Vision:\n{responseString}";
				}
				catch (Exception ex)
				{
					return $"[ERROR] Excepción al procesar respuesta Ollama Vision: {ex.Message}\nRespuesta:\n{responseString}";
				}
			}
			catch (HttpRequestException httpEx)
			{
				return $"[ERROR] No se puede conectar a Ollama en {_apiUrl}: {httpEx.Message}";
			}
			catch (Exception ex)
			{
				return $"[ERROR] Error general en Ollama Vision: {ex.Message}";
			}
		}

		public async Task<string> AnalizarImagen(string imagePath)
		{
			// Convertir imagen a base64
			string base64Image = Convert.ToBase64String(await File.ReadAllBytesAsync(imagePath));

			using var client = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
			client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

			// Formato específico para Ollama API
			var requestBody = new
			{
				model = _model,
				prompt = _prompt,
				images = new[] { base64Image },
				stream = false,
				options = new
				{
					temperature = 0.7, // Balance entre creatividad y precisión
					num_predict = 5000
				}
			};

			var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
			var response = await client.PostAsync(_apiUrl, content);

			if (!response.IsSuccessStatusCode)
			{
				var errorString = await response.Content.ReadAsStringAsync();
				return $"[Error al analizar imagen: {response.StatusCode}]";
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
		/// Valida el tamaño de la imagen y la redimensiona si es menor a 30x30 píxeles
		/// para evitar el error "height:1 or width:1 must be larger than factor:28"
		/// </summary>
		private string ValidateAndResizeImageIfNeeded(string base64Image)
		{
			try
			{
				// Convertir base64 a bytes
				byte[] imageBytes = Convert.FromBase64String(base64Image);
				
			using (var ms = new MemoryStream(imageBytes))
			using (var originalImage = Image.Load(ms))
			{
				// Si la imagen es muy pequeña, redimensionarla a un mínimo de 300x300
				if (originalImage.Width < 30 || originalImage.Height < 30)
				{
					originalImage.Mutate(x => x.Resize(300, 300));
					
					using (var outputMs = new MemoryStream())
					{
						originalImage.SaveAsPng(outputMs);
						return Convert.ToBase64String(outputMs.ToArray());
					}
				}
			}				// Si la imagen ya tiene un tamaño adecuado, devolverla sin cambios
				return base64Image;
			}
			catch (Exception)
			{
				// Si hay error en el procesamiento, devolver la imagen original
				return base64Image;
			}
		}
	}
}