#Agente IA Inteligente con n8n

##**Arquitectura del Agente**

Este proyecto ha evolucionado de una API simple a un **agente inteligente** que orquesta múltiples servicios de IA usando n8n como motor de workflow.

###**Componentes del Sistema**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chrome Ext    │───▶│   n8n Agent     │───▶│   Servicios IA  │
│   (Frontend)    │    │   (Orquestador) │    │   (Backend)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        │                        ▼                        │
        │              ┌─────────────────┐               │
        │              │ Redis Queue     │               │
        │              │ (Trabajos)      │               │
        │              └─────────────────┘               │
        │                                                │
        └────────────────────────────────────────────────┘
```

### **Servicios Integrados**

| Servicio | Puerto | Función | Estado |
|----------|--------|---------|--------|
| **n8n Agent** | 5678 | Orquestador principal | ✅ |
| **API Backend** | 5000 | Procesamiento IA | ✅ |
| **ChromaDB** | 8000/9000 | RAG + Búsqueda | ✅ |
| **TTS Kokoro** | 5100/8880 | Síntesis de voz | ✅ |
| **Redis** | 6379 | Cola de trabajos | ✅ |

## 🚀 **Despliegue Rápido**

### **1. Iniciar el Agente**
```powershell
cd N8N
.\start-agent.ps1
```

### **2. Configurar Workflows**
1. Abre http://localhost:5678
2. Login: Usar variables de entorno `N8N_USER` y `N8N_PASSWORD` 
   - Por defecto: `admin` / `change_this_password` (CAMBIAR EN PRODUCCIÓN)
3. Importa workflows desde `workflows/`
4. Activa todos los workflows

### **3. Cargar Extensión**
- La extensión ahora se conecta automáticamente al agente

## **Inteligencia del Agente**

### **Procesamiento Contextual**
```javascript
// El agente analiza el contexto y decide:
1. ¿Necesita análisis de imagen? → Gemini Vision
2. ¿Requiere búsqueda RAG? → ChromaDB  
3. ¿Qué modelo IA usar? → Según tipo de consulta
4. ¿Generar audio? → TTS Kokoro
```

### **Workflows Disponibles**

#### **Workflow Principal: "Asistente IA Agent"**
- **Trigger**: Webhook `/webhook/asistente`
- **Flujo**: 
  1. Análisis de imagen (paralelo)
  2. Búsqueda RAG (paralelo)
  3. Procesamiento contextual
  4. Respuesta IA optimizada
  5. Síntesis TTS
  6. Respuesta estructurada

#### **Workflow Monitor: "Monitor Agente IA"**
- **Trigger**: Cada 5 minutos
- **Función**: Health checks de todos los servicios
- **Alertas**: Estado degradado o fallos

## **API del Agente**

### **Endpoint Principal**
```http
POST http://localhost:5678/webhook/asistente
Content-Type: application/json

{
  "userText": "¿Qué veo en la pantalla?",
  "imageData": "base64_image_data",
  "timestamp": "2025-07-21T00:00:00.000Z",
  "startTime": 1642723200000
}
```

### **Respuesta del Agente**
```json
{
  "success": true,
  "timestamp": "2025-07-21T00:00:00.000Z",
  "agent": "Asistente IA v2.0",
  "response": {
    "text": "Veo una página web con...",
    "hasAudio": true,
    "audioSize": 245760
  },
  "metadata": {
    "processingTime": 2340,
    "services": {
      "imageAnalysis": true,
      "ragSearch": true,
      "ttsGenerated": true
    }
  }
}
```

## **Monitoreo y Métricas**

### **Dashboard n8n**
- **URL**: http://localhost:5678
- **Ejecuciones**: Historial completo de workflows
- **Métricas**: Tiempo de respuesta, tasa de éxito
- **Logs**: Debug detallado por nodo

### **Health Checks**
El workflow de monitoreo verifica cada 5 minutos:
- API Backend disponible
- ChromaDB respondiendo  
- TTS funcionando
- Redis activo

## **Configuración Avanzada**

### **Variables de Entorno**
```bash
# En docker-compose.n8n.yml - USAR VARIABLES DE ENTORNO
N8N_USER=${N8N_USER:-admin}
N8N_PASSWORD=${N8N_PASSWORD:-change_this_password}
WEBHOOK_URL=http://localhost:5678
GENERIC_TIMEZONE=America/Bogota
```

**⚠️ SEGURIDAD**: Crear archivo `.env` con credenciales seguras:
```env
N8N_USER=admin
N8N_PASSWORD=tu_password_muy_seguro_aqui
```

### **Escalabilidad**
- **Redis**: Cola de trabajos para múltiples instancias
- **n8n**: Workflows paralelos y asíncronos
- **Docker**: Fácil escalado horizontal

## **Troubleshooting**

### **Problemas Comunes**

**Error de conexión al agente**
```bash
# Verificar que n8n esté corriendo
docker ps | grep n8n-asistente-agent

# Ver logs
docker logs n8n-asistente-agent
```

**Workflows no se activan**
```bash
# Reiniciar n8n
docker restart n8n-asistente-agent

# Re-importar workflows
# Ir a n8n UI → Workflows → Import
```

**Servicios backend no responden**
```bash
# Verificar red Docker
docker network inspect chroma-net

# Restart todos los servicios
.\start-agent.ps1
```

## **Migración desde API Simple**

### **Antes (API Directa)**
```
Extension → API Backend → Servicios → Respuesta
```

### **Ahora (Agente Inteligente)**
```
Extension → n8n Agent → Orquestación Inteligente → Respuesta Optimizada
```

### **Beneficios del Agente**
- **Procesamiento paralelo** (imagen + RAG simultáneos)
- **Decisiones inteligentes** (modelo según contexto)
- **Monitoreo automático** (health checks)
- **Escalabilidad** (Redis + workflows)
- **Métricas detalladas** (tiempo, éxito, errores)
- **Tolerancia a fallos** (continueOnFail)

## **Próximos Pasos**

1. **Entrenar modelos personalizados** para el dominio específico
2. **Agregar más fuentes de datos** (APIs externas, bases de datos)
3. **Implementar aprendizaje** basado en feedback del usuario
4. **Optimizar rendimiento** con cache y predicciones
5. **Dashboards avanzados** con métricas de negocio
