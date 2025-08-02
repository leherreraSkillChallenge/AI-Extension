
using Novacode;
using System.Drawing;
using System.Drawing.Imaging;
using System.Net.Http;
using System.Net.Http.Headers;

public class Program
{
	public static async Task Main(string[] args)
	{
		string docxPath = @"Manual\\Manual de Usuario Aplicativo.docx";
		string qwenApiUrl = "http://localhost:1234/v1/chat/completions";
        string chromaApiUrl = "http://localhost:9000/add_fragment";
        string chromaCollection = "manual";

        var docxProcessor = new DocxProcessor(docxPath);
        var qwenClient = new QwenVisionClient(qwenApiUrl);
        var chromaClient = new ChromaDbClient(chromaApiUrl, chromaCollection);

        // Validar todas las APIs antes de procesar
        Console.WriteLine("Validando conectividad de APIs...\n");
        using var validator = new ApiValidator();
        await validator.ValidarTodasLasApis();

        Console.WriteLine("¿Desea continuar con el procesamiento del documento? (s/n): ");
        var continuar = Console.ReadLine();
        if (continuar?.ToLower() != "s")
        {
            Console.WriteLine("Procesamiento cancelado.");
            return;
        }

        // Ejecutar prueba de ChromaDB antes de procesar el documento
        //var tester = new TestChromaDB(chromaClient);
        //await tester.ProbarEnvioAsync();
        
        var fragments = await docxProcessor.ExtraerFragmentosEnriquecidos(qwenClient);

        foreach (var frag in fragments)
        {
            await chromaClient.EnviarFragmento(frag);
            Console.WriteLine($"Fragmento {frag.Index} enviado a ChromaDB");
        }

            Console.WriteLine("Indexación finalizada.");
        
        }
}
