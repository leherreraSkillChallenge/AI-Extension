using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text;
using System.Text.RegularExpressions;
using Backend.Models;
using Backend.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Registro de servicios con HttpClient
builder.Services.AddHttpClient<Backend.Services.VoiceRecognitionService>();
builder.Services.AddHttpClient<Backend.Services.OllamaAskClient>();
builder.Services.AddHttpClient<Backend.Services.OllamaVisionClient>();
builder.Services.AddHttpClient<Backend.Services.MemoryStorageService>();
builder.Services.AddHttpClient<Backend.Services.ManualRagService>();
builder.Services.AddHttpClient<Backend.Services.MemoryRagService>();
builder.Services.AddHttpClient<Backend.Services.GemmaVisionServices>();
builder.Services.AddHttpClient<Backend.Services.OpenRouterService>();

// Registro de servicios singleton con HttpClient inyectado
builder.Services.AddSingleton<Backend.Services.OllamaAskClient>();
builder.Services.AddSingleton<Backend.Services.OllamaVisionClient>();
builder.Services.AddSingleton<Backend.Services.CacheService>(); // Cache como singleton
builder.Services.AddScoped<Backend.Services.ManualRagService>();
builder.Services.AddScoped<Backend.Services.MemoryRagService>();
builder.Services.AddScoped<Backend.Services.GemmaVisionServices>();
builder.Services.AddScoped<Backend.Services.OpenRouterService>();

// Servicio de limpieza de cache en background
builder.Services.AddHostedService<Backend.Services.CacheCleanupService>();

var app = builder.Build();
app.Urls.Add("http://0.0.0.0:5000");
app.UseCors("AllowAll");
app.UseSwagger();
app.UseSwaggerUI();
app.MapPost("/api/ask-ai", async (AskAiRequest req) =>
{
    try
    {
        // Validar campos requeridos
        if (string.IsNullOrEmpty(req.UserText))
        {
            return Results.BadRequest(new { error = "UserText is required" });
        }

        // Obtener configuración para decidir qué AI usar (lógica interna)
        var config = app.Services.GetRequiredService<IConfiguration>();
        var useLocalAI = config.GetValue<bool>("AIConfiguration:UseLocalAI");
        
        string result;
    
    if (useLocalAI)
    {
        // Usar OllamaAskClient (AI Local)
        var ollamaAsk = app.Services.GetRequiredService<OllamaAskClient>();
        var manualRag = app.Services.GetRequiredService<ManualRagService>();
        var memoryRag = app.Services.GetRequiredService<MemoryRagService>();
        
        // Extraer userToken desde req.ApiKey o desde Memory si está disponible
        var userToken = !string.IsNullOrEmpty(req.ApiKey) ? req.ApiKey 
                      : req.Memory?.FirstOrDefault()?.user ?? "";
        
        // Ejecutar búsquedas en paralelo para reducir latencia
        var fragmentTask = manualRag.FindRelevantFragmentAsync(req.UserText);
        var memoryFragmentTask = memoryRag.FindRelevantFragmentAsync(req.UserText, userToken);
        
        // Esperar ambas tareas en paralelo
        await Task.WhenAll(fragmentTask, memoryFragmentTask);
        
        var fragment = await fragmentTask;
        var memoryFragment = await memoryFragmentTask;
        
        // Filtrar ImageAnalysis si contiene errores
        var imageAnalysis = req.ImageAnalysis;
        if (!string.IsNullOrEmpty(imageAnalysis) && imageAnalysis.Contains("[Error"))
        {
            imageAnalysis = "Error al procesar la imagen.";
        }
        
        var prompt = 
$@"Eres un asistente virtual inteligente llamado 'AI Extension'. Tu función es ayudar al usuario con información técnica y mantener conversaciones naturales y empaticas.

CONTEXTO DISPONIBLE:
===================
Manual técnico:
{fragment?.Text ?? "No hay información técnica relevante disponible."}

Lo que veo en la imagen:
{imageAnalysis ?? "No hay imagen para analizar."}

Historial de conversación (solo como referencia para el tono y continuidad, NO para responder directamente):
{memoryFragment?.Texto ?? "Esta es una nueva conversación."}

Lo que me dices ahora:
{req.UserText}

INSTRUCCIONES:
=============
- Prioriza SIEMPRE la información del manual y el análisis de la imagen para responder a la consulta actual.
- Usa el historial de conversación solo para mantener coherencia y contexto, pero NO dejes que influya más que el análisis de la imagen y el manual.
- Actúa como un asistente personal que ve lo mismo que el usuario y escucha sus consultas.
- Usa toda la información disponible para dar respuestas completas y precisas.
- Si hay historial previo, haz referencia natural a conversaciones anteriores solo si es relevante.
- Si hay una imagen, descríbela o analízala según sea relevante para la pregunta.
- Responde en español con un tono amigable pero profesional.
- Si no tienes información suficiente, sé honesto al respecto.
- Mantén las respuestas concisas pero informativas.
- No describas el Asistente IA, omite hablar sober el.

Respuesta:";
        result = await ollamaAsk.GetCompletionAsync(prompt);
    }
    else
    {
        // Usar OpenRouter (AI Online)
        var apiKey = SecretsService.GetOpenRouterApiKey();
        var model = "google/gemma-3n-e4b-it:free";
        var manualRag = app.Services.GetRequiredService<ManualRagService>();
        var memoryRag = app.Services.GetRequiredService<MemoryRagService>();
        var openRouter = app.Services.GetRequiredService<OpenRouterService>();
        
        // Extraer userToken desde req.ApiKey o desde Memory si está disponible
        var userToken = !string.IsNullOrEmpty(req.ApiKey) ? req.ApiKey 
                      : req.Memory?.FirstOrDefault()?.user ?? "";
        
        // Ejecutar búsquedas en paralelo para reducir latencia
        var fragmentTask = manualRag.FindRelevantFragmentAsync(req.UserText);
        var memoryFragmentTask = memoryRag.FindRelevantFragmentAsync(req.UserText, userToken);
        
        // Esperar ambas tareas en paralelo
        await Task.WhenAll(fragmentTask, memoryFragmentTask);
        
        var fragment = await fragmentTask;
        var memoryFragment = await memoryFragmentTask;
        
        // Filtrar ImageAnalysis si contiene errores
        var imageAnalysis = req.ImageAnalysis;
        if (!string.IsNullOrEmpty(imageAnalysis) && imageAnalysis.Contains("[Error"))
        {
            imageAnalysis = "Error al procesar la imagen.";
        }
        
        var prompt = 
$@"Eres un asistente virtual inteligente llamado 'AI Extension'. Tu función es ayudar al usuario con información técnica y mantener conversaciones naturales y empaticas.

CONTEXTO DISPONIBLE:
===================
Manual técnico:
{fragment?.Text ?? "No hay información técnica relevante disponible."}

Lo que veo en la imagen:
{imageAnalysis ?? "No hay imagen para analizar."}

Historial de conversación (solo como referencia para el tono y continuidad, NO para responder directamente):
{memoryFragment?.Texto ?? "Esta es una nueva conversación."}

Lo que me dices ahora:
{req.UserText}

INSTRUCCIONES:
=============
- Prioriza SIEMPRE la información del manual y el análisis de la imagen para responder a la consulta actual.
- Usa el historial de conversación solo para mantener coherencia y contexto, pero NO dejes que influya más que el análisis de la imagen y el manual.
- Actúa como un asistente personal que ve lo mismo que el usuario y escucha sus consultas.
- Usa toda la información disponible para dar respuestas completas y precisas.
- Si hay historial previo, haz referencia natural a conversaciones anteriores solo si es relevante.
- Si hay una imagen, descríbela o analízala según sea relevante para la pregunta.
- Responde en español con un tono amigable pero profesional.
- Si no tienes información suficiente, sé honesto al respecto.
- Mantén las respuestas concisas pero informativas.
- No describas el Asistente IA, omite hablar sober el.

Respuesta:";
        result = await openRouter.GetCompletionAsync(prompt, apiKey, model);
    }
    
    // Mantener la misma respuesta que espera n8n
    return Results.Json(new { result });
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

app.MapPost("/api/analyze-image-gemini", async (ImageRequest req) =>
{
    // Obtener configuración para decidir qué servicio de visión usar (lógica interna)
    var config = app.Services.GetRequiredService<IConfiguration>();
    var useLocalVision = config.GetValue<bool>("AIConfiguration:UseLocalVision");
    
    string result;
    
    if (useLocalVision)
    {
        // Usar OllamaVisionClient (Visión Local)
        var ollamaVision = app.Services.GetRequiredService<OllamaVisionClient>();
        result = await ollamaVision.AnalyzeImageFromBase64(req.Base64Image);
    }
    else
    {
        // Usar Gemini Vision (Visión Online)
        var apiKey = SecretsService.GetGeminiApiKey();
        var gemmaVision = app.Services.GetRequiredService<GemmaVisionServices>();
        try
        {
            result = await gemmaVision.AnalyzeImageAsync(req.Base64Image, apiKey);
        }
        catch (HttpRequestException ex)
        {
            return Results.Json(new { error = ex.Message }, statusCode: 400);
        }
    }
    
    // Mantener la misma respuesta que espera n8n
    return Results.Json(new { result });
});


app.MapPost("/api/tts", async (HttpContext context, VoiceRecognitionService ttsService) =>
{
    var request = await System.Text.Json.JsonSerializer.DeserializeAsync<TtsRequest>(context.Request.Body);
    if (request?.text != null)
    {
        var audioBytes = await ttsService.SynthesizeTextToSpeechAsync(request.text, request.emotion ?? "calmado");
        return Results.File(audioBytes, "audio/mpeg");
    }
    return Results.BadRequest("Invalid request");
});

app.MapPost("/api/store-memory", async (MemoryRequest req, MemoryStorageService memoryService) =>
{
    try
    {
        // Almacenar pregunta y respuesta en memoria
        var success = await memoryService.StoreMemoryAsync(req.UserText, req.ImageAnalysis, req.UserToken);

        if (success)
        {
            return Results.Json(new
            {
                success = true,
                message = "Memory almacenada."
            });
        }
        else
        {
            return Results.Json(new { success = false, error = "fallo al almacenar la memoria." }, statusCode: 500);
        }
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Json(new { success = false, error = $"An error occurred: {ex.Message}" }, statusCode: 500);
    }
});


app.Run();