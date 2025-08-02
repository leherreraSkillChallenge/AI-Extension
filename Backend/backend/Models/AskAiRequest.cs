namespace Backend.Models
{
    public class MemoryItem
    {
        public string timestamp { get; set; } = string.Empty;
        public string user { get; set; } = string.Empty;
    }

    public class AskAiRequest
    {
        public string UserText { get; set; } = string.Empty;
        public string ImageAnalysis { get; set; } = string.Empty;
        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "google/gemma-3n-e4b-it:free";
        public List<MemoryItem> Memory { get; set; } = new List<MemoryItem>();
    }
}
