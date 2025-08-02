using System;
using System.Threading.Tasks;

public class TestChromaDB
{
    private readonly ChromaDbClient _chromaClient;
    public TestChromaDB(ChromaDbClient chromaClient)
    {
        _chromaClient = chromaClient;
    }

    public async Task ProbarEnvioAsync()
    {
        var frag = new FragmentoEnriquecido
        {
            Texto = "Este es un fragmento de prueba para ChromaDB.",
            Index = 9999
        };
        Console.WriteLine("Enviando fragmento de prueba a ChromaDB...");
        await _chromaClient.EnviarFragmento(frag);
        Console.WriteLine("Prueba de envío a ChromaDB finalizada.\n");
    }
}
