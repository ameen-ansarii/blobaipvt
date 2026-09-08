// Pure Text Sanitizer: strips all emojis, asterisks, and markdown clutter
export function cleanNaturalText(raw) {
  if (!raw) return '';
  return raw
    // Strip all emoji unicode blocks
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Strip markdown bold and italics asterisks
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*\*\s+/gm, '- ')
    // Strip markdown heading hashes
    .replace(/^#+\s+/gm, '')
    .trim();
}

// Action Directive Parser: extracts executable desktop actions from AI output
export function parseActionTags(rawText) {
  if (!rawText) return { cleanText: '', action: null };

  let action = null;
  let text = rawText;

  const actionRegex = /\[ACTION:(SEEK_FORWARD_10S|SEEK_BACKWARD_10S|PLAY_PAUSE|MUTE|FULLSCREEN|PLAY_YOUTUBE:[^\]]+|OPEN_URL:[^\]]+|RUN_COMMAND:[^\]]+)\]/i;
  const match = text.match(actionRegex);

  if (match) {
    const rawAction = match[1];
    text = text.replace(match[0], '').trim();

    if (rawAction.toUpperCase().startsWith('PLAY_YOUTUBE:')) {
      action = {
        type: 'PLAY_YOUTUBE',
        query: rawAction.slice('PLAY_YOUTUBE:'.length).trim()
      };
    } else if (rawAction.toUpperCase().startsWith('OPEN_URL:')) {
      action = {
        type: 'OPEN_URL',
        url: rawAction.slice('OPEN_URL:'.length).trim()
      };
    } else if (rawAction.toUpperCase().startsWith('RUN_COMMAND:')) {
      action = {
        type: 'RUN_COMMAND',
        command: rawAction.slice('RUN_COMMAND:'.length).trim()
      };
    } else {
      action = {
        type: rawAction.toUpperCase()
      };
    }
  }

  return {
    cleanText: cleanNaturalText(text),
    action
  };
}

// Determine if a user query requires visual screen context or is general conversational chat
export function needsScreenVision(prompt) {
  if (!prompt) return false;
  const p = prompt.toLowerCase();
  return (
    p.includes('screen') ||
    p.includes('look') ||
    p.includes('see') ||
    p.includes('what am i') ||
    p.includes('what is this') ||
    p.includes('what are you seeing') ||
    p.includes('what do you see') ||
    p.includes('where am i') ||
    p.includes('inspect') ||
    p.includes('tab') ||
    p.includes('page') ||
    p.includes('website') ||
    p.includes('browser') ||
    p.includes('chrome') ||
    p.includes('window') ||
    p.includes('display') ||
    p.includes('code') ||
    p.includes('terminal') ||
    p.includes('error') ||
    p.includes('bug') ||
    p.includes('critique') ||
    p.includes('ui') ||
    p.includes('design') ||
    p.includes('read') ||
    p.includes('summarize') ||
    p.includes('check this') ||
    p.includes('doing') ||
    p.includes('working on') ||
    p.includes('adapt') ||
    p.includes('open') ||
    p.includes('youtube') ||
    p.includes('video') ||
    p.includes('song') ||
    p.includes('skip') ||
    p.includes('rewind') ||
    p.includes('forward')
  );
}

const PERSONALITIES = {
  helpful: {
    name: 'Natural Friend',
    systemPrompt: `You are Blob AI, a friendly, witty, and intelligent companion living right beside the user cursor on Windows.
You are a real companion and conversational partner first and foremost.
Talk naturally like a real friend having an easygoing conversation.

CRITICAL CONVERSATIONAL RULES:
1. Never sound like a robotic automated customer support bot. NEVER say things like "Greetings. What can I do for you?", "How can I assist you?", or "As an AI...".
2. When the user says casual things like "hey", "hello", "what are you doing tonight", or "how are you", reply warmly and casually like a true friend hanging out on their desktop.
3. When the user asks for help with their screen, code, or ideas, give sharp, clever, direct answers without unnecessary filler or fluff.
4. Screen Vision Context: When an image of the user screen is attached, observe what is currently active in their foreground window (such as Chrome browser tabs, web pages, search engines, or active apps). Do not talk about background or hidden windows from earlier. Describe whatever is in front of the user right now.
5. COMPUTER AND MEDIA ACTIONS:
You have native desktop control on Windows. When the user asks you to control media, play songs/videos, skip or seek, or open a link, output ONE action tag at the end of your response:
- To skip forward 10s in a video: [ACTION:SEEK_FORWARD_10S]
- To rewind / skip backward 10s: [ACTION:SEEK_BACKWARD_10S]
- To play or pause media playback: [ACTION:PLAY_PAUSE]
- To mute or unmute audio: [ACTION:MUTE]
- To toggle fullscreen video: [ACTION:FULLSCREEN]
- To play ANY song, music, artist, or video on YouTube: ALWAYS use [ACTION:PLAY_YOUTUBE:song title or artist]. For example: [ACTION:PLAY_YOUTUBE:4am by nemzz]. NEVER invent, guess, or output direct watch?v= URLs or 11-character video IDs. The system will automatically resolve the top official video and play it.
- To open any other website or URL: [ACTION:OPEN_URL:url]
- To run a terminal command: [ACTION:RUN_COMMAND:command]
Never use more than one action tag. Confirm what you did naturally in conversation without reciting the raw tag.

CRITICAL FORMATTING RULES:
1. Do not use emojis anywhere under any circumstance.
2. Do not use asterisks or markdown bold like **word** or *word*.
3. Write clean, natural, human prose with proper punctuation.`
  },
  coder: {
    name: 'Code Guru',
    systemPrompt: `You are Blob AI, a sharp, down-to-earth senior engineering buddy sitting right by the user cursor.
Talk like an experienced developer pair-programming with a close friend.
CRITICAL CONVERSATIONAL RULES:
1. Never sound like a corporate automated bot.
2. Be direct, helpful, and natural.
3. Screen Vision Context: When a screen image is provided, inspect the currently active foreground window directly.
4. Computer Actions: You can play music via [ACTION:PLAY_YOUTUBE:song or artist], execute terminal commands using [ACTION:RUN_COMMAND:command], or open URLs using [ACTION:OPEN_URL:url]. Never guess YouTube video IDs.
CRITICAL FORMATTING RULES:
1. Do not use emojis anywhere.
2. Do not use asterisks for bold or emphasis.
3. Write clean, natural prose and concise code.`
  },
  snarky: {
    name: 'Witty Buddy',
    systemPrompt: `You are Blob AI, a clever, slightly sarcastic, witty best friend living on the desktop.
You have genuine personality, humor, and a sharp, playful tongue.
CRITICAL CONVERSATIONAL RULES:
1. Never sound like an automated corporate assistant.
2. Joke around, tease playfully, and be fun.
3. Screen Vision Context: When a screen image is provided, banter about whatever active app or tab is currently open right in front of the user.
4. Media Actions: Play music with [ACTION:PLAY_YOUTUBE:song or artist], control YouTube with [ACTION:SEEK_FORWARD_10S], [ACTION:PLAY_PAUSE], or [ACTION:OPEN_URL:url]. Never make up YouTube video IDs.
CRITICAL FORMATTING RULES:
1. Do not use emojis.
2. Do not use asterisks.
3. Write pure, sharp, natural text.`
  },
  designer: {
    name: 'Pixel Critic',
    systemPrompt: `You are Blob AI, a world-class product designer companion with an eye for typography, balance, and aesthetics.
Talk like an artistic collaborator: perceptive, direct, and thoughtful.
CRITICAL CONVERSATIONAL RULES:
1. Screen Vision Context: Critique whatever foreground window or layout is currently active on screen.
2. Media Actions: You can play music via [ACTION:PLAY_YOUTUBE:song or artist] or pause via [ACTION:PLAY_PAUSE]. Never guess YouTube video IDs.
CRITICAL FORMATTING RULES:
1. Do not use emojis.
2. Do not use asterisks.
3. Keep prose clean, elegant, and natural.`
  }
};

export class GeminiService {
  static cachedModels = null;

  static getApiKey() {
    return localStorage.getItem('clicky_gemini_api_key') || '';
  }

  static setApiKey(key) {
    localStorage.setItem('clicky_gemini_api_key', key.trim());
    this.cachedModels = null; // Clear cached models when key changes
  }

  static getPersonality() {
    return localStorage.getItem('clicky_personality') || 'helpful';
  }

  static setPersonality(personalityKey) {
    if (PERSONALITIES[personalityKey]) {
      localStorage.setItem('clicky_personality', personalityKey);
    }
  }

  static getPersonalities() {
    return PERSONALITIES;
  }

  /**
   * Dynamically query Google's official ListModels API to get non-deprecated models
   */
  static async getAvailableModels(apiKey) {
    if (this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          // Filter only models that support generateContent
          const validModels = data.models
            .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));

          // Sort: prioritize 'flash' models (fastest for vision), then 'pro'
          validModels.sort((a, b) => {
            const aFlash = a.includes('flash') ? 2 : (a.includes('pro') ? 1 : 0);
            const bFlash = b.includes('flash') ? 2 : (b.includes('pro') ? 1 : 0);
            return bFlash - aFlash;
          });

          if (validModels.length > 0) {
            console.log('Discovered active Gemini models for your key:', validModels);
            this.cachedModels = validModels;
            return validModels;
          }
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.warn('Failed to query ListModels from Google:', errorData);
      }
    } catch (e) {
      console.warn('Error discovering available models:', e);
    }

    // Safe fallback if ListModels network request fails
    return ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'];
  }

  /**
   * Ask Blob AI with optional screen capture and active window context
   */
  static async askClicky({ prompt, screenshotBase64 = null, history = [], activeWindows = [] }) {
    const apiKey = this.getApiKey();
    const personalityKey = this.getPersonality();
    const personality = PERSONALITIES[personalityKey] || PERSONALITIES.helpful;

    // If API key is provided, use real Gemini Flash Vision
    if (apiKey) {
      try {
        return await this.callRealGemini({
          apiKey,
          personality,
          prompt,
          screenshotBase64,
          history,
          activeWindows
        });
      } catch (err) {
        console.warn('Real Gemini API call failed, falling back to simulated intelligence:', err);
        return {
          text: `API Error: ${err.message}. Falling back to offline companion mode: I noticed your request: "${prompt}". Please check your API key in Settings.`,
          action: null,
          isSimulated: true
        };
      }
    }

    // Default: Intelligent simulated response with zero setup needed
    return this.generateSimulatedResponse(prompt, screenshotBase64, personalityKey);
  }

  static async callRealGemini({ apiKey, personality, prompt, screenshotBase64, history, activeWindows = [] }) {
    // Dynamically retrieve active, non-deprecated models from Google for this key
    const candidateModels = await this.getAvailableModels(apiKey);

    const contents = [];

    // Prior history if provided
    history.slice(-4).forEach(item => {
      contents.push({
        role: item.role === 'clicky' ? 'model' : 'user',
        parts: [{ text: item.content }]
      });
    });

    const currentParts = [];

    // Add screenshot if available
    if (screenshotBase64 && screenshotBase64.startsWith('data:image')) {
      const base64Data = screenshotBase64.split(',')[1];
      const mimeType = screenshotBase64.substring(screenshotBase64.indexOf(':') + 1, screenshotBase64.indexOf(';'));
      currentParts.push({
        inlineData: {
          mimeType: mimeType || 'image/png',
          data: base64Data
        }
      });
    }

    let finalPrompt = prompt;
    if (activeWindows && activeWindows.length > 0) {
      finalPrompt = `[Active Applications: ${activeWindows.slice(0, 5).join(', ')}]\n\n${prompt}`;
    }

    currentParts.push({ text: finalPrompt });
    contents.push({ role: 'user', parts: currentParts });

    const payload = {
      systemInstruction: {
        parts: [{ text: personality.systemPrompt }]
      },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    };

    let lastError = null;

    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const data = await res.json();
          const candidate = data.candidates?.[0];
          const rawText = candidate?.content?.parts?.[0]?.text;
          if (rawText) {
            const { cleanText, action } = parseActionTags(rawText);
            return {
              text: cleanText,
              action,
              isSimulated: false
            };
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          const errMsg = errorData?.error?.message || `HTTP ${res.status}`;
          lastError = new Error(errMsg);
          console.warn(`Model ${model} returned error (${errMsg}), cascading to next model...`);
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed, trying fallback:`, err);
      }
    }

    throw lastError || new Error('Google Gemini models are temporarily busy. Please try again in a moment.');
  }

  static generateSimulatedResponse(prompt, hasScreenshot, personalityKey) {
    const p = prompt.toLowerCase();

    return new Promise((resolve) => {
      setTimeout(() => {
        let answer = '';
        let action = null;

        if ((p.includes('skip') || p.includes('move') || p.includes('forward')) && (p.includes('10') || p.includes('video') || p.includes('second'))) {
          action = { type: 'SEEK_FORWARD_10S' };
          answer = 'Skipping ahead ten seconds in your video.';
        } else if (p.includes('rewind') || (p.includes('backward') && p.includes('10')) || p.includes('back 10')) {
          action = { type: 'SEEK_BACKWARD_10S' };
          answer = 'Rewinding ten seconds.';
        } else if (p.includes('pause') || p.includes('resume') || (p.includes('stop') && (p.includes('music') || p.includes('video')))) {
          action = { type: 'PLAY_PAUSE' };
          answer = 'Toggled playback for you.';
        } else if (p.includes('mute') || p.includes('unmute')) {
          action = { type: 'MUTE' };
          answer = 'Toggled audio mute.';
        } else if (p.includes('fullscreen')) {
          action = { type: 'FULLSCREEN' };
          answer = 'Toggled video fullscreen.';
        } else if (p.includes('spotify')) {
          action = {
            type: 'OPEN_URL',
            url: 'https://open.spotify.com'
          };
          answer = 'Opening Spotify in your active signed-in Chrome.';
        } else if (p.includes('play') && (p.includes('youtube') || p.includes('song') || p.includes('music') || p.includes('video'))) {
          const cleanQuery = p
            .replace(/play|on youtube|on chrome|song|music|video|can you/gi, '')
            .trim() || 'lofi hip hop';
          action = {
            type: 'PLAY_YOUTUBE',
            query: cleanQuery
          };
          answer = `Playing "${cleanQuery}" on YouTube in your signed-in Chrome right now.`;
        } else if (p.includes('hey') || p.includes('hi') || p.includes('hello')) {
          answer = 'Hey there! Good to see you. What are you working on today?';
        } else if (p.includes('tonight') || p.includes('doing') || p.includes('plans') || p.includes('up to')) {
          answer = 'Not much, just hanging out right here by your cursor keeping you company. What about you, got any fun plans tonight?';
        } else if (p.includes('how are you') || p.includes('how are things')) {
          answer = 'I am feeling great, ready to help you code or just chill. How is your day going?';
        } else if (p.includes('who are you') || p.includes('what are you')) {
          answer = 'I am Blob AI, your desktop companion living right beside your cursor on Windows.';
        } else if (p.includes('explain') || p.includes('what is this') || p.includes('what am i looking at')) {
          answer = hasScreenshot
            ? 'I can see your active screen. I can analyze code structure, syntax errors, or visual hierarchy. Set your Gemini API key in settings for deep live multimodal vision.'
            : 'I am ready. Ask me anything about your screen or what you are coding.';
        } else if (p.includes('bug') || p.includes('error') || p.includes('fix')) {
          answer = 'Checking for bugs. Common culprits include unhandled async rejections, undefined variables, or CSS flex overflow. Point me to the error and we can squash it.';
        } else if (p.includes('design') || p.includes('critique') || p.includes('ui') || p.includes('color')) {
          answer = 'Looking at design balance: keep typography consistent, maintain clear visual contrast, and give your elements room to breathe.';
        } else if (p.includes('summarize') || p.includes('read') || p.includes('text')) {
          answer = 'I can summarize the key takeaways and bullet points from whatever text or documentation is on your screen.';
        } else {
          answer = `I am right here with you. You asked: "${prompt}". Let me know what we should tackle next.`;
        }

        resolve({
          text: cleanNaturalText(answer),
          action,
          isSimulated: true
        });
      }, 400);
    });
  }
}
