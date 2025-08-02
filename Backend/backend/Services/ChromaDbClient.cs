using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Backend.Models;

namespace Backend.Services
{
    public class ChromaDbClient
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiUrl;
        private readonly string _collection;
        
        public ChromaDbClient(HttpClient httpClient, string apiUrl, string collection)
        {
            _httpClient = httpClient;
            _httpClient.Timeout = TimeSpan.FromSeconds(15); 
            _apiUrl = apiUrl;
            _collection = collection;
        }

        public async Task EnviarFragmento(FragmentoEnriquecido frag)
        {
            var payload = new
            {
                collection = _collection,
                document = frag.Texto,
                metadata = new { 
                    index = frag.Index,
                    userToken = frag.UserToken
                }
            };
            
            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            
            try
            {
                var response = await _httpClient.PostAsync(_apiUrl, content);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                }
            }
            catch (HttpRequestException)
            {
            }
            catch (TaskCanceledException)
            {
            }
            catch (Exception)
            {
            }
        }
    }
}