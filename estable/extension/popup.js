// Popup Script para el Asistente Web Flotante
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Configurar el botón principal de activar/desactivar
  const toggleAssistantBtn = document.getElementById('toggle-assistant-global');
  if (toggleAssistantBtn) {
    toggleAssistantBtn.addEventListener('click', function() {
      toggleGlobalAssistant();
    });
  }

  // Mostrar información del estado actual
  showCurrentStatus();
  
  // Verificar estado del asistente cada segundo
  setInterval(checkAssistantStatus, 1000);
});

function toggleGlobalAssistant() {
  // Verificar primero si estamos en una página válida
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      const url = tabs[0].url;
      const isValidPage = !url.startsWith('chrome://') && 
                         !url.startsWith('chrome-extension://') &&
                         !url.startsWith('edge://') &&
                         !url.startsWith('moz-extension://') &&
                         !url.startsWith('about:') &&
                         !url.startsWith('file://');
      
      if (!isValidPage) {
        // Mostrar mensaje explicativo
        addStatusMessage('⚠️ Navega a cualquier sitio web (como google.com) para usar el asistente', 'warning');
        updateButtonState(false);
        updateStatus('inactive', 'Página no compatible');
        return;
      }

      // Enviar mensaje al content script de la pestaña activa
      chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleAssistant'}, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Error enviando mensaje:', chrome.runtime.lastError);
          // Si no hay content script, puede ser que la página aún no esté lista
          addStatusMessage('⏳ Recarga la página si el widget no aparece', 'warning');
        } else {
          console.log('Comando enviado al widget');
          // Actualizar estado inmediatamente
          setTimeout(checkAssistantStatus, 500);
        }
      });
    }
  });
}

function checkAssistantStatus() {
  // Verificar estado del asistente en la pestaña activa
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
        if (chrome.runtime.lastError) {
          // No hay content script activo
          updateButtonState(false);
          updateStatus('inactive', 'Inactivo');
        } else if (response) {
          updateButtonState(response.active);
          updateStatus(response.state, response.statusText);
        }
      });
    }
  });
}

function updateButtonState(isActive) {
  const toggleBtn = document.getElementById('toggle-assistant-global');
  if (toggleBtn) {
    if (isActive) {
      toggleBtn.textContent = '🔴 Desactivar Asistente';
      toggleBtn.classList.add('active');
    } else {
      toggleBtn.textContent = '🎤 Activar Asistente';
      toggleBtn.classList.remove('active');
    }
  }
}

function updateStatus(state, text) {
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${state}`;
  }
  
  if (statusText) {
    statusText.textContent = text;
  }
}

function showCurrentStatus() {
  // Verificar si hay pestañas activas donde funcione la extensión
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      const url = tabs[0].url;
      const isValidPage = !url.startsWith('chrome://') && 
                         !url.startsWith('chrome-extension://') &&
                         !url.startsWith('edge://') &&
                         !url.startsWith('moz-extension://') &&
                         !url.startsWith('about:') &&
                         !url.startsWith('file://');
      
      if (isValidPage) {
        addStatusMessage('✅ Widget flotante disponible en esta página', 'success');
        // Verificar si el content script ya está cargado
        setTimeout(checkAssistantStatus, 500);
      } else {
        addStatusMessage('⚠️ Al utilizar el asistente, autorizas la captura temporal de la información visual de tu pantalla. Esta acción se realiza con el único fin de proporcionarte asistencia contextual. La información es procesada momentáneamente para mejorar tu experiencia y no se almacena de forma permanente, siendo eliminada al cumplir su propósito.', 'warning');
        updateButtonState(false);
        updateStatus('inactive', 'Página no compatible');
        
        // Agregar botón para ir a una página web
        addQuickAccessButton();
      }
    }
  });
}

function addQuickAccessButton() {
  const content = document.querySelector('.popup-content');
  if (content && !content.querySelector('.quick-access')) {
    const quickAccess = document.createElement('div');
    quickAccess.className = 'quick-access';
    quickAccess.innerHTML = `
      <button id="go-to-google" class="btn-secondary">
        <img src="btn_iniciar.png" alt="Activar" style="width:22px; height:22px; vertical-align:middle; margin-right:6px;"> Activar Asistente
      </button>
    `;
    content.appendChild(quickAccess);
    
    // Agregar evento al botón
    const goToGoogleBtn = document.getElementById('go-to-google');
    if (goToGoogleBtn) {
      goToGoogleBtn.addEventListener('click', function() {
        chrome.tabs.create({url: 'https://www.google.com'});
        window.close(); 
      });
    }
  }
}

function addStatusMessage(message, type) {
  const content = document.querySelector('.popup-content');
  if (content) {
    // Solo remover mensaje anterior si es del mismo tipo o si es un mensaje de warning/error
    const existingMessage = content.querySelector(`.status-message.${type}`);
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${type}`;
    statusDiv.textContent = message;
    content.appendChild(statusDiv);
  }
}
