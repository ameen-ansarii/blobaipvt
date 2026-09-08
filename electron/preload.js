const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clickyApi', {
  isElectron: true,
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  getCursorPosition: () => ipcRenderer.invoke('get-cursor-position'),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  setWindowMode: (mode) => ipcRenderer.send('set-window-mode', mode),
  moveToCursor: () => ipcRenderer.send('move-window-to-cursor'),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  dragWindow: (deltaX, deltaY) => ipcRenderer.send('window-drag', { deltaX, deltaY }),
  onGlobalCursorTrack: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('global-cursor-track', handler);
    return () => ipcRenderer.removeListener('global-cursor-track', handler);
  },
  onSummon: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('summon-clicky', handler);
    return () => ipcRenderer.removeListener('summon-clicky', handler);
  },
  synthesizeSpeech: (text, voice) => ipcRenderer.invoke('synthesize-speech', { text, voice }),
  executeDesktopAction: (action) => ipcRenderer.invoke('execute-desktop-action', action),
  getActiveWindows: () => ipcRenderer.invoke('get-active-windows')
});

