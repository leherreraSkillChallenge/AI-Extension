// Background Script para el Asistente Web Flotante
// ================================================

// URL del webhook de n8n
const N8N_WEBHOOK_URL = 'https://randomly-exciting-termite.ngrok-free.app/webhook/asistente-agent';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    console.log('Solicitud de captura desde:', request.currentUrl);
    
    // ESTRATEGIA DEFINITIVA: Usar la ventana enfocada más reciente
    chrome.windows.getLastFocused({populate: true}, (window) => {
      if (chrome.runtime.lastError || !window) {
        console.log('Error obteniendo ventana:', chrome.runtime.lastError?.message);
        sendResponse({error: 'No se pudo obtener la ventana activa'});
        return;
      }
      
      console.log('Ventana enfocada ID:', window.id);
      
      // Encontrar la pestaña activa en esa ventana
      const activeTab = window.tabs.find(tab => tab.active);
      
      if (!activeTab) {
        console.log('No se encontró pestaña activa en la ventana');
        sendResponse({error: 'No se encontró pestaña activa'});
        return;
      }
      
      console.log('Capturando pestaña:', activeTab.url);
      
      // Capturar directamente sin cambiar pestaña (puede causar parpadeo)
      chrome.tabs.captureVisibleTab(window.id, {format: 'jpeg', quality: 70}, function(dataUrl) {
        if (chrome.runtime.lastError) {
          console.log('Error en captura:', chrome.runtime.lastError.message);
          sendResponse({error: chrome.runtime.lastError.message});
        } else {
          console.log('Captura exitosa de:', activeTab.url);
          sendResponse({image: dataUrl});
        }
      });
    });
    
    // Required for async sendResponse
    return true;
  }
  
  // Manejar peticiones a N8N con soporte de streaming
  if (request.action === 'sendToN8N') {
    handleN8NRequest(request.payload, sendResponse, sender.tab.id);
    return true; // Respuesta asíncrona
  }
  
  // FUNCIÓN DE TEST: Verificar conectividad N8N
  if (request.action === 'testN8N') {
    console.log('🧪 Test N8N: Verificando conectividad...');
    const testUrl = request.url || 'https://591c2a74d2b5.ngrok-free.app/webhook/asistente-agent';
    
    // Test con GET simple
    fetch(testUrl, {
      method: 'GET',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'AsistenteWebIA/1.0'
      }
    })
    .then(response => {
      console.log('🧪 GET Response:', response.status, response.statusText);
      
      sendResponse({
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
    })
    .catch(error => {
      console.error('🧪 Test Error:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
    
    return true;
  }
});

// Manejar la instalación de la extensión
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Asistente Web instalado correctamente');
  } else if (details.reason === 'update') {
    console.log('Asistente Web actualizado');
  }
});

// Manejar el inicio de la extensión
chrome.runtime.onStartup.addListener(() => {
  console.log('Asistente Web iniciado');
});

// Función para manejar peticiones a N8N con soporte de streaming
async function handleN8NRequest(payload, sendResponse) {
  try {
    console.log('Enviando petición a N8N...');
    
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'AsistenteWebIA/1.0',
        'Accept': 'text/event-stream, audio/mpeg, audio/*, */*'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Verificar si es respuesta streaming
    const contentType = response.headers.get('content-type');
    const isStreaming = contentType?.includes('text/event-stream') || 
                       response.headers.get('transfer-encoding') === 'chunked';

    if (isStreaming) {
      console.log('Respuesta streaming detectada en background');
      await handleStreamingInBackground(response, sendResponse);
    } else {
      console.log('Respuesta tradicional detectada en background');
      const arrayBuffer = await response.arrayBuffer();
      sendResponse({
        success: true,
        type: 'complete',
        audio: Array.from(new Uint8Array(arrayBuffer))
      });
    }

  } catch (error) {
    console.error('Error en N8N request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Manejar respuesta streaming en el background
async function handleStreamingInBackground(response, sendResponse) {
  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let audioChunks = [];
    
    // Enviar mensaje de inicio de streaming
    sendResponse({
      success: true,
      type: 'streaming_start'
    });
    
    // Obtener el tab ID para enviar mensajes de streaming
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const tabId = tabs[0]?.id;
    
    if (!tabId) {
      throw new Error('No se pudo obtener tab ID para streaming');
    }
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Procesar líneas completas
      let lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'progress') {
              // Enviar progreso al content script
              chrome.tabs.sendMessage(tabId, {
                type: 'streaming_progress',
                message: data.message
              });
            } else if (data.type === 'audio_chunk') {
              if (data.chunk) {
                audioChunks.push(data.chunk);
              }
            } else if (data.type === 'complete') {
              // Combinar chunks y enviar audio completo
              if (audioChunks.length > 0) {
                const combinedAudio = audioChunks.join('');
                const audioArray = Array.from(
                  Uint8Array.from(atob(combinedAudio), c => c.charCodeAt(0))
                );
                
                chrome.tabs.sendMessage(tabId, {
                  type: 'streaming_complete',
                  audio: audioArray
                });
              }
              return;
            }
          } catch (e) {
            console.log('Error parsing streaming data:', e);
          }
        }
      }
    }
    
    // Si no hay chunks de audio pero tenemos buffer, enviar como completo
    if (audioChunks.length === 0) {
      const arrayBuffer = await response.arrayBuffer();
      const audioArray = Array.from(new Uint8Array(arrayBuffer));
      
      chrome.tabs.sendMessage(tabId, {
        type: 'streaming_complete',
        audio: audioArray
      });
    }
    
  } catch (error) {
    console.error('Error en streaming background:', error);
    
    // Intentar enviar error al content script
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const tabId = tabs[0]?.id;
      
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'streaming_error',
          error: error.message
        });
      }
    } catch (e) {
      console.error('No se pudo enviar error al content script:', e);
    }
  }
}
