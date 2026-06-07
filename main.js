// ImgView — Electron 메인 프로세스
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs/promises');
const path = require('path');

let mainWin = null;
const IMG_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|ico)$/i;

// 명령줄 인자 → 이미지 경로 수집 (파일은 그대로, 폴더는 안의 이미지 펼침)
async function collectImagePaths(argv) {
  const args = (argv || []).slice(1).filter(a => a && !a.startsWith('-'));
  const out = [];
  for (const a of args) {
    try {
      const st = await fs.stat(a);
      if (st.isDirectory()) {
        for (const e of await fs.readdir(a)) {
          if (IMG_RE.test(e)) out.push(path.join(a, e));
        }
      } else if (IMG_RE.test(a)) {
        out.push(a);
      }
    } catch (e) {}
  }
  return out;
}

// 경로의 파일들을 읽어 렌더러로 전달 (경로 정보까지 함께 → 덮어쓰기 저장에 사용)
async function sendFilesToRenderer(win, paths) {
  if (!win || !paths || !paths.length) return;
  const out = [];
  for (const p of paths) {
    try {
      out.push({ name: path.basename(p), path: p, data: await fs.readFile(p) });
    } catch (e) {}
  }
  if (out.length) win.webContents.send('add-files', out);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 760, minHeight: 560,
    backgroundColor: '#0c0d10',
    title: 'ImgView',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile('index.html');
  win.webContents.on('did-finish-load', async () => {
    sendFilesToRenderer(win, await collectImagePaths(process.argv));
  });
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', async (event, argv) => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
      sendFilesToRenderer(mainWin, await collectImagePaths(argv));
    }
  });
  app.whenReady().then(() => {
    mainWin = createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWin = createWindow();
    });
  });
}
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 폴더 열기 → 폴더 내 이미지 전부 읽어 전달
ipcMain.handle('open-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '폴더 선택', properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const dir = r.filePaths[0];
  const paths = [];
  for (const e of await fs.readdir(dir)) {
    if (IMG_RE.test(e)) paths.push(path.join(dir, e));
  }
  await sendFilesToRenderer(win, paths.sort());
  return { ok: true, count: paths.length, dir };
});

// 파일 열기 (여러 장)
ipcMain.handle('open-files', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '이미지 열기', properties: ['openFile', 'multiSelections'],
    filters: [{ name: '이미지', extensions: ['jpg','jpeg','png','gif','webp','bmp','tif','tiff','ico'] }],
  });
  if (r.canceled || !r.filePaths.length) return { ok: false };
  await sendFilesToRenderer(win, r.filePaths);
  return { ok: true, count: r.filePaths.length };
});

// 편집 결과 저장: 원본 경로에 덮어쓰기 (회전/크기변경 등)
//  - backup: true 면 같은 폴더의 'ImgView_원본'에 원본을 먼저 복사
ipcMain.handle('save-overwrite', async (event, { srcPath, data, backup }) => {
  try {
    if (backup && srcPath) {
      const dir = path.join(path.dirname(srcPath), 'ImgView_원본');
      await fs.mkdir(dir, { recursive: true });
      const dst = path.join(dir, path.basename(srcPath));
      if (!(await exists(dst))) await fs.copyFile(srcPath, dst);
    }
    await fs.writeFile(srcPath, Buffer.from(data));
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
});

// 다른 이름으로 저장 (포맷변환 결과 등) — 폴더 선택 후 여러 장 저장
ipcMain.handle('save-files', async (event, payload) => {
  const files = payload.files || [];
  const overwrite = !!payload.overwrite;
  const win = BrowserWindow.fromWebContents(event.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '저장할 폴더를 선택하세요',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true };
  const dir = r.filePaths[0];
  let count = 0;
  for (const f of files) {
    let target = path.join(dir, f.name);
    if (!overwrite) {
      const ext = path.extname(f.name);
      const base = f.name.slice(0, f.name.length - ext.length);
      let i = 1;
      while (await exists(target)) { target = path.join(dir, `${base} (${i})${ext}`); i++; }
    }
    await fs.writeFile(target, Buffer.from(f.data));
    count++;
  }
  return { ok: true, count, dir };
});

// 이름 변경
ipcMain.handle('rename-file', async (event, { srcPath, newName }) => {
  try {
    const dst = path.join(path.dirname(srcPath), newName);
    if (await exists(dst)) return { ok: false, error: '같은 이름이 이미 있습니다' };
    await fs.rename(srcPath, dst);
    return { ok: true, path: dst };
  } catch (e) { return { ok: false, error: String(e) }; }
});

// 삭제 (휴지통)
ipcMain.handle('delete-file', async (event, srcPath) => {
  try { await shell.trashItem(srcPath); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e) }; }
});

ipcMain.handle('open-folder-path', async (event, dir) => { if (dir) shell.openPath(dir); });
ipcMain.handle('show-in-folder', async (event, p) => { if (p) shell.showItemInFolder(p); });

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
