document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('start');
  const resultDiv = document.getElementById('result');
  const statusDiv = document.getElementById('status');

  chrome.storage.sync.get(['apiKey'], function(result) {
    if (!result.apiKey) {
      statusDiv.innerText = 'Clé API manquante !';
    }
    document.getElementById('start').disabled = !result.apiKey;
  });

  startButton.addEventListener('click', async () => {
    statusDiv.innerText = 'Analyse en cours...';
    startButton.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.runtime.sendMessage({ 
        action: 'startCapture', 
        tabId: tab.id 
      });
    } catch (error) {
      resultDiv.textContent = `Erreur: ${error.message}`;
      startButton.disabled = false;
    }
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'identificationResult') {
      resultDiv.innerHTML = `
        <strong>${request.artist}</strong> - ${request.title}<br>
        <a href="${request.link}" target="_blank">Écouter sur ${request.link?.includes('apple') ? 'Apple Music' : 'Spotify'}</a>
      `;
      statusDiv.innerText = 'Analyse terminée';
      startButton.disabled = false;
    } else if (request.action === 'error') {
      resultDiv.textContent = `Erreur : ${request.message}`;
      statusDiv.innerText = 'Échec de l\'analyse';
      startButton.disabled = false;
    } else if (request.action === 'statusUpdate') {
      statusDiv.innerText = request.message;
      if (request.message.includes('terminé') || request.message.includes('échec')) {
        startButton.disabled = false;
      }
    }
  });

  document.getElementById('saveKey').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.sync.set({ apiKey }, () => {
      statusDiv.innerText = 'Clé API sauvegardée';
      startButton.disabled = !apiKey;
    });
  });

  chrome.storage.sync.get(['apiKey'], function(result) {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });
}); 