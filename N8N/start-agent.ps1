# PowerShell script para desplegar el Agente IA con        Write-Host "URLs del Agente IA:" -ForegroundColor Cyan
        Write-Host "Interfaz n8n: http://localhost:5678" -ForegroundColor White
        Write-Host "Webhook Agente: http://localhost:5678/webhook/asistente" -ForegroundColor White
        Write-Host "Usuario: admin" -ForegroundColor White
        Write-Host "Contraseña: Definida en variables de entorno N8N_PASSWORD" -ForegroundColor White
        Write-Host ""
        Write-Host "CONFIGURACIÓN:" -ForegroundColor Yellow
        Write-Host "1. Abre http://localhost:5678 en tu navegador" -ForegroundColor White
        Write-Host "2. Inicia sesión con las credenciales configuradas" -ForegroundColor Whiterite-Host "Desplegando Agente IA con n8n..." -ForegroundColor Green

# Verificar que los servicios base estén corriendo
Write-Host "Verificando servicios existentes..." -ForegroundColor Yellow
$containers = docker ps --format "table {{.Names}}\t{{.Status}}"
Write-Host $containers

# Verificar servicios críticos
$requiredServices = @("asistente-webapi", "chroma-service", "chromadb", "kokoro_tts_streaming-tts-proxy-1")
$missingServices = @()

foreach ($service in $requiredServices) {
    $running = docker ps --filter "name=$service" --format "{{.Names}}"
    if (-not $running) {
        $missingServices += $service
    }
}

if ($missingServices.Count -gt 0) {
    Write-Host "Servicios faltantes: $($missingServices -join ', ')" -ForegroundColor Red
    Write-Host "Por favor, inicia todos los servicios base antes de continuar." -ForegroundColor Red
    exit 1
}

Write-Host "Todos los servicios base están corriendo" -ForegroundColor Green

# Cambiar al directorio N8N
Set-Location N8N

# Parar n8n si ya está corriendo
Write-Host "Deteniendo instancia anterior de n8n..." -ForegroundColor Yellow
docker-compose -f docker-compose.n8n.yml down 2>$null

# Levantar n8n con Redis
Write-Host "Iniciando Agente IA con n8n..." -ForegroundColor Yellow
docker-compose -f docker-compose.n8n.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "Agente IA desplegado exitosamente!" -ForegroundColor Green
    
    # Esperar a que n8n esté listo
    Write-Host "Esperando a que n8n esté listo..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    
    # Verificar que n8n esté corriendo
    $n8nStatus = docker ps --filter "name=n8n-asistente-agent" --format "{{.Status}}"
    if ($n8nStatus -like "*Up*") {
        Write-Host "n8n está corriendo correctamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "URLs del Agente IA:" -ForegroundColor Cyan
        Write-Host "Interfaz n8n: http://localhost:5678" -ForegroundColor White
        Write-Host "Webhook Agente: http://localhost:5678/webhook/asistente" -ForegroundColor White
        Write-Host "Usuario: admin" -ForegroundColor White
        Write-Host "Contraseña: asistente2024" -ForegroundColor White
        Write-Host ""
        Write-Host "Pasos siguientes:" -ForegroundColor Yellow
        Write-Host "1. Abre http://localhost:5678 en tu navegador" -ForegroundColor White
        Write-Host "2. Inicia sesión con admin/asistente2024" -ForegroundColor White
        Write-Host "3. Importa los workflows desde la carpeta workflows/" -ForegroundColor White
        Write-Host "4. Activa los workflows principales" -ForegroundColor White
        Write-Host "5. Configura la extensión para usar el nuevo endpoint" -ForegroundColor White
        Write-Host ""
        Write-Host "Servicios conectados:" -ForegroundColor Green
        Write-Host "API Backend (puerto 5000)" -ForegroundColor White
        Write-Host "ChromaDB RAG (puerto 9000)" -ForegroundColor White
        Write-Host "TTS Kokoro (puerto 5100)" -ForegroundColor White
        Write-Host "Redis Queue (puerto 6379)" -ForegroundColor White
    } else {
        Write-Host "❌ Error: n8n no está corriendo correctamente" -ForegroundColor Red
        docker logs n8n-asistente-agent --tail 20
    }
} else {
    Write-Host "❌ Error al desplegar el agente IA" -ForegroundColor Red
}

# Volver al directorio raíz
Set-Location ..
