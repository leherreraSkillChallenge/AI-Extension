using Novacode;
using System.Drawing.Imaging;
using System.IO.Compression;

public class DocxProcessor
{
    private readonly string _docxPath;
    public DocxProcessor(string docxPath) => _docxPath = docxPath;

    public async Task<List<FragmentoEnriquecido>> ExtraerFragmentosEnriquecidos(QwenVisionClient qwenClient)
    {
        var fragments = new List<FragmentoEnriquecido>();
        if (!File.Exists(_docxPath))
        {
            Console.WriteLine($"No se encontró el archivo {_docxPath}");
            return fragments;
        }
        Console.WriteLine($"Procesando documento: {_docxPath}\n");
        var imagePaths = ExtractImagesFromDocx(_docxPath);
        int imageIdx = 0;
        using (var doc = DocX.Load(_docxPath))
        {
            int idx = 0;
            foreach (var para in doc.Paragraphs)
            {
                string texto = para.Text.Trim();
                if (string.IsNullOrWhiteSpace(texto)) continue;

                // Normalizar el texto antes de enriquecerlo
                string textoNormalizado = TextNormalizer.Normalize(texto);

                Console.WriteLine($"\n--- Procesando página (párrafo) {idx} ---");
                Console.WriteLine($"Texto extraído (normalizado):\n{textoNormalizado}\n");

                var analisisImagenes = new List<string>();
                // Asociar una imagen por párrafo si existe
                if (imageIdx < imagePaths.Count)
                {
                    string tempImgPath = imagePaths[imageIdx++];
                    string analisis = await qwenClient.AnalizarImagen(tempImgPath);
                    analisisImagenes.Add(analisis);
                    File.Delete(tempImgPath);
                }
                string textoEnriquecido = textoNormalizado;
                if (analisisImagenes.Count > 0)
                {
                    textoEnriquecido += "\n\n[Análisis de imágenes]:\n" + string.Join("\n", analisisImagenes);
                }
                fragments.Add(new FragmentoEnriquecido
                {
                    Texto = textoEnriquecido,
                    Index = idx
                });
                Console.WriteLine($"--- Página (párrafo) {idx} procesada ---\n");
                idx++;
            }
        }
        Console.WriteLine("Procesamiento del documento finalizado.\n");
        return fragments;
    }

// Extrae todas las imágenes del .docx (word/media) y las guarda como archivos temporales
private List<string> ExtractImagesFromDocx(string docxPath)
{
    var tempImagePaths = new List<string>();
    string imagesDir = "imagenes_temp";
    if (!Directory.Exists(imagesDir))
        Directory.CreateDirectory(imagesDir);

    using (var archive = System.IO.Compression.ZipFile.OpenRead(docxPath))
    {
        foreach (var entry in archive.Entries)
        {
            if (entry.FullName.StartsWith("word/media/"))
            {
                string ext = Path.GetExtension(entry.FullName);
                string tempImgPath = Path.Combine(imagesDir, $"temp_{Guid.NewGuid()}{ext}");
                using (var entryStream = entry.Open())
                using (var fileStream = File.Create(tempImgPath))
                {
                    entryStream.CopyTo(fileStream);
                }
                tempImagePaths.Add(tempImgPath);
            }
        }
    }
    return tempImagePaths;
}
}
