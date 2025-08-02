#!/usr/bin/env powershell
# Script de redespliegue rápido

Write-Host "Redesplegando servicio TTS..." -ForegroundColor Blue

# Detener servicio actual
Write-Host "Deteniendo contenedores..." -ForegroundColor Yellow
docker-compose down

# Redesplegar con rebuild
Write-Host "Reconstruyendo y desplegando..." -ForegroundColor Yellow
docker-compose up -d --build

# Esperar un momento
Start-Sleep -Seconds 5

# Verificar
Write-Host "Verificando despliegue..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5100/health" -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ ¡Redespliegue exitoso! Servicio disponible en http://localhost:5100" -ForegroundColor Green
    }
} catch {
    Write-Host "Error en el redespliegue. Verifica los logs con: docker-compose logs tts-proxy" -ForegroundColor Red
}

# Mostrar estado
Write-Host "`Estado actual:" -ForegroundColor Cyan
docker-compose ps
