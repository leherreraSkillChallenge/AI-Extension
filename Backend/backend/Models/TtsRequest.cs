namespace Backend.Models
{
    public class TtsRequest
    {
        public string text { get; set; } = string.Empty;
        public string? emotion { get; set; }
    }
}