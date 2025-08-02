using System.Text.RegularExpressions;
using System.Text;
using System.Globalization;

public static class TextNormalizer
{
    // Normaliza el texto eliminando espacios extra, saltos de línea innecesarios, y convirtiendo a minúsculas
    public static string Normalize(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        // Elimina espacios al inicio y final
        string text = input.Trim();
        // Reemplaza múltiples espacios por uno solo
        text = Regex.Replace(text, @"\s+", " ");
        // Convierte a minúsculas
        text = text.ToLowerInvariant();
        // Elimina acentos y diacríticos
        text = RemoveDiacritics(text);
        // Elimina caracteres especiales irrelevantes
        text = Regex.Replace(text, @"[^a-zA-Z0-9¿?¡!.,:;()\[\]{}\-_ '\s]", "");
        return text;
    }

    // Elimina acentos y diacríticos de las letras
    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
