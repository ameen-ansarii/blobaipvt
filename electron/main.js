const { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

let mainWindow = null;
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Mascot collapsed size vs expanded chat HUD size
  const collapsedSize = { width: 96, height: 96 };
  const expandedSize = { width: 420, height: 640 };

  // Initial position: Bottom right corner
  const initialX = screenWidth - collapsedSize.width - 25;
  const initialY = screenHeight - collapsedSize.height - 25;

  mainWindow = new BrowserWindow({
    width: collapsedSize.width,
    height: collapsedSize.height,
    x: initialX,
    y: initialY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Enable click-through forwarding by default
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load URL or build
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external window links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Summon Clicky to current mouse position
function summonToCursor() {
  if (!mainWindow) return;

  const cursorPos = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPos);
  
  const expandedWidth = 420;
  const expandedHeight = 640;

  let targetX = cursorPos.x + 20;
  let targetY = cursorPos.y + 20;

  // Ensure window stays within display bounds
  const maxX = display.bounds.x + display.bounds.width - expandedWidth - 10;
  const maxY = display.bounds.y + display.bounds.height - expandedHeight - 10;

  if (targetX > maxX) {
    targetX = cursorPos.x - expandedWidth - 20;
  }
  if (targetY > maxY) {
    targetY = cursorPos.y - expandedHeight - 20;
  }

  mainWindow.setBounds({
    x: Math.max(display.bounds.x + 10, targetX),
    y: Math.max(display.bounds.y + 10, targetY),
    width: expandedWidth,
    height: expandedHeight
  });

  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('summon-clicky', { cursor: cursorPos });
}

// Register lifecycle events and global cursor broadcast
app.whenReady().then(() => {
  createWindow();

  // Broadcast cursor screen point relative to window for global 3D tracking
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        const cursorPos = screen.getCursorScreenPoint();
        const bounds = mainWindow.getBounds();
        const relX = cursorPos.x - (bounds.x + bounds.width / 2);
        const relY = cursorPos.y - (bounds.y + bounds.height / 2);
        mainWindow.webContents.send('global-cursor-track', {
          relX,
          relY,
          cursorX: cursorPos.x,
          cursorY: cursorPos.y
        });
      } catch (err) {
        // Window closing or backgrounding
      }
    }
  }, 35);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Window Drag Handler
ipcMain.on('window-drag', (event, { deltaX, deltaY }) => {
  if (!mainWindow) return;
  const [currentX, currentY] = mainWindow.getPosition();
  mainWindow.setPosition(currentX + deltaX, currentY + deltaY);
});

// IPC Handlers
ipcMain.handle('capture-screen', async () => {
  try {
    const cursorPos = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPos) || screen.getPrimaryDisplay();
    const scaleFactor = activeDisplay.scaleFactor || 1;
    const width = Math.round(activeDisplay.bounds.width * scaleFactor);
    const height = Math.round(activeDisplay.bounds.height * scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });

    if (sources.length > 0) {
      // Find source matching the user's current display
      let screenSource = sources.find(s => String(s.display_id) === String(activeDisplay.id));
      if (!screenSource) {
        screenSource = sources[0];
      }
      
      try {
        const jpegBuffer = screenSource.thumbnail.toJPEG(85);
        return 'data:image/jpeg;base64,' + jpegBuffer.toString('base64');
      } catch (e) {
        return screenSource.thumbnail.toDataURL();
      }
    }
    return null;
  } catch (error) {
    console.error('Screen capture error:', error);
    return null;
  }
});

ipcMain.handle('get-cursor-position', () => {
  return screen.getCursorScreenPoint();
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(ignore, options || { forward: true });
  }
});

ipcMain.on('move-window-to-cursor', () => {
  summonToCursor();
});

ipcMain.on('set-window-mode', (event, mode) => {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();

  if (mode === 'expanded') {
    const newWidth = 420;
    const newHeight = 640;
    // Shift left and up so the mascot bottom-right stays in place
    const newX = bounds.x - (newWidth - bounds.width);
    const newY = bounds.y - (newHeight - bounds.height);
    mainWindow.setBounds({
      x: Math.max(0, newX),
      y: Math.max(0, newY),
      width: newWidth,
      height: newHeight
    });
    mainWindow.setIgnoreMouseEvents(false);
  } else {
    const newWidth = 96;
    const newHeight = 96;
    // Shift right and down so it collapses cleanly back to the mascot
    const newX = bounds.x + (bounds.width - newWidth);
    const newY = bounds.y + (bounds.height - newHeight);
    mainWindow.setBounds({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight
    });
    // In collapsed mode, forward mouse events so clicks pass right through outside the mascot
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Neural Speech Synthesis via Microsoft Edge TTS (100% free, natural human voices)
ipcMain.handle('synthesize-speech', async (event, { text, voice = 'en-US-AnaNeural' }) => {
  try {
    const cleanText = text
      .replace(/[*#`_~[\]()<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return null;

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(cleanText);

    return new Promise((resolve) => {
      const chunks = [];
      const timer = setTimeout(() => {
        resolve(null);
      }, 15000);

      audioStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      audioStream.on('end', () => {
        clearTimeout(timer);
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        resolve(`data:audio/mp3;base64,${base64}`);
      });

      audioStream.on('error', (err) => {
        clearTimeout(timer);
        console.error('Edge TTS audio stream error:', err);
        resolve(null);
      });
    });
  } catch (err) {
    console.error('Edge TTS synthesis failed:', err);
    return null;
  }
});

// Reliable PowerShell runner using UTF-16LE Base64 encoding (prevents quote/variable expansion issues)
function runPowerShellScript(script) {
  const buf = Buffer.from(script, 'utf16le');
  const encoded = buf.toString('base64');
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout?.trim() || '', stderr: stderr?.trim() || '' });
    });
  });
}

// Resolve top YouTube video ID for direct playback (avoids leaving user on search results page or dead links)
async function resolveTopYouTubeVideo(query) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"videoRenderer":\s*\{\s*"videoId":\s*"([a-zA-Z0-9_-]{11})"/);
    if (match && match[1]) return match[1];
    const fallbackMatch = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    return fallbackMatch ? fallbackMatch[1] : null;
  } catch (err) {
    return null;
  }
}

// Query running application window titles (to understand active context)
ipcMain.handle('get-active-windows', async () => {
  const script = `
    $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle };
    foreach ($p in $procs) {
      Write-Output $p.MainWindowTitle;
    }
  `;
  const { err, stdout } = await runPowerShellScript(script);
  if (err || !stdout) return [];
  return stdout.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0 && !t.includes('blob-ai'));
});

// Autonomous Desktop Actions: Media Control, Window Navigation, Web Launching
ipcMain.handle('execute-desktop-action', async (event, action) => {
  if (!action || !action.type) {
    return { success: false, error: 'Invalid action payload' };
  }

  try {
    switch (action.type) {
      case 'SEEK_FORWARD_10S': {
        const ps = `
          $ws = New-Object -ComObject WScript.Shell;
          $null = $ws.AppActivate('Google Chrome') -or $ws.AppActivate('Chrome');
          Start-Sleep -Milliseconds 100;
          $ws.SendKeys('{ESC}');
          Start-Sleep -Milliseconds 40;
          $ws.SendKeys('l');
        `;
        await runPowerShellScript(ps);
        return { success: true, message: 'Skipped 10s forward on YouTube' };
      }

      case 'SEEK_BACKWARD_10S': {
        const ps = `
          $ws = New-Object -ComObject WScript.Shell;
          $null = $ws.AppActivate('Google Chrome') -or $ws.AppActivate('Chrome');
          Start-Sleep -Milliseconds 100;
          $ws.SendKeys('{ESC}');
          Start-Sleep -Milliseconds 40;
          $ws.SendKeys('j');
        `;
        await runPowerShellScript(ps);
        return { success: true, message: 'Rewound 10s on YouTube' };
      }

      case 'PLAY_PAUSE': {
        const ps = `
          $ws = New-Object -ComObject WScript.Shell;
          $null = $ws.AppActivate('Google Chrome') -or $ws.AppActivate('Chrome') -or $ws.AppActivate('Spotify');
          Start-Sleep -Milliseconds 100;
          $ws.SendKeys('{ESC}');
          Start-Sleep -Milliseconds 40;
          $ws.SendKeys('k');
        `;
        await runPowerShellScript(ps);
        return { success: true, message: 'Toggled media playback' };
      }

      case 'MUTE': {
        const ps = `
          $ws = New-Object -ComObject WScript.Shell;
          $null = $ws.AppActivate('Google Chrome') -or $ws.AppActivate('Chrome');
          Start-Sleep -Milliseconds 80;
          $ws.SendKeys('{ESC}');
          Start-Sleep -Milliseconds 30;
          $ws.SendKeys('m');
        `;
        await runPowerShellScript(ps);
        return { success: true, message: 'Toggled video audio mute' };
      }

      case 'FULLSCREEN': {
        const ps = `
          $ws = New-Object -ComObject WScript.Shell;
          $null = $ws.AppActivate('Google Chrome') -or $ws.AppActivate('Chrome');
          Start-Sleep -Milliseconds 80;
          $ws.SendKeys('{ESC}');
          Start-Sleep -Milliseconds 30;
          $ws.SendKeys('f');
        `;
        await runPowerShellScript(ps);
        return { success: true, message: 'Toggled video fullscreen' };
      }

      case 'PLAY_YOUTUBE': {
        const query = action.query?.trim();
        if (!query) return { success: false, error: 'Missing YouTube query' };

        let targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const videoId = await resolveTopYouTubeVideo(query);
        if (videoId) {
          targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }

        return new Promise((resolve) => {
          exec(`cmd.exe /c start "" chrome "${targetUrl}"`, async (err) => {
            if (err) {
              await shell.openExternal(targetUrl).catch(() => {});
            }
            // Bring Chrome to focus
            const focusPs = `
              $ws = New-Object -ComObject WScript.Shell;
              $null = $ws.AppActivate('Google Chrome') -or $ws.AppActivate('Chrome');
            `;
            await runPowerShellScript(focusPs);
            resolve({ success: true, message: `Playing on YouTube: ${targetUrl}` });
          });
        });
      }

      case 'OPEN_URL': {
        if (action.url) {
          let targetUrl = action.url.trim();
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
          }

          // If this is a YouTube search query, resolve the top video to play it directly!
          if (targetUrl.includes('/results?search_query=')) {
            const queryMatch = targetUrl.match(/search_query=([^&]+)/);
            if (queryMatch) {
              const query = decodeURIComponent(queryMatch[1].replace(/\+/g, ' '));
              const videoId = await resolveTopYouTubeVideo(query);
              if (videoId) {
                targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
              }
            }
          } else if (targetUrl.includes('youtube.com/watch') || targetUrl.includes('youtu.be/')) {
            // Guard against AI hallucinated YouTube video IDs
            if (action.userPrompt) {
              const cleanSearch = action.userPrompt.replace(/play|on youtube|on chrome|song|music|video|can you/gi, '').trim();
              if (cleanSearch) {
                const videoId = await resolveTopYouTubeVideo(cleanSearch);
                if (videoId) {
                  targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
                }
              }
            }
          }

          // Launch directly into active Chrome (Chrome routes to active session tab and loads immediately)
          return new Promise((resolve) => {
            exec(`cmd.exe /c start "" chrome "${targetUrl}"`, async (err) => {
              if (err) {
                await shell.openExternal(targetUrl).catch(() => {});
              }
              // Bring Chrome to focus
              const focusPs = `
                $ws = New-Object -ComObject WScript.Shell;
                $null = $ws.AppActivate('Google Chrome') -or $ws.AppActivate('Chrome');
              `;
              await runPowerShellScript(focusPs);
              resolve({ success: true, message: `Playing: ${targetUrl}` });
            });
          });
        }
        return { success: false, error: 'Missing URL' };
      }

      case 'RUN_COMMAND': {
        if (!action.command) return { success: false, error: 'Missing command' };
        return new Promise((resolve) => {
          exec(action.command, { timeout: 10000 }, (err, stdout, stderr) => {
            resolve({
              success: !err,
              stdout: stdout || '',
              stderr: stderr || '',
              message: err ? err.message : 'Command completed successfully'
            });
          });
        });
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    console.error('Desktop action execution error:', err);
    return { success: false, error: err.message };
  }
});


