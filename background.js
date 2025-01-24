let audioContext = null;
let mediaRecorder = null;
let audioChunks = [];
const SAMPLE_INTERVAL = 100; // ms
let isAnalyzing = false;
let activeTabId = null;
let recordingTimer = null;
let keepAlive = null;
let currentStream = null;

async function initializeTabCapture() {
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (!chrome.tabCapture) {
    throw new Error('API tabCapture non disponible - Vérifiez les permissions');
  }

  // Vérification détaillée de l'API
  const methods = Object.keys(chrome.tabCapture);
  console.log('État détaillé de tabCapture:', {
    apiExists: !!chrome.tabCapture,
    methods: methods,
    getMediaStreamId: typeof chrome.tabCapture.getMediaStreamId,
    chromeVersion: /Chrome\/([0-9.]+)/.exec(navigator.userAgent)?.[1]
  });
}

async function searchYouTube(artist, title) {
  const query = encodeURIComponent(`${artist} - ${title} official music video`);
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&key=YOUR_YOUTUBE_API_KEY`);
  const data = await response.json();
  
  if (data.items && data.items.length > 0) {
    return `https://www.youtube.com/watch?v=${data.items[0].id.videoId}`;
  }
  return null;
}

function getYouTubeSearchUrl(artist, title) {
  const query = encodeURIComponent(`${artist} - ${title} official music video`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

// Modification de la fonction sendToAudD
async function sendToAudD(base64Data) {
  console.log('Préparation des données pour AudD...');
  
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);
  if (!apiKey) {
    throw new Error('Clé API manquante');
  }

  const formData = new FormData();
  formData.append('api_token', apiKey);
  
  // Conversion du base64 en Blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const audioBlob = new Blob([byteArray], { type: 'audio/webm;codecs=opus' });
  
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('return', 'apple_music,spotify');

  try {
    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();
    console.log('Réponse API complète:', data);

    if (data.status === 'error') {
      throw new Error(data.error.error_message || 'Erreur API inconnue');
    }

    if (!data.result) {
      throw new Error('Musique non reconnue');
    }

    // Création du lien de recherche YouTube
    const youtubeLink = getYouTubeSearchUrl(data.result.artist, data.result.title);

    return {
      artist: data.result.artist,
      title: data.result.title,
      spotify: data.result.spotify?.external_urls?.spotify || null,
      appleMusic: data.result.apple_music?.url || null,
      youtube: youtubeLink
    };
  } catch (error) {
    console.error('Erreur détaillée:', error);
    throw error;
  }
}

// Modification du gestionnaire de messages pour traiter l'audio
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    console.log('Démarrage de la capture...');
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      message: 'Initialisation de la capture...'
    });

    initializeTabCapture()
      .then(() => {
        console.log('TabCapture initialisé');
        return new Promise((resolve, reject) => {
          console.log('Injection du content script...');
          chrome.scripting.executeScript({
            target: { tabId: request.tabId },
            files: ['content.js']
          })
          .then(() => {
            console.log('Content script injecté');
            const options = {
              targetTabId: request.tabId,
              consumerTabId: request.tabId
            };
            
            console.log('Demande de streamId...');
            chrome.tabCapture.getMediaStreamId(options, (streamId) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              
              if (!streamId) {
                reject(new Error('ID du flux audio non disponible'));
                return;
              }

              console.log('StreamId obtenu, démarrage enregistrement...');
              chrome.tabs.sendMessage(request.tabId, {
                action: 'startRecording',
                streamId: streamId
              }, (response) => {
                console.log('Réponse du content script:', response);
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                if (response?.error) {
                  reject(new Error(response.error));
                  return;
                }
                chrome.runtime.sendMessage({
                  action: 'statusUpdate',
                  message: 'Enregistrement en cours...'
                });
                resolve();
              });
            });
          })
          .catch(error => {
            reject(new Error(`Erreur d'injection du script: ${error.message}`));
          });
        });
      })
      .catch(error => {
        console.error('Erreur de capture:', error);
        chrome.runtime.sendMessage({
          action: 'error',
          message: `Erreur: ${error.message}`
        });
      });
    return true;
  } else if (request.action === 'stopCapture') {
    stopAnalysis();
  }

  // Gestion des données audio
  if (request.action === 'audioData') {
    console.log('Données audio reçues en base64');
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      message: 'Analyse de l\'audio...'
    });

    try {
      // Les données sont déjà en base64, on peut les utiliser directement
      sendToAudD(request.data)
        .then(result => {
          console.log('Résultat obtenu:', result);
          chrome.runtime.sendMessage({
            action: 'identificationResult',
            ...result
          });
        })
        .catch(error => {
          console.error('Erreur identification:', error);
          chrome.runtime.sendMessage({
            action: 'error',
            message: error.message
          });
        });
    } catch (error) {
      console.error('Erreur de traitement audio:', error);
      chrome.runtime.sendMessage({
        action: 'error',
        message: 'Erreur de traitement audio'
      });
    }
    return true;
  }
  return true;
});

function startAnalysis() {
  if (isAnalyzing) return;
  isAnalyzing = true;
  analyzeAudio();
}

function stopAnalysis() {
  isAnalyzing = false;
  activeTabId = null;
  clearTimeout(recordingTimer);
  clearInterval(keepAlive);
}

function setupMediaRecorder(stream) {
  if (!stream) {
    throw new Error('Flux audio non disponible');
  }

  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm'
  });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start();
  
  // Arrêt automatique après 5 secondes
  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, 5000);
}
