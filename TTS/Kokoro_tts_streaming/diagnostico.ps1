#!/usr/bin/env powershell
# Script para diagnosticar y solucionar problemas de conexión con Kokoro TTS

Write-Host "=== Diagnóstico Kokoro TTS ===" -ForegroundColor Green

# 1. Verificar si el puerto está escuchando
Write-Host "`n1. Verificando puerto 8880..." -ForegroundColor Yellow
$portCheck = netstat -an | findstr ":8880"
if ($portCheck) {
    Write-Host "✓ Puerto 8880 está en uso:" -ForegroundColor Green
    Write-Host $portCheck
} else {
    Write-Host "✗ Puerto 8880 no está en uso" -ForegroundColor Red
}

# 2. Probar endpoint de voces
Write-Host "`n2. Probando endpoint de voces..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8880/v1/audio/voices" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✓ Endpoint de voces funciona (Status: $($response.StatusCode))" -ForegroundColor Green
    
    # Parsear JSON para mostrar algunas voces
    $voices = ($response.Content | ConvertFrom-Json).voices
    Write-Host "  Voces disponibles: $($voices.Count)" -ForegroundColor Cyan
    Write-Host "  Primeras 3 voces: $($voices[0..2] -join ', ')" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Error al conectar con endpoint de voces: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Probar endpoint de síntesis
Write-Host "`n3. Probando endpoint de síntesis..." -ForegroundColor Yellow
try {
    $body = @{
        model = "kokoro"
        input = "Prueba de conexión"
        voice = "af_bella"
        response_format = "mp3"
        speed = 1.0
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:8880/v1/audio/speech" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 15 -ErrorAction Stop
    Write-Host "✓ Endpoint de síntesis funciona (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host "  Contenido recibido: $($response.RawContentLength) bytes" -ForegroundColor Cyan
    Write-Host "  Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Error al conectar con endpoint de síntesis: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Verificar Python y dependencias
Write-Host "`n4. Verificando Python y dependencias..." -ForegroundColor Yellow

if (Test-Path ".venv") {
    Write-Host "✓ Entorno virtual encontrado" -ForegroundColor Green
    
    # Activar entorno virtual y verificar dependencias
    & .venv\Scripts\Activate.ps1
    
    Write-Host "  Verificando requests..." -ForegroundColor Cyan
    & .venv\Scripts\python.exe -c "import requests; print(f'✓ requests versión: {requests.__version__}')" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ requests no está instalado" -ForegroundColor Red
    }
    
    Write-Host "  Verificando flask..." -ForegroundColor Cyan
    & .venv\Scripts\python.exe -c "import flask; print(f'✓ flask versión: {flask.__version__}')" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ✗ flask no está instalado" -ForegroundColor Red
    }
} else {
    Write-Host "✗ No se encontró entorno virtual (.venv)" -ForegroundColor Red
}

Write-Host "`n=== Fin del Diagnóstico ===" -ForegroundColor Green
