#!/usr/bin/env powershell
# Script de despliegue para Docker

Write-Host "=== Kokoro TTS Proxy - Despliegue Docker ===" -ForegroundColor Green

# Función para verificar si Docker está ejecutándose
function Test-DockerRunning {
    try {
        docker version | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Verificar Docker
if (-not (Test-DockerRunning)) {
    Write-Host "❌ Docker no está ejecutándose. Por favor, inicia Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Docker está ejecutándose" -ForegroundColor Green

# Verificar si Kokoro TTS está ejecutándose
Write-Host "`nVerificando Kokoro TTS..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8880/v1/audio/voices" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Kokoro TTS está ejecutándose en puerto 8880" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Advertencia: Kokoro TTS no está disponible en puerto 8880" -ForegroundColor Yellow
    Write-Host "   El servicio proxy se iniciará pero puede fallar sin Kokoro TTS" -ForegroundColor Yellow
}

# Detener contenedores existentes
Write-Host "`nDeteniendo contenedores existentes..." -ForegroundColor Yellow
docker-compose down

# Limpiar imágenes antiguas (opcional)
$cleanImages = Read-Host "`n¿Deseas limpiar imágenes antiguas? (y/N)"
if ($cleanImages -eq "y" -or $cleanImages -eq "Y") {
    Write-Host "Limpiando imágenes..." -ForegroundColor Yellow
    docker system prune -f
}

# Construir y desplegar
Write-Host "`nConstruyendo y desplegando servicio..." -ForegroundColor Green
docker-compose up -d --build

# Esperar a que el servicio esté listo
Write-Host "`nEsperando a que el servicio esté listo..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Verificar el despliegue
Write-Host "`nVerificando despliegue..." -ForegroundColor Yellow

$maxRetries = 6
$retryCount = 0
$serviceReady = $false

while ($retryCount -lt $maxRetries -and -not $serviceReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5100/health" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $healthData = $response.Content | ConvertFrom-Json
            Write-Host "✓ Servicio TTS Proxy está ejecutándose" -ForegroundColor Green
            Write-Host "  Status: $($healthData.status)" -ForegroundColor Cyan
            Write-Host "  Kokoro TTS: $($healthData.kokoro_tts)" -ForegroundColor Cyan
            Write-Host "  URL: $($healthData.kokoro_url)" -ForegroundColor Cyan
            $serviceReady = $true
        }
    } catch {
        $retryCount++
        Write-Host "  Intento $retryCount/$maxRetries fallido, reintentando..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

if ($serviceReady) {
    Write-Host "`n🎉 ¡Despliegue exitoso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Endpoints disponibles:" -ForegroundColor Cyan
    Write-Host "   Health Check: http://localhost:5100/health" -ForegroundColor White
    Write-Host "   TTS API:      http://localhost:5100/tts" -ForegroundColor White
    Write-Host "   Test:         http://localhost:5100/test" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Comandos útiles:" -ForegroundColor Cyan
    Write-Host "   Ver logs:     docker-compose logs -f tts-proxy" -ForegroundColor White
    Write-Host "   Detener:      docker-compose down" -ForegroundColor White
    Write-Host "   Reiniciar:    docker-compose restart tts-proxy" -ForegroundColor White
    Write-Host ""
    
    # Test rápido
    Write-Host "🧪 Ejecutando test rápido..." -ForegroundColor Yellow
    try {
        $testBody = '{"text": "Despliegue exitoso", "emotion": "feliz", "voice": "af_bella", "response_format": "mp3", "speed": 1.0}'
        $testResponse = Invoke-WebRequest -Uri "http://localhost:5100/tts" -Method POST -Body $testBody -ContentType "application/json" -TimeoutSec 15
        Write-Host "✓ Test de TTS exitoso - Audio generado: $($testResponse.RawContentLength) bytes" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Test de TTS falló: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
} else {
    Write-Host "`n❌ El despliegue falló. Verifica los logs:" -ForegroundColor Red
    Write-Host "docker-compose logs tts-proxy" -ForegroundColor White
}

Write-Host "`n=== Despliegue completado ===" -ForegroundColor Green
