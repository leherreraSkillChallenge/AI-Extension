# Script para configurar variables de entorno seguras para N8N
# Ejecutar: .\setup-env.ps1

Write-Host "Configurando variables de entorno seguras para N8N..." -ForegroundColor Cyan

# Verificar si existe .env
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Write-Host "El archivo .env ya existe. ¿Desea sobrescribirlo? (y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Operación cancelada." -ForegroundColor Red
        exit
    }
}

# Generar password seguro
Write-Host "Generando password seguro..." -ForegroundColor Green
$bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$securePassword = [Convert]::ToBase64String($bytes)

# Obtener usuario
$defaultUser = "admin"
Write-Host "👤 Usuario N8N [$defaultUser]: " -NoNewline -ForegroundColor Yellow
$user = Read-Host
if ([string]::IsNullOrWhiteSpace($user)) {
    $user = $defaultUser
}

# Crear archivo .env
$envContent = @"
# Variables de entorno para N8N - GENERADO AUTOMÁTICAMENTE
# Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# ======================================
# CREDENCIALES N8N
# ======================================
N8N_USER=$user
N8N_PASSWORD=$securePassword

# ======================================
# CONFIGURACIÓN DE SERVICIOS
# ======================================
WEBHOOK_URL=http://localhost:5678
GENERIC_TIMEZONE=America/Bogota

# ======================================
# NOTAS DE SEGURIDAD
# ======================================
# - Password generado automáticamente con 256 bits de entropía
# - Nunca compartir este archivo
# - Hacer backup seguro de estas credenciales
"@

# Escribir archivo
$envContent | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "Archivo .env creado exitosamente" -ForegroundColor Green
Write-Host "Ubicación: $envFile" -ForegroundColor Gray
Write-Host ""
Write-Host "Credenciales generadas:" -ForegroundColor Cyan
Write-Host "   Usuario: $user" -ForegroundColor White
Write-Host "   Password: $securePassword" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANTE: Guarde estas credenciales en un lugar seguro" -ForegroundColor Yellow
Write-Host "Ahora puede ejecutar: docker-compose -f docker-compose.n8n.yml up -d" -ForegroundColor Green
