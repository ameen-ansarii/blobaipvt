# 🐾 HeyClicky (Windows AI Cursor Companion)

An AI companion inspired by Farza's Clicky that lives right next to your cursor on Windows. It sees your screen in real time, listens to your voice or text questions, and provides live context-aware assistance with rich animations and sound effects.

---

## ✨ Features

- **Floating Mascot & Emotive Face**: Procedural SVG eyes that physically track your mouse pointer across the screen, blink naturally, smile, and sync mouth movements when speaking.
- **Screen Vision ("See What I See")**: Snaps your desktop or active window and feeds visual context to Gemini Flash Vision.
- **Global Summon (`Alt + C` or `Ctrl + Shift + C`)**: Snaps Clicky right beside your cursor wherever you are on Windows.
- **Push-to-Talk & Audio**: Web Speech voice transcription and Web Audio procedural sound effects (chimes, pops, swooshes).
- **Multiple Personalities**:
  - 🧠 **Helpful Genius**: Quick, smart, and friendly answers.
  - 💻 **Code Guru**: Diagnoses bugs, reviews terminal output, and formats clean code.
  - 😏 **Snarky Friend**: Playful banter with high-iq solutions.
  - 🎨 **Pixel Critic**: Design review on spacing, typography, and contrast.
- **Zero-Setup Mode + Real API Key**: Works immediately out of the box with built-in intelligent contextual simulation, plus a Settings panel to plug in your Gemini API key for unrestricted live vision.

---

## 🚀 Running Clicky

### 1. Install dependencies
```bash
npm install
```

### 2. Start Desktop App (Electron + Vite)
```bash
npm run dev
```

### 3. Browser Preview Mode (Web Testing)
```bash
npm run dev:web
```

---

## ⌨️ Shortcuts

- **Summon Clicky to cursor**: `Alt + C` or `Ctrl + Shift + C`
- **Dismiss / Minimize**: `Esc` or click outside / close button
