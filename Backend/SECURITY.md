# 🔐 Guía de Seguridad - Asistente Web

## ✅ Estado Actual de Seguridad

### Información Personal ✅ SANEADA
- **Estado**: Completamente removida
- **Archivos afectados**: Todos los archivos de extensión
- **Acción**: Emails y nombres reemplazados por placeholders

### API Keys ✅ SANEADAS  
- **Estado**: Completamente removidas
- **Archivos afectados**: `appsettings.secrets.json`, workflows N8N, extensión
- **Acción**: Claves reemplazadas por placeholders (`sk_REPLACE_WITH_YOUR_KEY`)

### Credenciales N8N ✅ SECURIZADAS
- **Estado**: Migradas a variables de entorno
- **Archivos afectados**: `docker-compose.n8n.yml`, scripts, documentación
- **Acción**: Uso de variables de entorno `${N8N_USER}` y `${N8N_PASSWORD}`

## ⚠️ Riesgos Pendientes

### 1. URLs ngrok (ALTO RIESGO)
- **Ubicación**: `extension/background.js`, `extension/content.js`, `manifest.json`
- **Problema**: URLs hardcodeadas exponen túneles temporales
- **Solución recomendada**: Migrar a configuración por variables de entorno

### 2. Cadenas de Conexión (MEDIO RIESGO)
- **Ubicación**: `backend/appsettings.json`, workflows N8N
- **Problema**: URLs de servicios internos expuestas
- **Solución recomendada**: Migrar a variables de entorno

## 🛠️ Configuración Segura

### N8N - Variables de Entorno
```bash
# 1. Ejecutar script de configuración
cd N8N
.\setup-env.ps1

# 2. Iniciar N8N con variables seguras
docker-compose -f docker-compose.n8n.yml up -d
```

### Extensión Web - Configuración
```javascript
// Usar variables de entorno o configuración externa
const API_URL = process.env.API_URL || 'http://localhost:5000';
const NGROK_URL = process.env.NGROK_URL || 'configurar_url_ngrok';
```

## 📋 Checklist de Seguridad

### ✅ Completado
- [x] Remover información personal (emails, nombres)
- [x] Remover API keys reales
- [x] Securizar credenciales N8N
- [x] Crear archivo .gitignore
- [x] Crear plantilla .env.example
- [x] Script automático de configuración

### ⏳ Pendiente
- [ ] Remover URLs ngrok hardcodeadas
- [ ] Migrar cadenas de conexión a variables de entorno
- [ ] Configurar secrets de GitHub/CI
- [ ] Implementar rotación de credenciales
- [ ] Auditoria de seguridad completa

## 🔄 Proceso de Deployment Seguro

### 1. Desarrollo Local
```powershell
# Configurar variables de entorno
cd N8N
.\setup-env.ps1

# Verificar que no hay secretos en código
git status
git diff
```

### 2. Antes del Commit
```powershell
# Verificar archivos sensibles
git ls-files | Select-String -Pattern "secret|key|password|token"

# Verificar contenido sensible
git grep -i "sk_|AIza|ngrok"
```

### 3. Producción
- Usar secrets de Docker/Kubernetes
- Variables de entorno del sistema
- Vault o servicio de secrets management

## 🚨 En Caso de Exposición

### Si se expone una API key:
1. **Revocar inmediatamente** la clave comprometida
2. **Generar nueva clave** en el servicio correspondiente
3. **Actualizar configuración** con la nueva clave
4. **Verificar logs** para detectar uso no autorizado

### Si se expone información personal:
1. **Notificar** a las personas afectadas
2. **Documentar** el incidente
3. **Revisar** todos los repositorios y backups
4. **Implementar** controles adicionales

## 📞 Contactos de Emergencia

- **Administrador de Sistemas**: [Configurar]
- **Responsable de Seguridad**: [Configurar]
- **Equipo de Desarrollo**: [Configurar]

---
**Última actualización**: $(Get-Date -Format "yyyy-MM-dd")  
**Próxima revisión**: [Programar revisión mensual]
