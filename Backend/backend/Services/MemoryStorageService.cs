using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Backend.Models;

namespace Backend.Services
{
    public class MemoryStorageService
    {
        private readonly ChromaDbClient _chromaClient;
        private const string ChromaApiUrl = "http://chroma-service:9000/add_fragment";
        private const string ChromaCollection = "long_term_memory";

        public MemoryStorageService(HttpClient httpClient)
        {
            _chromaClient = new ChromaDbClient(httpClient, ChromaApiUrl, ChromaCollection);
        }

        public async Task<bool> StoreMemoryAsync(string userText, string ImageAnalysis, string userToken)
        {
            if (string.IsNullOrEmpty(userText) || string.IsNullOrEmpty(ImageAnalysis))
            {
                throw new ArgumentException("UserText and Response cannot be null or empty.");
            }

            try
            {
                // Crear fragmento usando la nueva clase
                var fragmento = new FragmentoEnriquecido
                {
                    Texto = userText + "\n---\n" + ImageAnalysis,
                    Index = GenerateUniqueIndex(),
                    UserToken = userToken
                };

                // Usar ChromaDbClient para enviar el fragmento
                await _chromaClient.EnviarFragmento(fragmento);
                
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        private static int GenerateUniqueIndex()
        {
            // Usar timestamp más eficiente y hash para evitar colisiones
            return HashCode.Combine(DateTime.UtcNow.Ticks, Environment.CurrentManagedThreadId);
        }
    }
}