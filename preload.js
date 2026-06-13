// ImgView — preload (렌더러에 안전한 파일 API 노출)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('imgview', {
  isDesktop: true,
  openFolder:    ()        => ipcRenderer.invoke('open-folder'),
  openFiles:     ()        => ipcRenderer.invoke('open-files'),
  saveOverwrite: (payload) => ipcRenderer.invoke('save-overwrite', payload),
  saveFiles:     (payload) => ipcRenderer.invoke('save-files', payload),
  saveCompressed:(payload) => ipcRenderer.invoke('save-compressed', payload),
  captureWeb:    (payload) => ipcRenderer.invoke('capture-web', payload),
  captureHistory:()        => ipcRenderer.invoke('capture-history'),
  saveBytes:     (payload) => ipcRenderer.invoke('save-bytes', payload),
  renameFile:    (payload) => ipcRenderer.invoke('rename-file', payload),
  deleteFile:    (p)       => ipcRenderer.invoke('delete-file', p),
  openFolderPath:(d)       => ipcRenderer.invoke('open-folder-path', d),
  showInFolder:  (p)       => ipcRenderer.invoke('show-in-folder', p),
  toggleFullscreen:()      => ipcRenderer.invoke('toggle-fullscreen'),
  toggleAlwaysOnTop:()     => ipcRenderer.invoke('toggle-always-on-top'),
  // 폴더 트리(탐색기)
  listDrives:    ()        => ipcRenderer.invoke('list-drives'),
  listNetwork:   ()        => ipcRenderer.invoke('list-network'),
  listShares:    (c)       => ipcRenderer.invoke('list-shares', c),
  listDir:       (p)       => ipcRenderer.invoke('list-dir', p),
  loadFolder:    (p)       => ipcRenderer.invoke('load-folder', p),
  // 우클릭/실행 인자/더블클릭으로 넘어온 이미지 수신 (main → renderer)
  onAddFiles:    (cb)      => ipcRenderer.on('add-files', (e, files, opts) => cb(files, opts)),
});
