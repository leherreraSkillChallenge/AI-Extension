import chromadb
import os
from datetime import datetime

# Configuración desde variables de entorno
CHROMA_HOST = os.getenv("CHROMA_HOST", "chroma")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "manuel")#manuel long_term_memory

client = chromadb.HttpClient(host="localhost", port=8000)
collection = client.get_or_create_collection(COLLECTION_NAME)

# Obtener todos los documentos (ajusta n_results si tienes muchos)
results = collection.query(
    query_texts=[" "],
    n_results=1000,
    include=["documents", "metadatas", "distances"]
)

# Fecha de hoy
hoy = datetime.now().date()

# Imprimir todos los metadatos encontrados
print("Metadatos encontrados:")
for metadata in results.get("metadatas", [[]])[0]:
    print(metadata)

# Buscar documentos con metadatos 'index' anterior a hoy (usando index como timestamp UNIX de día) o distance < 1
ids_to_delete = []
distances = results.get("distances", [[None]])[0] if "distances" in results else [None] * len(results.get("metadatas", [[]])[0])
for idx, metadata in enumerate(results.get("metadatas", [[]])[0]):
    index_val = metadata.get("index")
    distance = distances[idx] if idx < len(distances) else None
    print(f"ID: {results['ids'][0][idx]}")
    print(f"Metadata: {metadata}")
    print(f"Distance: {distance}")
    # Criterio: distance < 1
    if distance is not None and distance < 1:
        ids_to_delete.append(results["ids"][0][idx])
    # Criterio adicional: index como fecha
    elif index_val:
        try:
            fecha_doc = datetime.fromtimestamp(int(index_val)).date()
            if fecha_doc < hoy:
                ids_to_delete.append(results["ids"][0][idx])
        except Exception as e:
            print(f"Error convirtiendo index: {index_val} - {e}")
            
if ids_to_delete:
    print(f"Eliminando {len(ids_to_delete)} documentos antiguos...")
    collection.delete(ids=ids_to_delete)
    print("Eliminados.")
else:
    print("No hay documentos antiguos para eliminar.")