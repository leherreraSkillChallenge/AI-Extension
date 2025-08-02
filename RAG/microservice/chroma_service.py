from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import chromadb
import traceback
import os
import uuid

app = FastAPI(
    title="ChromaDB Service API",
    description="Microservicio para interactuar con ChromaDB",
    version="1.0.0"
)

# Configuración desde variables de entorno
CHROMA_HOST = os.getenv("CHROMA_HOST", "chroma")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))

client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)

class Fragment(BaseModel):
    collection: str
    document: str
    metadata: dict = {}

class QueryRequest(BaseModel):
    collection: str
    query_text: str
    n_results: int = 3
    where: dict = None

@app.post("/add_fragment")
def add_fragment(fragment: Fragment):
    try:
        print("--- Fragmento recibido ---")
        print("Colección:", fragment.collection)
        print("Documento:", fragment.document)
        print("Metadata:", fragment.metadata)
        collection = client.get_or_create_collection(fragment.collection)
        
        # Generar un ID único usando UUID
        unique_id = str(uuid.uuid4())
        
        collection.add(
            documents=[fragment.document],
            metadatas=[fragment.metadata],
            ids=[unique_id]
        )
        return {"status": "ok"}
    except Exception as e:
        print("--- ERROR ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    try:
        version = client.get_version()
        return {"status": "ok", "version": version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.delete("/delete_collection/{collection_name}")
def delete_collection(collection_name: str):
    try:
        client.delete_collection(collection_name)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query")
def query_collection(request: QueryRequest):
    try:
        collection = client.get_or_create_collection(request.collection)
        
        # Construir parámetros de consulta
        query_params = {
            "query_texts": [request.query_text],
            "n_results": request.n_results,
            "include": ["documents", "metadatas", "distances"]
        }
        
        # Agregar filtro where si existe
        if request.where:
            query_params["where"] = request.where
            
        results = collection.query(**query_params)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))