using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Backend.Models;

namespace Backend.Services
{
    public class MemoryRagService
    {
        private static readonly string QueryServiceUrl = Environment.GetEnvironmentVariable("CHROMA_SERVICE_URL") ?? "http://chroma-service:9000/query";
        private readonly HttpClient _httpClient;

        public MemoryRagService(HttpClient httpClient)
        {
            _httpClient = httpClient;
            _httpClient.Timeout = TimeSpan.FromSeconds(10);
        }

        public async Task<FragmentoEnriquecido?> FindRelevantFragmentAsync(string query, string userToken = "")
        {
            var payload = new {
                collection = "long_term_memory",
                query_text = query,
                n_results = 5,
                where = !string.IsNullOrEmpty(userToken) ? new Dictionary<string, object> 
                { 
                    ["userToken"] = new Dictionary<string, object> { ["$eq"] = userToken } 
                } : null
            };
            var jsonPayload = JsonConvert.SerializeObject(payload);
            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
            
            try
            {
                var response = await _httpClient.PostAsync(QueryServiceUrl, content);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonConvert.DeserializeObject<ChromaQueryResponse>(json);

                if (result?.documents != null && result.documents.Count > 0 && result.documents[0].Count > 0)
                {
                    var textos = result.documents[0];
                    var textoUnido = string.Join("\n---\n", textos);
                    var idx = result.metadatas != null && result.metadatas.Count > 0 && result.metadatas[0].Count > 0 ? result.metadatas[0][0]?.index ?? 0 : 0;
                    return new FragmentoEnriquecido { Texto = textoUnido, Index = idx, UserToken = userToken };
                }
                return null;
            }
            catch (TaskCanceledException)
            {
                return null;
            }
            catch (HttpRequestException)
            {
                return null;
            }
        }
    }
}
