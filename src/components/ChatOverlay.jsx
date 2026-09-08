import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  Mic,
  Settings,
  Volume2,
  VolumeX,
  X,
  RotateCw,
  Eye,
  Code2,
  AlertCircle,
  FileText,
  ArrowLeft,
  ExternalLink,
  Check,
  Zap
} from 'lucide-react';
import { sound } from '../services/soundEffects';
import { GeminiService, cleanNaturalText } from '../services/geminiService';
import { voiceService } from '../services/voiceService';
import BlobMascot from './BlobMascot';

function getActionLabel(action, result) {
  if (!action) return '';
  switch (action.type) {
    case 'PLAY_YOUTUBE':
      return `Playing ${action.query ? `"${action.query}"` : ''} on YouTube`;
    case 'SEEK_FORWARD_10S':
      return 'Skipped 10s forward (YouTube)';
    case 'SEEK_BACKWARD_10S':
      return 'Rewound 10s (YouTube)';
    case 'PLAY_PAUSE':
      return 'Toggled media playback';
    case 'MUTE':
      return 'Toggled audio mute';
    case 'FULLSCREEN':
      return 'Toggled fullscreen';
    case 'OPEN_URL':
      return `Opened ${action.url.includes('youtube') ? 'YouTube' : 'link'}`;
    case 'RUN_COMMAND':
      return `Executed: ${action.command}`;
    default:
      return result?.message || 'Desktop action executed';
  }
}

export default function ChatOverlay({
  screenshot,
  onRecapture,
  messages,
  onSendMessage,
  isProcessing,
  isInspectingScreen,
  onClose,
  status = 'idle'
}) {
  const [view, setView] = useState('chat'); // 'chat' | 'settings'
  const [inputVal, setInputVal] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(sound.isMuted());

  // Settings State
  const [apiKey, setApiKey] = useState(GeminiService.getApiKey());
  const [personality, setPersonality] = useState(GeminiService.getPersonality());
  const [selectedVoice, setSelectedVoice] = useState(voiceService.getCurrentVoice());
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [isRecapturing, setIsRecapturing] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const personalities = GeminiService.getPersonalities();

  // Auto-scroll on new message
  useEffect(() => {
    if (view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isProcessing, view]);

  // Focus input on mount
  useEffect(() => {
    if (view === 'chat') {
      inputRef.current?.focus();
    }
  }, [view]);

  // Web Speech API for voice recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        sound.playBlip();
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setInputVal(cleanNaturalText(transcript));
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const handleToggleVoice = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Voice start failed:', err);
      }
    }
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    if (!muted) sound.playBlip();
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const query = cleanNaturalText(inputVal.trim());
    if (!query || isProcessing) return;

    sound.playSend();
    onSendMessage(query);
    setInputVal('');
  };

  const handleRecapture = async () => {
    setIsRecapturing(true);
    sound.playBlip();
    if (onRecapture) {
      await onRecapture();
    }
    setTimeout(() => setIsRecapturing(false), 600);
  };

  const handleQuickAction = (promptText) => {
    sound.playPop();
    onSendMessage(promptText);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    GeminiService.setApiKey(apiKey);
    GeminiService.setPersonality(personality);
    voiceService.setVoice(selectedVoice);
    sound.playResponse();
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      setView('chat');
    }, 500);
  };

  const hasOnlyWelcome = messages.length <= 1;

  return (
    <div className="blob-chat-sheet clicky-interactive">
      {/* Sleek Header */}
      <div className="sheet-header">
        {view === 'settings' ? (
          <div className="sheet-brand">
            <button
              className="sheet-btn"
              onClick={() => setView('chat')}
              title="Back to conversation"
              style={{ padding: '4px' }}
            >
              <ArrowLeft size={16} />
            </button>
            <span className="brand-name">SETTINGS</span>
          </div>
        ) : (
          <div className="sheet-brand">
            <BlobMascot status={status} size={32} interactive={false} />
            <span className="brand-name">BLOB AI</span>
            <span className={`brand-status-tag ${status}`}>
              {isProcessing
                ? (isInspectingScreen ? 'ANALYZING' : 'THINKING')
                : status === 'speaking'
                ? 'SPEAKING'
                : isListening
                ? 'LISTENING'
                : 'ONLINE'}
            </span>
          </div>
        )}

        <div className="sheet-controls">
          {view === 'chat' && (
            <>
              <button
                className="sheet-btn"
                onClick={handleRecapture}
                title="Sync and capture active screen"
              >
                <RotateCw
                  size={14}
                  style={{
                    animation: isRecapturing ? 'spin 0.6s linear infinite' : 'none'
                  }}
                />
              </button>
              <button
                className="sheet-btn"
                onClick={handleToggleMute}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button
                className="sheet-btn"
                onClick={() => {
                  sound.playBlip();
                  setView('settings');
                }}
                title="Settings"
              >
                <Settings size={14} />
              </button>
            </>
          )}

          <button
            className="sheet-btn close"
            onClick={onClose}
            title="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="sheet-body">
        {view === 'settings' ? (
          /* Minimalist In-Sheet Settings (Zero Black Square Backdrop!) */
          <form onSubmit={handleSaveSettings} className="settings-inner-view">
            <div className="settings-field">
              <div className="settings-field-header">
                <label className="settings-field-title">GEMINI API KEY</label>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="settings-external-link"
                >
                  Get key <ExternalLink size={10} />
                </a>
              </div>
              <input
                type="password"
                className="settings-field-input"
                placeholder="Paste your Gemini API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <span className="settings-field-desc">
                Leave blank to use offline simulation.
              </span>
            </div>

            <div className="settings-field">
              <label className="settings-field-title">AI PERSONALITY</label>
              <select
                className="settings-field-select"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
              >
                {Object.entries(personalities).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-field">
              <label className="settings-field-title">NATURAL VOICE</label>
              <select
                className="settings-field-select"
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
              >
                {voiceService.getVoices().map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="settings-submit-btn">
              {savedFeedback ? (
                <>
                  <Check size={14} />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </form>
        ) : hasOnlyWelcome ? (
          /* Initial Exploration Grid (Inspired by Reference Design) */
          <div className="sheet-explore-view">
            <h2 className="explore-heading">
              Ask anything or explore recommendations
            </h2>

            <div className="explore-grid">
              <button
                className="explore-card"
                onClick={() => handleQuickAction('Explain what is currently on my screen')}
              >
                <div className="explore-icon-wrap">
                  <Eye size={16} />
                </div>
                <div className="explore-card-title">EXPLAIN SCREEN</div>
                <div className="explore-card-desc">
                  Analyze visible layout, text, and structure.
                </div>
              </button>

              <button
                className="explore-card"
                onClick={() => handleQuickAction('Write clean code or provide a solution for what is on screen')}
              >
                <div className="explore-icon-wrap">
                  <Code2 size={16} />
                </div>
                <div className="explore-card-title">WRITE CODE</div>
                <div className="explore-card-desc">
                  Generate instant scripts and syntax fixes.
                </div>
              </button>

              <button
                className="explore-card"
                onClick={() => handleQuickAction('Find any bugs, syntax errors, or warnings on screen')}
              >
                <div className="explore-icon-wrap">
                  <AlertCircle size={16} />
                </div>
                <div className="explore-card-title">FIND BUGS</div>
                <div className="explore-card-desc">
                  Spot logic flaws, stack traces, and errors.
                </div>
              </button>

              <button
                className="explore-card"
                onClick={() => handleQuickAction('Summarize the text currently visible')}
              >
                <div className="explore-icon-wrap">
                  <FileText size={16} />
                </div>
                <div className="explore-card-title">SUMMARIZE</div>
                <div className="explore-card-desc">
                  Extract core takeaways and action items.
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Clean Conversation Stream (Pure Natural Text, Zero Slop) */
          <div className="conversation-stream">
            {messages.slice(1).map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                <div className="message-text">
                  {cleanNaturalText(msg.content).split('\n').map((line, lIdx) => (
                    <p key={lIdx} className="text-paragraph">
                      {line}
                    </p>
                  ))}
                  {msg.action && (
                    <div className="desktop-action-badge">
                      <Zap size={12} />
                      <span>{getActionLabel(msg.action, msg.actionResult)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="message-row clicky">
                <div className="analyzing-pill">
                  <span className="pulsing-radar" />
                  <span>{isInspectingScreen ? 'Inspecting screen' : 'Thinking'}</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Sleek Minimalist Pill Input Bar (Only in Chat View) */}
      {view === 'chat' && (
        <form onSubmit={handleSubmit} className="sheet-input-bar">
          <input
            ref={inputRef}
            type="text"
            className="clean-text-input"
            placeholder="Write your thoughts here..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
          />

          <button
            type="button"
            className={`clean-mic-btn ${isListening ? 'active' : ''}`}
            onClick={handleToggleVoice}
            title="Push to talk"
          >
            <Mic size={17} />
          </button>

          <button
            type="submit"
            className="clean-send-btn"
            disabled={!inputVal.trim() || isProcessing}
            title="Send query"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </form>
      )}
    </div>
  );
}
