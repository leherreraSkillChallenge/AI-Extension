/*
 * ================================================================
 * Asistente Web Flotante - Background Script
 * ================================================================
 * 
 * Descripción: Script de fondo para gestionar la extensión del 
 *              asistente web flotante. Maneja la
 *              comunicación con webhooks y captura de pestañas.
 * 
 * Autores: Equipo de Desarrollo
 * Fecha de creación: 01/08/2025
 * Última modificación: 02/08/2025
 * Versión: 1.0.0
 * 
 * Copyright (c) 2025 Indra Colombia.
 * Todos los derechos reservados.
 * ================================================================
 */

// URL del webhook de n8n
const N8N_WEBHOOK_URL = 'https://randomly-exciting-termite.ngrok-free.app/webhook/asistente-agent';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    // console.log('Solicitud de captura desde:', request.currentUrl);
    
    // ESTRATEGIA DEFINITIVA: Usar la ventana enfocada más reciente
    chrome.windows.getLastFocused({populate: true}, (window) => {
      if (chrome.runtime.lastError || !window) {
        // console.log('Error obteniendo ventana:', chrome.runtime.lastError?.message);
        sendResponse({error: 'No se pudo obtener la ventana activa'});
        return;
      }
      
      // console.log('Ventana enfocada ID:', window.id);
      
      // Encontrar la pestaña activa en esa ventana
      const activeTab = window.tabs.find(tab => tab.active);
      
      if (!activeTab) {
        // console.log('No se encontró pestaña activa en la ventana');
        sendResponse({error: 'No se encontró pestaña activa'});
        return;
      }
      
      // console.log('Capturando pestaña:', activeTab.url);
      
      // Capturar directamente sin cambiar pestaña (puede causar parpadeo)
      chrome.tabs.captureVisibleTab(window.id, {format: 'jpeg', quality: 70}, function(dataUrl) {
        if (chrome.runtime.lastError) {
          // console.log('Error en captura:', chrome.runtime.lastError.message);
          sendResponse({error: chrome.runtime.lastError.message});
        } else {
          // console.log('Captura exitosa de:', activeTab.url);
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
    const testUrl = request.url || 'https://randomly-exciting-termite.ngrok-free.app/webhook/asistente-agent';
    
    // Test con GET simple
    fetch(testUrl, {
      method: 'GET',
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'AsistenteWebIA/1.0'
      }
    })
    .then(response => {
      
      
      sendResponse({
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
    })
    .catch(error => {
      
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
    // console.log('Asistente Web instalado correctamente');
    
    // Inicializar configuración de ElevenLabs en storage
    initializeElevenLabsConfig();
  } else if (details.reason === 'update') {
    // console.log('Asistente Web actualizado');
    
    // Verificar/actualizar configuración
    initializeElevenLabsConfig();
  }
});

// Inicializar configuración de ElevenLabs
async function initializeElevenLabsConfig() {
  try {
    const result = await chrome.storage.sync.get(['elevenlabs_config']);
    
    if (!result.elevenlabs_config) {
      // Configuración por defecto
      const defaultConfig = {
        api_key: "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
        voice_id: "21m00Tcm4TlvDq8ikWAM",
        model_id: "eleven_multilingual_v2"
      };
      
      await chrome.storage.sync.set({ elevenlabs_config: defaultConfig });
      // console.log('Configuración ElevenLabs inicializada:', defaultConfig);
    } else {
      // console.log('Configuración ElevenLabs existente cargada');
    }
  } catch (error) {
    // console.error('Error inicializando configuración ElevenLabs:', error);
  }
}

// Manejar el inicio de la extensión
chrome.runtime.onStartup.addListener(() => {
  // console.log('Asistente Web iniciado');
});

// Función para manejar peticiones a N8N con soporte de streaming
async function handleN8NRequest(payload, sendResponse) {
  try {
    // console.log('Enviando petición a N8N...');
    
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'AsistenteWebIA/1.0',
        'Accept': 'text/plain, application/json, */*'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Mostrar información detallada de la respuesta
    // console.log('=== RESPUESTA N8N DETALLADA ===');
    // console.log('Status:', response.status);
    // console.log('StatusText:', response.statusText);
    // console.log('Headers:', Object.fromEntries(response.headers.entries()));
    // console.log('Content-Type:', response.headers.get('content-type'));
    // console.log('Content-Length:', response.headers.get('content-length'));
    // console.log('Transfer-Encoding:', response.headers.get('transfer-encoding'));

    // N8N siempre devuelve texto para enviar a ElevenLabs WebSocket
    const textResponse = await response.text();
    // console.log('=== TEXTO CRUDO DE N8N ===');
    // console.log('Tipo:', typeof textResponse);
    // console.log('Longitud:', textResponse.length);
    // console.log('Contenido completo:', textResponse);
    // console.log('Primeros 200 caracteres:', textResponse.substring(0, 200));
    // console.log('Últimos 200 caracteres:', textResponse.substring(Math.max(0, textResponse.length - 200)));
    
    // Mostrar bytes en hexadecimal para debug de encoding
    const textBytes = new TextEncoder().encode(textResponse);
    // console.log('Bytes UTF-8 (hex):', Array.from(textBytes.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    // console.log('Total bytes UTF-8:', textBytes.length);
    
    // Formatear texto para UTF-8 correctamente
    const cleanText = formatTextForWebSocket(textResponse);
    // console.log('=== TEXTO FORMATEADO ===');
    // console.log('Texto limpio:', cleanText);
    // console.log('Longitud limpia:', cleanText.length);
    
    const cleanBytes = new TextEncoder().encode(cleanText);
    // console.log('Bytes limpios (hex):', Array.from(cleanBytes.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    // console.log('Total bytes limpios:', cleanBytes.length);
    
    // Enviar respuesta inmediata para mantener el canal abierto
    sendResponse({
      success: true,
      type: 'streaming_start'
    });
    
    // Luego manejar el WebSocket de forma independiente
    handleTextToSpeechWebSocketAsync(cleanText);

  } catch (error) {
    // console.error('Error en N8N request:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// Función para formatear texto correctamente para UTF-8 y WebSocket
function formatTextForWebSocket(rawText) {
  try {
    // console.log('=== INICIANDO FORMATEO DE TEXTO ===');
    // console.log('Texto raw recibido:', typeof rawText, rawText.length, 'caracteres');
    
    // Limpiar y normalizar el texto
    let cleanText = rawText;
    
    // Si viene como JSON, extraer el texto
    try {
      const jsonData = JSON.parse(rawText);
      // console.log('Texto detectado como JSON:', jsonData);
      
      // PRIORIZAR campos de contenido real (SIN filtrar agresivamente)
      if (jsonData.text && typeof jsonData.text === 'string' && jsonData.text.trim().length > 0) {
        cleanText = jsonData.text;
        // console.log('Extraído campo "text":', cleanText);
      } else if (jsonData.message && typeof jsonData.message === 'string' && jsonData.message.trim().length > 0) {
        cleanText = jsonData.message;
        // console.log('Extraído campo "message":', cleanText);
      } else if (jsonData.response && typeof jsonData.response === 'string' && jsonData.response.trim().length > 0) {
        cleanText = jsonData.response;
        // console.log('Extraído campo "response":', cleanText);
      } else if (jsonData.content && typeof jsonData.content === 'string' && jsonData.content.trim().length > 0) {
        cleanText = jsonData.content;
        // console.log('Extraído campo "content":', cleanText);
      } else if (jsonData.answer && typeof jsonData.answer === 'string' && jsonData.answer.trim().length > 0) {
        cleanText = jsonData.answer;
        // console.log('Extraído campo "answer":', cleanText);
      } else if (typeof jsonData === 'string') {
        cleanText = jsonData;
        // console.log('JSON es string directo:', cleanText);
      } else {
        // SOLO filtrar campos claramente de metadata técnica
        // console.log('JSON sin campos de contenido reconocidos, analizando...');
        
        // Crear objeto limpio SOLO eliminando metadata técnica obvia
        const cleanJson = { ...jsonData };
        
        // SOLO eliminar campos que son claramente metadata técnica
        if (cleanJson.debug) delete cleanJson.debug;
        if (cleanJson.timestamp) delete cleanJson.timestamp;
        if (cleanJson.status && typeof cleanJson.status === 'number') delete cleanJson.status;
        if (cleanJson.metadata && typeof cleanJson.metadata === 'object') delete cleanJson.metadata;
        
        // console.log('JSON después de filtro conservador:', cleanJson);
        
        // Si después del filtro solo queda un campo con contenido útil, usarlo
        const remainingKeys = Object.keys(cleanJson);
        if (remainingKeys.length === 1) {
          const singleValue = cleanJson[remainingKeys[0]];
          if (typeof singleValue === 'string' && singleValue.trim().length > 5) {
            cleanText = singleValue;
            // console.log('Usando único campo restante:', remainingKeys[0], '=', cleanText);
          } else {
            cleanText = JSON.stringify(cleanJson);
            // console.log('Campo único no es string útil, usando JSON:', cleanText);
          }
        } else {
          // Buscar el campo más largo que parezca contenido real
          let longestField = '';
          let longestKey = '';
          
          for (const [key, value] of Object.entries(cleanJson)) {
            if (typeof value === 'string' && value.trim().length > longestField.length) {
              longestField = value.trim();
              longestKey = key;
            }
          }
          
          if (longestField.length > 10) {
            cleanText = longestField;
            // console.log('Usando campo más largo:', longestKey, '=', cleanText);
          } else {
            cleanText = JSON.stringify(cleanJson);
            // console.log('No hay campos largos, usando JSON completo:', cleanText);
          }
        }
      }
    } catch (e) {
      // console.log('No es JSON válido, usando como texto plano');
      cleanText = rawText;
    }
    
    // Asegurar que sea string
    cleanText = String(cleanText).trim();
    // console.log('Después de conversión a string:', cleanText.length, 'caracteres');
    
    // Limpiar caracteres problemáticos de forma CONSERVADORA
    const originalLength = cleanText.length;
    cleanText = cleanText
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Eliminar solo caracteres de control
      .replace(/\r\n/g, '\n') // Normalizar saltos de línea
      .replace(/\r/g, '\n')   // Convertir \r a \n
      .replace(/\n{4,}/g, '\n\n\n') // Máximo 3 saltos consecutivos (menos agresivo)
      // ELIMINADO: filtros agresivos que pueden eliminar contenido válido
      .trim();
    
    // console.log('Después de limpieza CONSERVADORA:', cleanText.length, 'caracteres (era', originalLength, ')');
    
    // ELIMINADO: verificación de metadata que era muy agresiva
    // Solo verificar si el texto es obviamente demasiado corto
    if (cleanText.length < 3) {
      // console.warn('Texto muy corto después del formateo, usando fallback');
      cleanText = 'Lo siento, no pude procesar esa información correctamente.';
    }
    
    // Verificar longitud máxima (ElevenLabs tiene límites)
    if (cleanText.length > 5000) {
      // console.warn('Texto muy largo, truncando a 5000 caracteres desde:', cleanText.length);
      cleanText = cleanText.substring(0, 4950) + '...';
    }
    
    // Verificar que no esté vacío
    if (!cleanText || cleanText.length === 0) {
      throw new Error('Texto vacío después del formateo');
    }
    
    // Asegurar codificación UTF-8 correcta
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const encoded = encoder.encode(cleanText);
    const decoded = decoder.decode(encoded);
    
    // console.log('=== RESULTADO FINAL DEL FORMATEO ===');
    // console.log('Texto original length:', rawText.length);
    // console.log('Texto limpio length:', cleanText.length);
    // console.log('Texto UTF-8 length:', decoded.length);
    // console.log('Bytes encoded:', encoded.length);
    // console.log('=== TEXTO FINAL QUE SE ENVIARÁ A ELEVENLABS ===');
    // console.log('"""' + decoded + '"""');
    // console.log('Primeros 200 chars:', decoded.substring(0, 200));
    // console.log('Últimos 200 chars:', decoded.length > 200 ? decoded.substring(decoded.length - 200) : 'N/A');
    
    return decoded;
    
  } catch (error) {
    // console.error('Error formateando texto:', error);
    // Fallback: devolver texto básico limpio
    return String(rawText || '').replace(/[^\w\s\.,\!\?\-\:]/g, '').trim() || 'Error al procesar texto';
  }
}

// Nueva función para manejar texto a voz via WebSocket de ElevenLabs (MEJORADA)
async function handleTextToSpeechWebSocketAsync(text) {
  try {
    // console.log('Enviando texto a ElevenLabs WebSocket:', text);
    // console.log('Longitud del texto:', text.length);
    
    // Función para limpiar texto (importada del test-form.html exitoso)
    function cleanTextForTTS(text) {
      if (!text) return '';
      
      return text
        // Remover contenido entre corchetes y paréntesis
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        // Remover markdown
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        // Remover URLs
        .replace(/https?:\/\/[^\s]+/g, '')
        // Remover saltos de línea múltiples
        .replace(/\n+/g, ' ')
        // Remover espacios múltiples
        .replace(/\s+/g, ' ')
        // Limpiar espacios al inicio y final
        .trim();
    }
    
    // Limpiar el texto
    const cleanedText = cleanTextForTTS(text);
    // console.log('Texto original:', text);
    // console.log('Texto limpio:', cleanedText);
    
    // Validar texto después de limpiar
    if (!cleanedText || cleanedText.trim().length === 0) {
      throw new Error('Texto vacío para convertir a audio después de limpiar');
    }
    
    // Obtener configuración desde chrome.storage
    const result = await chrome.storage.sync.get(['elevenlabs_config']);
    const config = result.elevenlabs_config;
    
    if (!config || !config.api_key || !config.voice_id) {
      throw new Error('Configuración de ElevenLabs no encontrada. Reinstale la extensión.');
    }
    
    const ELEVENLABS_API_KEY = config.api_key;
    const VOICE_ID = config.voice_id;
    const MODEL_ID = config.model_id || "eleven_multilingual_v2";
    
    // console.log('Configuración ElevenLabs cargada desde storage');
    
    // Obtener tab ID para envío de progreso
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const tabId = tabs[0]?.id;
    
    if (!tabId) {
      throw new Error('No se pudo obtener tab ID para WebSocket');
    }
    
    chrome.tabs.sendMessage(tabId, {
      type: 'streaming_progress',
      message: 'Conectando a ElevenLabs...'
    });
    
    // Crear WebSocket con URL mejorada (del test-form.html exitoso)
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input?model_id=${MODEL_ID}`;
    // console.log('Conectando a WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      
      ws.onopen = function() {
        // console.log("WebSocket ElevenLabs conectado exitosamente");
        
        chrome.tabs.sendMessage(tabId, {
          type: 'streaming_progress',
          message: 'Generando audio...'
        });
        
        // Enviar mensaje BOS (Beginning of Stream) - FORMATO CORRECTO del test-form.html
        const bosMessage = {
          text: " ", // Espacio en blanco para inicializar
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          },
          xi_api_key: ELEVENLABS_API_KEY
        };
        
        // console.log('Enviando mensaje BOS:', bosMessage);
        ws.send(JSON.stringify(bosMessage));
        
        // Enviar el texto real después de un delay corto
        setTimeout(() => {
          const textMessage = {
            text: cleanedText + " ", // Agregar espacio al final
            try_trigger_generation: true
          };
          
          // console.log('Enviando texto limpio al WebSocket:', textMessage);
          ws.send(JSON.stringify(textMessage));
          
          // Enviar EOS (End of Stream) para finalizar
          setTimeout(() => {
            const eosMessage = {
              text: ""
            };
            // console.log('Enviando EOS (End of Stream)');
            ws.send(JSON.stringify(eosMessage));
          }, 100);
          
        }, 100); // Delay corto después del BOS
      };

      ws.onmessage = async function(event) {
        try {
          // console.log('Mensaje recibido del WebSocket');
          
          // Manejar Blob (método exitoso del test-form.html)
          if (event.data instanceof Blob) {
            // console.log('Chunk de audio recibido (Blob), tamaño:', event.data.size);
            const audioData = await event.data.arrayBuffer();
            // console.log('Convirtiendo a ArrayBuffer, tamaño:', audioData.byteLength);
            
            // Enviar audio chunk al content script
            chrome.tabs.sendMessage(tabId, {
              type: 'audio_chunk',
              chunk: Array.from(new Uint8Array(audioData))
            });
            
          } else if (typeof event.data === 'string') {
            try {
              const response = JSON.parse(event.data);
              // console.log('Respuesta del servidor:', response);
              
              // Manejar audio en base64
              if (response.audio) {
                // console.log('Audio en base64 recibido, longitud:', response.audio.length);
                const binaryString = atob(response.audio);
                const audioData = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  audioData[i] = binaryString.charCodeAt(i);
                }
                
                // console.log('Enviando chunk de audio base64, tamaño:', audioData.length);
                chrome.tabs.sendMessage(tabId, {
                  type: 'audio_chunk',
                  chunk: Array.from(audioData)
                });
              } else if (response.error) {
                // console.error('Error del WebSocket:', response.error);
                chrome.tabs.sendMessage(tabId, {
                  type: 'streaming_error',
                  error: response.error
                });
              } else {
                // console.log('Respuesta del servidor sin audio ni error:', response);
              }
            } catch (parseError) {
              // console.log('Mensaje de texto no JSON recibido:', event.data.substring(0, 100));
            }
          }
        } catch (error) {
          // console.error('Error procesando mensaje WebSocket:', error);
          chrome.tabs.sendMessage(tabId, {
            type: 'streaming_error',
            error: 'Error procesando respuesta: ' + error.message
          });
        }
      };

      ws.onclose = function(event) {
        // console.log('WebSocket cerrado:', event.code, event.reason);
        
        // Notificar que el streaming terminó COMPLETAMENTE
        // No enviamos audio final aquí porque los chunks ya se acumularon en content script
        chrome.tabs.sendMessage(tabId, {
          type: 'streaming_complete'
        });
        
        resolve();
      };

      ws.onerror = function(error) {
        // console.error('Error en WebSocket:', error);
        chrome.tabs.sendMessage(tabId, {
          type: 'streaming_error',
          error: 'Error en conexión WebSocket: ' + error.message
        });
        reject(error);
      };

      // Timeout de seguridad
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.close();
          reject(new Error('Timeout en generación de audio'));
        }
      }, 30000); // 30 segundos timeout
      
    });

  } catch (error) {
    // console.error('Error en handleTextToSpeechWebSocketAsync:', error);
    
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
      // console.error('No se pudo enviar error al content script:', e);
    }
    throw error;
  }
}

// Función original mantenida para compatibilidad (DEPRECATED)
async function handleTextToSpeechWebSocket(text, sendResponse) {
  // console.warn('handleTextToSpeechWebSocket está deprecada, usar handleTextToSpeechWebSocketAsync');
  
  // Enviar respuesta inmediata
  sendResponse({
    success: true,
    type: 'streaming_start'
  });
  
  // Delegar a la nueva función
  return handleTextToSpeechWebSocketAsync(text);
}
