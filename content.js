let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let destination = null;

console.log('Content script chargé');

// Nécessaire pour maintenir l'onglet actif
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'keepAlive') {
    setInterval(() => {
      chrome.runtime.sendMessage({ action: 'keepAlivePing' });
    }, 1000);
  }
});

// Écouteur pour les messages du background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message reçu dans content:', request.action);
  
  if (request.action === 'checkAudio') {
    // Vérifie si la page contient de l'audio en cours de lecture
    const audioElements = document.querySelectorAll('audio, video');
    const hasPlayingAudio = Array.from(audioElements).some(el => !el.paused);
    sendResponse({ hasAudio: hasPlayingAudio });
  }
  if (request.action === 'createStream') {
    navigator.mediaDevices.getUserMedia(request.constraints)
      .then(stream => {
        sendResponse({ stream: stream });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // Indique que nous allons envoyer une réponse asynchrone
  }
  if (request.action === 'startRecording') {
    console.log('Démarrage de l\'enregistrement avec streamId:', request.streamId);
    
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: request.streamId
        }
      }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        console.log('Flux audio obtenu');
        
        // Création du contexte audio pour le monitoring
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        destination = audioContext.createMediaStreamDestination();
        
        // Connexion pour permettre le monitoring
        source.connect(audioContext.destination);
        source.connect(destination);

        // Configuration du MediaRecorder
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorder.ondataavailable = event => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log('Enregistrement terminé');
          
          const audioBlob = new Blob(audioChunks, { 
            type: 'audio/webm;codecs=opus' 
          });
          
          console.log('Taille du blob audio:', audioBlob.size, 'bytes');

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result.split(',')[1];
            chrome.runtime.sendMessage({
              action: 'audioData',
              data: base64Audio
            });
          };
          reader.readAsDataURL(audioBlob);

          // Nettoyage
          stream.getTracks().forEach(track => track.stop());
          if (audioContext) {
            audioContext.close();
          }
          audioContext = null;
          audioChunks = [];
        };

        // Démarrage de l'enregistrement
        mediaRecorder.start();
        console.log('Enregistrement démarré');
        
        // Arrêt après 5 secondes
        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            console.log('Arrêt programmé après 5 secondes');
            mediaRecorder.stop();
          }
        }, 5000);

        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Erreur de capture:', error);
        sendResponse({ error: error.message });
      });

    return true;
  }
  return true;
});

// Nettoyage lors du déchargement de la page
window.addEventListener('unload', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (audioContext) {
    audioContext.close();
  }
});
