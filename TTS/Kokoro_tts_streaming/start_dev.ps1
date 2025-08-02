#!/usr/bin/env powershell
# Script de inicio para el desarrollo local

Write-Host "=== Kokoro TTS Proxy - Inicio de Desarrollo ===" -ForegroundColor Green

# Verificar si el entorno virtual existe
if (!(Test-Path ".venv")) {
    Write-Host "Creando entorno virtual..." -ForegroundColor Yellow
    python -m venv .venv
}

# Activar entorno virtual
Write-Host "Activando entorno virtual..." -ForegroundColor Yellow
& .venv\Scripts\Activate.ps1

# Instalar dependencias si no están instaladas
Write-Host "Verificando dependencias..." -ForegroundColor Yellow
& .venv\Scripts\python.exe -c "import flask" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Instalando dependencias..." -ForegroundColor Yellow
    & .venv\Scripts\pip.exe install -r requirements.txt
}

# Verificar que Kokoro TTS esté ejecutándose
Write-Host "Verificando conexión con Kokoro TTS..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8880/v1/audio/voices" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Kokoro TTS está ejecutándose" -ForegroundColor Green
} catch {
    Write-Host "⚠ Advertencia: No se puede conectar a Kokoro TTS en localhost:8880" -ForegroundColor Red
    Write-Host "  Asegúrate de que Kokoro TTS esté ejecutándose antes de usar el servicio" -ForegroundColor Yellow
}

# Ejecutar el servidor
Write-Host "Iniciando servidor TTS Proxy en puerto 5100..." -ForegroundColor Green
Write-Host "Health Check: http://localhost:5100/health" -ForegroundColor Cyan
Write-Host "API Endpoint: http://localhost:5100/tts" -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

& .venv\Scripts\python.exe server.py
