document.addEventListener('DOMContentLoaded', () => {
  const historyList = document.getElementById('historyList');
  const emptyState = document.getElementById('emptyState');
  const clearButton = document.getElementById('clearHistory');

  // Fonction pour formater la date
  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // Fonction pour créer un élément d'historique
  function createHistoryItem(item) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="song-info">
        <div class="song-details">
          <h2>${item.title}</h2>
          <p>${item.artist}</p>
        </div>
        <div class="timestamp">${formatDate(item.timestamp)}</div>
      </div>
      <div class="streaming-links">
        ${item.spotify ? `
          <a href="${item.spotify}" class="streaming-button spotify" target="_blank">
            <img src="icons/spotify.png" alt="Spotify">
            Spotify
          </a>
        ` : ''}
        ${item.appleMusic ? `
          <a href="${item.appleMusic}" class="streaming-button apple" target="_blank">
            <img src="icons/apple.png" alt="Apple Music">
            Apple Music
          </a>
        ` : ''}
        ${item.youtube ? `
          <a href="${item.youtube}" class="streaming-button youtube" target="_blank">
            <img src="icons/youtube.png" alt="YouTube">
            YouTube
          </a>
        ` : ''}
      </div>
    `;
    return div;
  }

  // Charger et afficher l'historique
  function loadHistory() {
    chrome.storage.local.get(['songHistory'], function(result) {
      const history = result.songHistory || [];
      historyList.innerHTML = '';
      
      if (history.length === 0) {
        emptyState.classList.remove('hidden');
        historyList.classList.add('hidden');
      } else {
        emptyState.classList.add('hidden');
        historyList.classList.remove('hidden');
        
        // Trier par date décroissante
        history.sort((a, b) => b.timestamp - a.timestamp)
              .forEach(item => {
                historyList.appendChild(createHistoryItem(item));
              });
      }
    });
  }

  // Gérer le bouton d'effacement
  clearButton.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
      chrome.storage.local.set({ songHistory: [] }, () => {
        loadHistory();
      });
    }
  });

  // Charger l'historique au démarrage
  loadHistory();
});
