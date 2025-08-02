# Script para facilitar la importación de workflows a n8n
# Ejecutar después de que n8n esté configurado

Write-Host "=== IMPORTACIÓN DE WORKFLOWS A N8N ===" -ForegroundColor Green

# Verificar que n8n esté ejecutándose
$n8nStatus = docker ps --filter "name=n8n" --format "{{.Status}}"
if ($n8nStatus -match "Up") {
    Write-Host "✓ n8n está ejecutándose" -ForegroundColor Green
} else {
    Write-Host "✗ n8n no está ejecutándose. Iniciando..." -ForegroundColor Red
    docker-compose -f docker-compose.n8n.yml up -d
    Start-Sleep 10
}

Write-Host "`n=== WORKFLOWS DISPONIBLES ===" -ForegroundColor Yellow
$workflows = Get-ChildItem -Path "workflows\*.json" | Sort-Object Name
foreach ($workflow in $workflows) {
    Write-Host "📄 $($workflow.Name)" -ForegroundColor Cyan
}

Write-Host "`n=== INSTRUCCIONES DE IMPORTACIÓN ===" -ForegroundColor Yellow
Write-Host "1. Abre http://localhost:5678 en tu navegador" -ForegroundColor White
Write-Host "2. Inicia sesión con las credenciales configuradas en variables de entorno" -ForegroundColor White
Write-Host "3. Ve a 'Workflows' en el menú" -ForegroundColor White
Write-Host "4. Haz clic en '+' o 'Import from File'" -ForegroundColor White
Write-Host "5. Selecciona e importa cada archivo JSON en este orden:" -ForegroundColor White

Write-Host "`ORDEN RECOMENDADO:" -ForegroundColor Green
Write-Host "1. asistente-agent-workflow.json (adicional)" -ForegroundColor Cyan

Write-Host "`6. Después de importar, ACTIVA cada workflow:" -ForegroundColor White
Write-Host "- Abre cada workflow" -ForegroundColor White
Write-Host "- Haz clic en el botón 'Active' para activarlo" -ForegroundColor White

Write-Host "`=== ENDPOINTS DESPUÉS DE LA ACTIVACIÓN ===" -ForegroundColor Yellow
Write-Host "Webhook principal: http://localhost:5678/webhook/asistente" -ForegroundColor Green

Write-Host "`n=== VERIFICACIÓN ===" -ForegroundColor Yellow
Write-Host "Después de importar y activar, prueba con:" -ForegroundColor White
Write-Host "curl -X POST http://localhost:5678/webhook/test -H 'Content-Type: application/json' -d '{`"test`": true}'" -ForegroundColor Cyan

# Abrir n8n en el navegador
Write-Host "`nAbriendo n8n en el navegador..." -ForegroundColor Green
Start-Process "http://localhost:5678"

