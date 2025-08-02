using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Backend.Models;

namespace Backend.Services
{
    public class ManualFragment
    {
        public required string Text { get; set; }
        public int Index { get; set; }
    }

    public class ManualRagService
    {
        private static readonly string QueryServiceUrl = Environment.GetEnvironmentVariable("CHROMA_SERVICE_URL") ?? "http://chroma-service:9000/query";
        private readonly HttpClient _httpClient;
        private readonly CacheService _cache;

        public ManualRagService(HttpClient httpClient, CacheService cache)
        {
            _httpClient = httpClient;
            _cache = cache;
            _httpClient.Timeout = TimeSpan.FromSeconds(10); // Timeout más agresivo
        }

        public async Task<ManualFragment?> FindRelevantFragmentAsync(string query)
        {
            // Usar cache para consultas repetidas
            var cacheKey = $"manual_rag_{query.GetHashCode()}";
            return await _cache.GetOrSetAsync(cacheKey, async () =>
            {
                return await ExecuteQuery(query);
            });
        }

        private async Task<ManualFragment?> ExecuteQuery(string query)
        {
            var payload = new {
                collection = "manuel",
                query_text = query,
                n_results = 5,
                filter = new {
                    distances = new Dictionary<string, object> { { "$gte", 1 } }
                }
            };
            var jsonPayload = JsonSerializer.Serialize(payload);
            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
            
            try
            {
                var response = await _httpClient.PostAsync(QueryServiceUrl, content);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<ChromaQueryResponse>(json);

                if (result?.documents != null && result.documents.Count > 0 && result.documents[0].Count > 0)
                {
                    var textos = result.documents[0];
                    var textoUnido = string.Join("\n---\n", textos);
                    var idx = result.metadatas != null && result.metadatas.Count > 0 && result.metadatas[0].Count > 0 ? result.metadatas[0][0]?.index ?? 0 : 0;
                    return new ManualFragment { Text = textoUnido, Index = idx };
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