document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('save');
    const statusDiv = document.getElementById('status');
  
    // Charger la clé API existante
    chrome.storage.sync.get(['apiKey'], function(result) {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
    });
  
    // Fonction pour afficher un message de statut
    function showStatus(message, isError = false) {
      statusDiv.textContent = message;
      statusDiv.className = `status ${isError ? 'error' : ''} show`;
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 3000);
    }
  
    // Sauvegarder la clé API
    saveButton.addEventListener('click', () => {
      const apiKey = apiKeyInput.value.trim();
      
      if (!apiKey) {
        showStatus('La clé API ne peut pas être vide', true);
        return;
      }
  
      chrome.storage.sync.set({ apiKey }, function() {
        showStatus('Paramètres sauvegardés !');
      });
    });
  });