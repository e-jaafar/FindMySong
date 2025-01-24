document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('start');
  const resultDiv = document.getElementById('result');
  const statusDiv = document.getElementById('status');

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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'result') {
      resultDiv.innerText = request.data;
      statusDiv.innerText = 'Analyse terminée';
      startButton.disabled = false;
    }
  });
}); 