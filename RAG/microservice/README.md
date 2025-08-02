# ChromaDB Microservice

Microservicio FastAPI que proporciona una API REST para interactuar con ChromaDB, una base de datos vectorial.

## Instalacion y Despliegue

### Prerrequisitos
- Docker
- Docker Compose

### Despliegue Rapido

**En Windows (PowerShell):**
```powershell
.\deploy.ps1
```

**En Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Manual:**
```bash
docker-compose up --build -d
```

## Servicios

### ChromaDB
- **Puerto**: 8000
- **URL**: http://localhost:8000
- **Heartbeat**: http://localhost:8000/api/v1/heartbeat

### Microservicio FastAPI
- **Puerto**: 9000
- **URL**: http://localhost:9000
- **Health Check**: http://localhost:9000/health
- **Documentación**: http://localhost:9000/docs

## 🔌 API Endpoints

### `POST /add_fragment`
Agrega un fragmento de documento a una colección.

```json
{
  "collection": "mi_coleccion",
  "document": "Texto del documento...",
  "metadata": {
    "titulo": "Mi documento",
    "categoria": "ejemplo"
  }
}
```

### `POST /query`
Busca documentos similares en una colección.

```json
{
  "collection": "mi_coleccion",
  "query_text": "texto a buscar",
  "n_results": 3
}
```

### `DELETE /delete_collection/{collection_name}`
Elimina una colección completa.

### `GET /health`
Verifica el estado del servicio y la conexión con ChromaDB.

## 🔧 Configuración

Las siguientes variables de entorno pueden configurarse:

- `CHROMA_HOST`: Host de ChromaDB (default: "chroma")
- `CHROMA_PORT`: Puerto de ChromaDB (default: 8000)

## 📁 Estructura del Proyecto

```
.
chroma_service.py    # Código principal del microservicio
requirements.txt     # Dependencias Python
Dockerfile           # Imagen Docker del microservicio
docker-compose.yml   # Orquestación de servicios
deploy.ps1           # Script de despliegue para Windows
deploy.sh            # Script de despliegue para Linux/Mac
README.md            # Este archivo
```

## Desarrollo

### Instalar dependencias localmente
```bash
pip install -r requirements.txt
```

### Ejecutar en desarrollo
```bash
uvicorn chroma_service:app --reload --port 9000
```

## Monitoreo

### Ver logs
```bash
docker-compose logs -f
```

### Ver estado de servicios
```bash
docker-compose ps
```

### Parar servicios
```bash
docker-compose down
```

### Parar y eliminar volumenes
```bash
docker-compose down -v
```

## Seguridad

- ChromaDB esta configurado con autenticacion basica
- El microservicio se ejecuta con un usuario no-root
- Los servicios estan aislados en una red Docker privada

## Troubleshooting

### ChromaDB no se conecta
1. Verificar que el puerto 8000 esta disponible
2. Comprobar logs: `docker-compose logs chroma`

### Microservicio no responde
1. Verificar que el puerto 9000 esta disponible
2. Comprobar logs: `docker-compose logs chroma-service`

### Reiniciar servicios
```bash
docker-compose restart
```
