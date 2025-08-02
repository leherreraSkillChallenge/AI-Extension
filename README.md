# 🤖 Asistente Web IA

Sistema completo de asistente de inteligencia artificial con múltiples componentes integrados para análisis de imagen, procesamiento de voz y respuestas inteligentes.

## 🚀 Características Principales

- **Extensión de Chrome**: Interfaz flotante para interacción directa
- **Backend .NET**: API REST para procesamiento de IA
- **Sistema RAG**: Recuperación de información contextual
- **Text-to-Speech**: Síntesis de voz avanzada
- **Workflows N8N**: Orquestación automatizada de procesos

## 📁 Estructura del Proyecto

```
AI-Extension/
├── AI Extension/          # Extensión de Chrome
├── Backend/              # API .NET Core
├── Frontend/             # Interfaz web
├── N8N/                  # Workflows de automatización
├── RAG/                  # Sistema de recuperación de información
└── TTS/                  # Servicio de text-to-speech
```

## 🔧 Tecnologías Utilizadas

- **Frontend**: JavaScript, HTML5, CSS3
- **Backend**: .NET Core, C#
- **Base de Datos**: ChromaDB (vectorial)
- **IA**: Ollama, Gemma, OpenRouter
- **Orquestación**: N8N
- **Contenedores**: Docker, Docker Compose

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