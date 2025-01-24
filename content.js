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
    
    navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: request.streamId
        }
      }
    })
    .then(async stream => {
      console.log('Flux audio obtenu');
      
      // Création d'un AudioContext pour vérifier le niveau audio
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      // Vérification du niveau audio
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let hasAudio = false;
      
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        console.log('Niveau audio moyen:', average);
        hasAudio = average > 0;
      };
      
      // Vérifier le niveau audio pendant 1 seconde avant de commencer
      await new Promise(resolve => setTimeout(resolve, 1000));
      checkAudio();
      
      if (!hasAudio) {
        console.error('Aucun audio détecté');
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        sendResponse({ error: 'Aucun audio détecté' });
        return;
      }

      // Configuration du MediaRecorder avec un format WAV
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 256000  // Augmentation de la qualité
      });

      mediaRecorder.ondataavailable = async (event) => {
        console.log('Données audio disponibles:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Enregistrement terminé');
        
        if (audioChunks.length === 0) {
          console.error('Aucune donnée audio capturée');
          return;
        }

        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        console.log('Taille finale du blob:', audioBlob.size, 'bytes');

        // Conversion en base64 pour éviter les problèmes de transfert
        try {
          const base64Data = await blobToBase64(audioBlob);
          chrome.runtime.sendMessage({
            action: 'audioData',
            data: base64Data,
            mimeType: 'audio/webm;codecs=opus'
          });
        } catch (error) {
          console.error('Erreur de conversion:', error);
        }

        // Nettoyage
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        audioChunks = [];
      };

      // Capture plus fréquente des données
      mediaRecorder.start(500);
      console.log('Enregistrement démarré');
      
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

let mediaRecorder = null;
let audioChunks = [];

console.log('Content script chargé');

// Fonction utilitaire pour convertir un Blob en base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Nettoyage lors du déchargement de la page
window.addEventListener('unload', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
});
