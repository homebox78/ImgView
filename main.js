// ImgView — Electron 메인 프로세스
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

let mainWin = null;
const IMG_RE = /\.(jpe?g|png|webp|gif|bmp|tiff?|ico|svg)$/i;

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
//  - replace: true 면 렌더러의 기존 목록을 비우고 교체 (폴더 트리 탐색용)
async function sendFilesToRenderer(win, paths, replace = false) {
  if (!win || !paths) return;
  const out = [];
  for (const p of paths) {
    try {
      out.push({ name: path.basename(p), path: p, data: await fs.readFile(p) });
    } catch (e) {}
  }
  if (out.length || replace) win.webContents.send('add-files', out, { replace });
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
    filters: [{ name: '이미지', extensions: ['jpg','jpeg','png','gif','webp','bmp','tif','tiff','ico','svg'] }],
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

// ===== 폴더 트리(탐색기) =====
// 사용 가능한 드라이브 목록 (로컬 + 네트워크 매핑 드라이브 포함)
ipcMain.handle('list-drives', async () => {
  // 1순위: PowerShell CIM 으로 네트워크 드라이브까지 조회
  const fromPS = await new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command',
       'Get-CimInstance Win32_LogicalDisk | ForEach-Object { "$($_.DeviceID)|$($_.VolumeName)|$($_.ProviderName)|$($_.DriveType)" }'],
      { windowsHide: true, timeout: 7000 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const list = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
          const [id, vol, prov, type] = l.split('|');
          const letter = (id || '').replace(/\\$/, '');      // "C:" / "Z:"
          let name = letter;
          if (prov) name = `${letter}  ${prov.replace(/^\\\\/, '')}`; // 네트워크: 경로 표시
          else if (vol) name = `${letter}  ${vol}`;
          return { name, path: letter + '\\', net: type === '4' };
        }).filter(d => d.path && /^[A-Za-z]:\\$/.test(d.path));
        resolve(list.length ? list : null);
      });
  });
  // A~Z 직접 탐지 (CIM이 놓친 드라이브 보강)
  const probe = [];
  for (let i = 65; i <= 90; i++) {
    const L = String.fromCharCode(i);
    const root = `${L}:\\`;
    try { await fs.access(root); probe.push({ name: `${L}:`, path: root }); } catch (e) {}
  }
  // CIM ∪ probe (드라이브 문자 기준 중복 제거)
  const merged = [];
  const seen = new Set();
  for (const d of [...(fromPS || []), ...probe]) {
    const key = d.path.slice(0, 2).toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key); merged.push(d);
  }
  merged.sort((a, b) => a.path.localeCompare(b.path));
  return merged;
});

// 한 폴더의 하위 폴더 목록 (트리 펼침용)
ipcMain.handle('list-dir', async (event, dir) => {
  try {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    return ents
      .filter(d => {
        try { return d.isDirectory() && !d.name.startsWith('$') && !d.name.startsWith('.'); }
        catch { return false; }
      })
      .map(d => ({ name: d.name, path: path.join(dir, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  } catch (e) { return []; }
});

// 한 폴더의 이미지를 모두 읽어 렌더러로 교체 전달 (트리에서 폴더 클릭)
ipcMain.handle('load-folder', async (event, dir) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  try {
    const paths = [];
    for (const e of await fs.readdir(dir)) {
      if (IMG_RE.test(e)) paths.push(path.join(dir, e));
    }
    await sendFilesToRenderer(win, paths.sort((a, b) => a.localeCompare(b, 'ko')), true);
    return { ok: true, count: paths.length, dir };
  } catch (e) { return { ok: false, error: String(e) }; }
});

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
