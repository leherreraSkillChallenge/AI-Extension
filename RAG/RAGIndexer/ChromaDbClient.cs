using System.Net.Http;
using System.Text;
using System.Text.Json;

public class ChromaDbClient
{
    private readonly string _apiUrl;
    private readonly string _collection;
    public ChromaDbClient(string apiUrl, string collection)
    {
        _apiUrl = apiUrl;
        _collection = collection;
    }

    public async Task EnviarFragmento(FragmentoEnriquecido frag)
    {
        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromMinutes(2);
        
        var payload = new
        {
            collection = _collection,
            document = frag.Texto,
            metadata = new { index = frag.Index }
        };
        
        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        try
        {
            Console.WriteLine($"Enviando fragmento {frag.Index} a ChromaDB...");
            var response = await client.PostAsync(_apiUrl, content);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Fragmento {frag.Index} enviado exitosamente");
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Error al enviar fragmento {frag.Index}: {response.StatusCode}");
                Console.WriteLine($"Error: {errorContent}");
            }
        }
        catch (HttpRequestException ex)
        {
            Console.WriteLine($"Error de red al enviar fragmento {frag.Index}: {ex.Message}");
        }
        catch (TaskCanceledException ex)
        {
            Console.WriteLine($"Timeout al enviar fragmento {frag.Index}: {ex.Message}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error inesperado al enviar fragmento {frag.Index}: {ex.Message}");
        }
    }
}
