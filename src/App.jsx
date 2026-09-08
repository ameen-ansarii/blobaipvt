import React, { useState, useEffect, useCallback, useRef } from 'react';
import BlobMascot from './components/BlobMascot';
import ChatOverlay from './components/ChatOverlay';
import { GeminiService, needsScreenVision } from './services/geminiService';
import { sound } from './services/soundEffects';
import { voiceService } from './services/voiceService';

export default function App() {
  const [isSummoned, setIsSummoned] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [screenshot, setScreenshot] = useState(null);
  const [isInspectingScreen, setIsInspectingScreen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'clicky',
      content: "I am Blob AI. Talk to me anytime or ask me to inspect what is on your screen."
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const isCapturingRef = useRef(false);

  // Track cursor movement across window and manage click-through forwarding
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Hit-testing for Electron window:
      // If hovering over Blob AI or the Chat Sheet, allow clicks;
      // otherwise, forward clicks right through to Windows applications!
      if (window.clickyApi?.setIgnoreMouseEvents) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const isInteractive = target && (
          target.closest('.clicky-interactive') ||
          target.closest('.blob-chat-sheet') ||
          target.closest('.modal-backdrop')
        );

        if (isInteractive) {
          window.clickyApi.setIgnoreMouseEvents(false);
        } else {
          window.clickyApi.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Sync window size with Electron whenever collapsed/expanded state changes
  useEffect(() => {
    if (window.clickyApi?.setWindowMode) {
      window.clickyApi.setWindowMode(isSummoned ? 'expanded' : 'collapsed');
    }
  }, [isSummoned]);

  // Capture screen snapshot
  const captureCurrentScreen = useCallback(async () => {
    if (isCapturingRef.current) return null;
    isCapturingRef.current = true;

    try {
      if (window.clickyApi?.captureScreen) {
        const shot = await window.clickyApi.captureScreen();
        if (shot) {
          setScreenshot(shot);
          return shot;
        }
      }

      // Fallback for browser preview: create a crisp mockup canvas screenshot
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 1280, 720);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        // Draw simulated desktop window
        ctx.fillStyle = '#1e293b';
        ctx.roundRect(100, 100, 1080, 520, 12);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 28px Inter, sans-serif';
        ctx.fillText('Desktop Workspace Snapshot', 140, 160);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px Inter, sans-serif';
        ctx.fillText('Active application: Code Editor / Browser', 140, 200);

        const mockShot = canvas.toDataURL('image/png');
        setScreenshot(mockShot);
        return mockShot;
      }
      return null;
    } catch (err) {
      console.warn('Electron screen capture failed:', err);
      return null;
    } finally {
      isCapturingRef.current = false;
    }
  }, []);

  // Listen for Electron global summon event
  useEffect(() => {
    if (window.clickyApi?.onSummon) {
      const cleanup = window.clickyApi.onSummon(() => {
        sound.playChime();
        setIsSummoned(true);
        captureCurrentScreen();
      });
      return cleanup;
    }
  }, [captureCurrentScreen]);

  // Initial welcome chime
  useEffect(() => {
    sound.playWake();
  }, []);

  // Toggle summon
  const handleToggleSummon = async () => {
    if (!isSummoned) {
      sound.playChime();
      setIsSummoned(true);
      await captureCurrentScreen();
    } else {
      sound.playBlip();
      setIsSummoned(false);
    }
  };

  // Send message to Blob AI
  const handleSendMessage = async (prompt) => {
    const isVision = needsScreenVision(prompt);
    setIsInspectingScreen(isVision);

    const newMessages = [...messages, { role: 'user', content: prompt }];
    setMessages(newMessages);
    setIsProcessing(true);
    setStatus('thinking');

    try {
      // Query active open windows to provide live desktop context
      let activeWindows = [];
      if (window.clickyApi?.getActiveWindows) {
        try {
          activeWindows = await window.clickyApi.getActiveWindows();
        } catch (winErr) {
          console.warn('Could not query active windows:', winErr);
        }
      }

      // Always capture screen fresh at the exact moment of user request if vision is needed
      let activeScreenshot = screenshot;
      if (isVision) {
        const freshShot = await captureCurrentScreen();
        if (freshShot) {
          activeScreenshot = freshShot;
        }
      }

      const response = await GeminiService.askClicky({
        prompt,
        screenshotBase64: isVision ? activeScreenshot : null,
        history: newMessages,
        activeWindows
      });

      // If an autonomous desktop action was requested, execute it!
      let actionResult = null;
      if (response.action) {
        response.action.userPrompt = prompt;
        if (window.clickyApi?.executeDesktopAction) {
          try {
            actionResult = await window.clickyApi.executeDesktopAction(response.action);
          } catch (actErr) {
            console.warn('Action execution failed:', actErr);
          }
        }

        // Direct fallback for opening URLs immediately even if Electron was started before the update
        if ((!actionResult || !actionResult.success) && response.action.type === 'PLAY_YOUTUBE' && response.action.query) {
          const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(response.action.query)}`;
          window.open(targetUrl, '_blank');
          actionResult = { success: true, message: `Playing: ${response.action.query}` };
        } else if ((!actionResult || !actionResult.success) && response.action.type === 'OPEN_URL' && response.action.url) {
          let targetUrl = response.action.url.trim();
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
          }
          const a = document.createElement('a');
          a.href = targetUrl;
          a.target = '_blank';
          a.rel = 'noreferrer noopener';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          actionResult = { success: true, message: `Opened: ${targetUrl}` };
        }
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'clicky',
          content: response.text,
          action: response.action,
          actionResult
        }
      ]);
      sound.playResponse();

      // Natural neural speech synthesis synchronized with mascot state
      if (!sound.isMuted()) {
        voiceService.speak(
          response.text,
          () => setStatus('speaking'),
          () => setStatus('idle')
        );
      } else {
        setStatus('idle');
      }
    } catch (err) {
      console.error('Failed to get answer from Blob AI:', err);
      setMessages(prev => [
        ...prev,
        { role: 'clicky', content: "Something went wrong. Let me know what you need and we can try again." }
      ]);
      setStatus('idle');
    } finally {
      setIsProcessing(false);
      setIsInspectingScreen(false);
    }
  };

  return (
    <div className={`clicky-app ${isSummoned ? 'expanded' : 'collapsed'}`}>
      {/* Expanded Chat HUD with integrated Mascot */}
      {isSummoned ? (
        <ChatOverlay
          screenshot={screenshot}
          onRecapture={captureCurrentScreen}
          messages={messages}
          onSendMessage={handleSendMessage}
          isProcessing={isProcessing}
          isInspectingScreen={isInspectingScreen}
          onClose={() => setIsSummoned(false)}
          status={status}
        />
      ) : (
        /* Floating Draggable Desktop Mascot in Collapsed Mode */
        <BlobMascot
          isSummoned={isSummoned}
          onToggleSummon={handleToggleSummon}
          status={status}
          size={84}
          interactive={true}
        />
      )}
    </div>
  );
}
