// ImgView — preload (렌더러에 안전한 파일 API 노출)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('imgview', {
  isDesktop: true,
  openFolder:    ()        => ipcRenderer.invoke('open-folder'),
  openFiles:     ()        => ipcRenderer.invoke('open-files'),
  saveOverwrite: (payload) => ipcRenderer.invoke('save-overwrite', payload),
  saveFiles:     (payload) => ipcRenderer.invoke('save-files', payload),
  renameFile:    (payload) => ipcRenderer.invoke('rename-file', payload),
  deleteFile:    (p)       => ipcRenderer.invoke('delete-file', p),
  openFolderPath:(d)       => ipcRenderer.invoke('open-folder-path', d),
  showInFolder:  (p)       => ipcRenderer.invoke('show-in-folder', p),
  // 우클릭/실행 인자/더블클릭으로 넘어온 이미지 수신 (main → renderer)
  onAddFiles:    (cb)      => ipcRenderer.on('add-files', (e, files) => cb(files)),
});
