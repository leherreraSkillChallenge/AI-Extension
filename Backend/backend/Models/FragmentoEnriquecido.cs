namespace Backend.Models
{
    public class FragmentoEnriquecido
    {
        public required string Texto { get; set; }
        public int Index { get; set; }
        public string UserToken { get; set; } = string.Empty;
    }
}