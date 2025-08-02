using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Net.Http.Headers;

namespace Backend.Services
{
    public class VoiceRecognitionService
    {
        private readonly HttpClient _httpClient;
        private readonly string _sttUrl = "http://127.0.0.1:5200/stt"; 

        public VoiceRecognitionService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<byte[]> SynthesizeTextToSpeechAsync(string text, string emotion = "calmado")
        {
            var payload = new
            {
                text = text,
                emotion = emotion
            };
            var json = System.Text.Json.JsonSerializer.Serialize(payload);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("http://kokoro_tts_streaming-tts-proxy-1:5100/tts", content);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsByteArrayAsync();
        }
    }
}