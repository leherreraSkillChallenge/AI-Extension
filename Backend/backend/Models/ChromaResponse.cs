using System.Collections.Generic;

namespace Backend.Models
{
    public class ChromaQueryResponse
    {
        public List<List<string>>? documents { get; set; }
        public List<List<ChromaMetadata>>? metadatas { get; set; }
    }

    public class ChromaMetadata
    {
        public int index { get; set; }
        public string? userToken { get; set; }
    }
}
