document.addEventListener('DOMContentLoaded', () => {
  // Éléments DOM
  const startButton = document.getElementById('start');
  const resultContainer = document.getElementById('result');
  const statusContainer = document.getElementById('status-container');
  const statusText = document.getElementById('status');
  const songTitle = document.getElementById('song-title');
  const songArtist = document.getElementById('song-artist');
  const spotifyLink = document.getElementById('spotify-link');
  const appleLink = document.getElementById('apple-link');
  const settingsLink = document.getElementById('settings');
  const youtubeLink = document.getElementById('youtube-link');
  const recentHistory = document.getElementById('recent-history');
  const recentList = document.getElementById('recent-list');

  // État initial
  let isListening = false;

  const waveContainer = document.querySelector('.wave-container');
  const loader = document.getElementById('loader');

  // Vérification de la clé API
  chrome.storage.sync.get(['apiKey'], function(result) {
    if (!result.apiKey) {
      updateUIState('error');
      startButton.disabled = true;
    } else {
      updateUIState('ready');
    }
  });

  function updateUIState(state) {
    const states = {
      ready: {
        statusText: 'Prêt à écouter',
        buttonText: 'Identifier',
        buttonClass: '',
        showWave: false,
        showLoader: false
      },
      recording: {
        statusText: 'Écoute en cours...',
        buttonText: 'Enregistrement...',
        buttonClass: 'recording',
        showWave: true,
        showLoader: false
      },
      identifying: {
        statusText: 'Patientez...',
        buttonText: 'Identification...',
        buttonClass: 'disabled',
        showWave: false,
        showLoader: true
      },
      success: {
        statusText: 'Musique identifiée !',
        buttonText: 'Identifier',
        buttonClass: '',
        showWave: false,
        showLoader: false
      },
      error: {
        statusText: 'Une erreur est survenue',
        buttonText: 'Réessayer',
        buttonClass: '',
        showWave: false,
        showLoader: false
      }
    };

    const currentState = states[state];
    
    // Mise à jour du statut avec animation
    statusText.style.opacity = '0';
    setTimeout(() => {
      statusText.textContent = currentState.statusText;
      statusText.style.opacity = '1';
    }, 200);

    // Mise à jour du bouton
    startButton.textContent = currentState.buttonText;
    startButton.className = `primary-button ${currentState.buttonClass}`;

    // Gestion des animations
    waveContainer.classList.toggle('hidden', !currentState.showWave);
    loader.classList.toggle('hidden', !currentState.showLoader);
  }

  // Fonction pour créer un élément d'historique récent
  function createRecentItem(item) {
    const div = document.createElement('div');
    div.className = 'recent-item';
    
    // Ajout de l'image de fond si disponible
    if (item.image) {
      div.style.background = `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('${item.image}')`;
      div.style.backgroundSize = 'cover';
      div.style.backgroundPosition = 'center';
      div.style.backgroundRepeat = 'no-repeat';
    }
    
    div.innerHTML = `
      <div class="recent-item-title">${item.title}</div>
      <div class="recent-item-artist">${item.artist}</div>
      <div class="recent-item-links">
        ${item.spotify ? `
          <a href="${item.spotify}" class="streaming-button spotify" target="_blank">
            <img src="icons/spotify.png" alt="Spotify">
          </a>
        ` : ''}
        ${item.appleMusic ? `
          <a href="${item.appleMusic}" class="streaming-button apple" target="_blank">
            <img src="icons/apple.png" alt="Apple Music">
          </a>
        ` : ''}
        ${item.youtube ? `
          <a href="${item.youtube}" class="streaming-button youtube" target="_blank">
            <img src="icons/youtube.png" alt="YouTube">
          </a>
        ` : ''}
      </div>
    `;
    return div;
  }

  // Fonction pour charger l'historique récent
  function loadRecentHistory() {
    chrome.storage.local.get(['songHistory'], function(result) {
      const history = result.songHistory || [];
      
      if (history.length > 0) {
        recentHistory.classList.remove('hidden');
        recentList.innerHTML = '';
        
        // Prendre les 3 derniers éléments
        history.slice(0, 3).forEach(item => {
          recentList.appendChild(createRecentItem(item));
        });
      } else {
        recentHistory.classList.add('hidden');
      }
    });
  }

  // Charger l'historique récent au démarrage
  loadRecentHistory();
  

  // Fonction pour afficher le résultat
  function displayResult(result) {
    songTitle.textContent = result.title;
    songArtist.textContent = result.artist;

    // Ajout de l'image en background
    if (result.image) {
      console.log('Image URL:', result.image); // Pour déboguer
      const resultContainer = document.querySelector('.result-container');
      resultContainer.style.background = `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('${result.image}')`;
      resultContainer.style.backgroundSize = 'cover';
      resultContainer.style.backgroundPosition = 'center';
      resultContainer.style.backgroundRepeat = 'no-repeat';
    }

    // Mise à jour des liens
    if (result.spotify) {
      spotifyLink.href = result.spotify;
      spotifyLink.classList.remove('hidden');
    } else {
      spotifyLink.classList.add('hidden');
    }

    if (result.appleMusic) {
      appleLink.href = result.appleMusic;
      appleLink.classList.remove('hidden');
    } else {
      appleLink.classList.add('hidden');
    }

    if (result.youtube) {
      youtubeLink.href = result.youtube;
      youtubeLink.classList.remove('hidden');
    } else {
      youtubeLink.classList.add('hidden');
    }

    resultContainer.classList.remove('hidden');

    // Sauvegarder dans l'historique avec l'image
    chrome.storage.local.get(['songHistory'], function(data) {
      const history = data.songHistory || [];
      const newEntry = {
        title: result.title,
        artist: result.artist,
        spotify: result.spotify,
        appleMusic: result.appleMusic,
        youtube: result.youtube,
        image: result.image,
        timestamp: Date.now()
      };

      history.unshift(newEntry);
      if (history.length > 100) {
        history.pop();
      }

      chrome.storage.local.set({ songHistory: history }, () => {
        loadRecentHistory();
      });
    });

    // Animation d'apparition
    resultContainer.style.opacity = '0';
    setTimeout(() => {
      resultContainer.style.opacity = '1';
    }, 100);
  }

  // Modification du gestionnaire de clic
  startButton.addEventListener('click', async () => {
    if (isListening) return;
    
    isListening = true;
    updateUIState('recording');
    resultContainer.classList.add('hidden');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.runtime.sendMessage({ 
        action: 'startCapture', 
        tabId: tab.id 
      });
    } catch (error) {
      updateUIState('error');
      isListening = false;
    }
  });

  // Modification du gestionnaire de messages
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'statusUpdate') {
      updateUIState('identifying');
    }
    else if (request.action === 'identificationResult') {
      updateUIState('success');
      
      // Animation du conteneur de résultat
      resultContainer.style.display = 'block';
      setTimeout(() => {
        resultContainer.classList.add('visible');
      }, 10);

      displayResult(request);
      isListening = false;
    }
    else if (request.action === 'error') {
      updateUIState('error');
      isListening = false;
    }
  });

  // Gestionnaire du lien des paramètres
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Ouvrir une nouvelle page pour les paramètres
    chrome.runtime.openOptionsPage();
  });

  // Ajout du gestionnaire pour le bouton historique
  document.getElementById('history').addEventListener('click', () => {
    chrome.tabs.create({ url: 'history.html' });
  });

  // Animation de démarrage
  document.body.style.opacity = '0';
  setTimeout(() => {
    document.body.style.opacity = '1';
  }, 100);
}); 