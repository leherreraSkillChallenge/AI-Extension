using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Drawing;
using System.Drawing.Imaging;

public class ApiValidator : IDisposable
{
    private readonly HttpClient _httpClient;

    public ApiValidator()
    {
        _httpClient = new HttpClient();
        _httpClient.Timeout = TimeSpan.FromMinutes(2);
    }

    public async Task ValidarTodasLasApis()
    {
        Console.WriteLine("=== VALIDACIÓN DE APIS ===\n");

        // 0. Validar conectividad de red básica
        await NetworkValidator.ValidarDNS();
        await NetworkValidator.ValidarConectividadDocker();

        // 1. Validar ChromaDB directamente
        await ValidarChromaDBDirecto();

        // 2. Validar microservicio de ChromaDB
        await ValidarMicroservicioChroma();

        // 3. Validar LM Studio / Qwen
        await ValidarQwenVision();

        // 4. Validar envío completo
        await ValidarFlujoCompleto();

        Console.WriteLine("\n=== VALIDACIÓN COMPLETADA ===");
    }

    private async Task ValidarChromaDBDirecto()
    {
        Console.WriteLine("1. Validando ChromaDB directo (puerto 8000)...");
        try
        {
            var response = await _httpClient.GetAsync("http://localhost:8000/api/v1/heartbeat");
            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine("✅ ChromaDB directo: OK");
            }
            else
            {
                Console.WriteLine($"ChromaDB directo: Error {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"ChromaDB directo: Error de conexión - {ex.Message}");
        }
        Console.WriteLine();
    }

    private async Task ValidarMicroservicioChroma()
    {
        Console.WriteLine("2. Validando microservicio ChromaDB (puerto 9000)...");
        try
        {
            // Verificar health
            var healthResponse = await _httpClient.GetAsync("http://localhost:9000/health");
            if (healthResponse.IsSuccessStatusCode)
            {
                var healthContent = await healthResponse.Content.ReadAsStringAsync();
                Console.WriteLine($"Microservicio ChromaDB health: OK");
                Console.WriteLine($"Respuesta: {healthContent}");

                // Probar envío de fragmento de prueba
                await ProbarEnvioFragmento();
            }
            else
            {
                Console.WriteLine($"Microservicio ChromaDB health: Error {healthResponse.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Microservicio ChromaDB: Error de conexión - {ex.Message}");
        }
        Console.WriteLine();
    }

    private async Task ProbarEnvioFragmento()
    {
        Console.WriteLine("   Probando envío de fragmento de prueba...");
        try
        {
            var payload = new
            {
                collection = "test_validation",
                document = "Este es un fragmento de prueba para validar la API",
                metadata = new { index = 99999, test = true }
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("http://localhost:9000/add_fragment", content);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine("Envío de fragmento: OK");
                Console.WriteLine($"Respuesta: {responseContent}");
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Envío de fragmento: Error {response.StatusCode}");
                Console.WriteLine($"Error: {errorContent}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Envío de fragmento: Error - {ex.Message}");
        }
    }

    private async Task ValidarQwenVision()
    {
        Console.WriteLine("3. Validando LM Studio / Qwen Vision (puerto 1234)...");
        try
        {
            // Crear una imagen de prueba pequeña
            string testImagePath = await CrearImagenDePrueba();

            var qwenClient = new QwenVisionClient("http://localhost:1234/v1/chat/completions");
            var resultado = await qwenClient.AnalizarImagen(testImagePath);

            if (!string.IsNullOrEmpty(resultado) && !resultado.Contains("Error"))
            {
                Console.WriteLine("Qwen Vision: OK");
                Console.WriteLine($"Respuesta: {resultado.Substring(0, Math.Min(resultado.Length, 100))}...");
            }
            else
            {
                Console.WriteLine($"Qwen Vision: Error o respuesta vacía");
                Console.WriteLine($"Respuesta: {resultado}");
            }

            // Limpiar imagen temporal
            if (File.Exists(testImagePath))
                File.Delete(testImagePath);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Qwen Vision: Error - {ex.Message}");
        }
        Console.WriteLine();
    }

    private async Task<string> CrearImagenDePrueba()
    {
        string tempPath = Path.Combine("imagenes_temp", $"test_validation_{Guid.NewGuid()}.png");
        Directory.CreateDirectory(Path.GetDirectoryName(tempPath));

        using var bitmap = new Bitmap(200, 100);
        using var graphics = Graphics.FromImage(bitmap);
        graphics.Clear(Color.White);
        graphics.DrawString("TEST IMAGEN", new Font("Arial", 16), Brushes.Black, 10, 30);
        bitmap.Save(tempPath, ImageFormat.Png);

        return tempPath;
    }

    private async Task ValidarFlujoCompleto()
    {
        Console.WriteLine("4. Validando flujo completo...");
        try
        {
            // Crear fragmento enriquecido de prueba
            var fragmento = new FragmentoEnriquecido
            {
                Texto = "Este es un fragmento de validación completa del flujo RAG",
                Index = 88888
            };

            var chromaClient = new ChromaDbClient("http://localhost:9000/add_fragment", "test_validation");
            await chromaClient.EnviarFragmento(fragmento);

            Console.WriteLine("Flujo completo: OK");
            Console.WriteLine("Fragmento enviado exitosamente a ChromaDB");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Flujo completo: Error - {ex.Message}");
        }
        Console.WriteLine();
    }

    public void Dispose()
    {
        _httpClient?.Dispose();
    }
}
