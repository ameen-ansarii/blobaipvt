class VoiceService {
  constructor() {
    this.currentAudio = null;
    this.voices = [
      { id: 'en-US-AnaNeural', name: 'Ana (Friendly & Cheerful)', gender: 'Female' },
      { id: 'en-US-JennyNeural', name: 'Jenny (Warm & Natural)', gender: 'Female' },
      { id: 'en-US-GuyNeural', name: 'Guy (Relaxed & Casual)', gender: 'Male' },
      { id: 'en-US-ChristopherNeural', name: 'Christopher (Modern Male)', gender: 'Male' },
      { id: 'en-GB-SoniaNeural', name: 'Sonia (British English)', gender: 'Female' }
    ];
  }

  getVoices() {
    return this.voices;
  }

  getCurrentVoice() {
    return localStorage.getItem('blob_voice') || 'en-US-AnaNeural';
  }

  setVoice(voiceId) {
    localStorage.setItem('blob_voice', voiceId);
  }

  stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {
        // Audio already stopped
      }
      this.currentAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[*#`_~[\]()<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async speak(text, onStart, onEnd) {
    this.stop();

    const sanitized = this.cleanText(text);
    if (!sanitized) {
      onEnd?.();
      return;
    }

    // 1. Try Microsoft Edge Neural Voice via Electron IPC
    if (window.clickyApi?.synthesizeSpeech) {
      try {
        const voice = this.getCurrentVoice();
        const audioUri = await window.clickyApi.synthesizeSpeech(sanitized, voice);

        if (audioUri) {
          const audio = new Audio(audioUri);
          this.currentAudio = audio;

          audio.onplay = () => {
            onStart?.();
          };

          audio.onended = () => {
            this.currentAudio = null;
            onEnd?.();
          };

          audio.onerror = () => {
            this.currentAudio = null;
            this.fallbackSpeak(sanitized, onStart, onEnd);
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Edge TTS playback failed, falling back to local speech:', err);
      }
    }

    // 2. Fallback to browser/system Web Speech API
    this.fallbackSpeak(sanitized, onStart, onEnd);
  }

  fallbackSpeak(text, onStart, onEnd) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Prefer Windows Natural / Neural voices if installed
      const availableVoices = window.speechSynthesis.getVoices();
      const naturalVoice = availableVoices.find(
        (v) =>
          v.name.includes('Natural') ||
          v.name.includes('Neural') ||
          v.name.includes('Google') ||
          v.name.includes('Jenny')
      );
      if (naturalVoice) {
        utterance.voice = naturalVoice;
      }

      utterance.onstart = () => onStart?.();
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech fallback error:', err);
      onEnd?.();
    }
  }
}

export const voiceService = new VoiceService();
