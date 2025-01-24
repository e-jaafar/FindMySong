let audioContext = null;
let mediaRecorder = null;
let audioChunks = [];
const SAMPLE_INTERVAL = 100; // ms
let isAnalyzing = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    startAnalysis();
  } else if (request.action === 'stopCapture') {
    stopAnalysis();
  }
});

async function startAudioCapture(tabId) {
  try {
    const stream = await chrome.tabCapture.capture({ audio: true, video: false });
    
    if (!stream) {
      console.error('Erreur : Impossible de capturer le flux audio');
      return;
    }
    
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    
    // Configurer le MediaRecorder pour capturer l'audio
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      // Ici, vous devriez envoyer audioBlob à un service de reconnaissance musicale
      // Pour cet exemple, nous simulons une réponse
      
      chrome.runtime.sendMessage({
        action: 'identificationResult',
        title: 'Bohemian Rhapsody',
        artist: 'Queen'
      });
      
      audioChunks = [];
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 5000); // Enregistre 5 secondes d'audio

    source.connect(analyser);

    // Créer un tableau pour stocker les données audio
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Fonction pour analyser l'audio
    /**
     * Fonction principale d'analyse audio
     * Capture les données audio et les transforme en fingerprint
     * @returns {void}
     */
    function analyzeAudio() {
      analyser.getByteFrequencyData(dataArray);
      
      // Ici, tu devrais implémenter l'algorithme de fingerprinting
      // Cela pourrait inclure :
      // - Extraction des caractéristiques spectrales
      // - Détection des pics dans le spectre
      // - Création d'un hash unique basé sur ces caractéristiques
      
      // Envoi des données à l'API de reconnaissance
      sendToRecognitionAPI(dataArray);
    }

    async function sendToRecognitionAPI(audioBlob) {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      
      // Récupérer la clé API avant d'envoyer la requête
      chrome.storage.sync.get(['apiKey'], async function(result) {
        const apiKey = result.apiKey;
        
        if (!apiKey) {
          console.error('Clé API non trouvée');
          chrome.runtime.sendMessage({
            action: 'error',
            message: 'Clé API non configurée'
          });
          return;
        }

        try {
          const response = await fetch('https://api.audd.io/', {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Bearer ${apiKey}`
            }
          });
          
          const data = await response.json();
          if (data.result) {
            chrome.runtime.sendMessage({
              action: 'identificationResult',
              title: data.result.title,
              artist: data.result.artist
            });
          } else {
            throw new Error('Musique non reconnue');
          }
        } catch (error) {
          chrome.runtime.sendMessage({
            action: 'error',
            message: error.message
          });
        }
      });
    }

  } catch (error) {
    console.error('Erreur de capture audio:', error);
  }
}

function startAnalysis() {
  if (isAnalyzing) return;
  isAnalyzing = true;
  analyzeAudio();
}

function stopAnalysis() {
  isAnalyzing = false;
}
