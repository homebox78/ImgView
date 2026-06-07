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
      const st = await fs.stat(p);
      out.push({ name: path.basename(p), path: p, data: await fs.readFile(p),
                 size: st.size, created: st.birthtimeMs || st.mtimeMs, modified: st.mtimeMs });
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
ipcMain.handle('open-external', async (event, url) => { if (url) shell.openExternal(url); });

// ===== ImgZip(이미집) 연동 — 설치/개발 위치 탐지 후 해당 exe 실행 =====
let _imgzipCache;
async function findImgZip() {
  if (_imgzipCache !== undefined) return _imgzipCache;
  const LA = process.env.LOCALAPPDATA || '';
  const PF = process.env.PROGRAMFILES || '';
  const PF86 = process.env['ProgramFiles(x86)'] || '';
  const candidates = [
    // 설치 위치 (productName=ImageZip)
    path.join(LA, 'Programs', 'ImageZip', 'ImageZip.exe'),
    path.join(LA, 'Programs', 'ImgZip', 'ImageZip.exe'),
    path.join(PF, 'ImageZip', 'ImageZip.exe'),
    path.join(PF86, 'ImageZip', 'ImageZip.exe'),
    // 개발/빌드 산출물 위치
    'G:\\ImgZip\\dist\\win-unpacked\\ImageZip.exe',
    'G:\\ImgZip\\ImageZip.exe',
  ];
  for (const c of candidates) { if (c && await exists(c)) { _imgzipCache = c; return c; } }
  // 레지스트리(Uninstall)에서 ImgZip 검색
  try {
    const ps = "$ErrorActionPreference='SilentlyContinue';@('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*')|ForEach-Object{Get-ItemProperty $_}|Where-Object{$_.DisplayName -match 'ImgZip|ImageZip|이미집'}|ForEach-Object{ $_.DisplayIcon; $_.InstallLocation }";
    const out = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], 8000);
    for (let line of out.split(/\r?\n/)) {
      line = line.trim().replace(/,\d+$/, '').replace(/^"|"$/g, '');
      if (!line) continue;
      let exe = /\.exe$/i.test(line) ? line : path.join(line, 'ImgZip.exe');
      if (await exists(exe)) { _imgzipCache = exe; return exe; }
    }
  } catch (e) {}
  _imgzipCache = null;
  return null;
}
ipcMain.handle('imgzip-info', async () => { const p = await findImgZip(); return { installed: !!p, path: p }; });
ipcMain.handle('open-in-imgzip', async (event, file) => {
  try {
    const exe = await findImgZip();
    if (!exe) return { ok: false, error: 'not-installed' };
    const { spawn } = require('child_process');
    spawn(exe, file ? [file] : [], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
});

// ===== 폴더 트리(탐색기) =====
function execText(file, args, timeout = 7000) {
  return new Promise((resolve) => {
    try {
      execFile(file, args, { windowsHide: true, timeout, maxBuffer: 1 << 20 },
        (err, stdout) => resolve(stdout ? stdout.toString() : ''));
    } catch (e) { resolve(''); }
  });
}

// 사용 가능한 드라이브 목록 (로컬 + 네트워크 매핑 드라이브 포함)
ipcMain.handle('list-drives', async () => {
  const out = [];
  const seen = new Set();
  const add = (letter, name, net) => {
    const key = letter.toUpperCase();
    if (!/^[A-Z]:$/.test(key) || seen.has(key)) return;
    seen.add(key);
    out.push({ name: name || letter, path: key + '\\', net: !!net });
  };

  // 1) CIM: 로컬/네트워크/이동식 모두. ProviderName 있으면 네트워크
  const cim = await execText('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command',
     'Get-CimInstance Win32_LogicalDisk | ForEach-Object { "$($_.DeviceID)|$($_.VolumeName)|$($_.ProviderName)|$($_.DriveType)" }']);
  for (const l of cim.split(/\r?\n/)) {
    const m = l.trim(); if (!m) continue;
    const [id, vol, prov, type] = m.split('|');
    const letter = (id || '').replace(/\\$/, '');
    if (!/^[A-Za-z]:$/.test(letter)) continue;
    let name = letter;
    if (prov) name = `${letter}  ${prov.replace(/^\\\\/, '')}`;
    else if (vol) name = `${letter}  ${vol}`;
    add(letter, name, type === '4' || !!prov);
  }

  // 2) net use: 매핑된 네트워크 드라이브(끊긴 것 포함)까지 — CIM이 놓치는 경우 보강
  const nu = await execText('cmd.exe', ['/d', '/s', '/c', 'net use']);
  const re = /([A-Za-z]):\s+(\\\\[^\s]+)/g;
  let mm;
  while ((mm = re.exec(nu)) !== null) {
    add(mm[1] + ':', `${mm[1]}:  ${mm[2]}`, true);
  }

  // 3) A~Z 직접 탐지 (로컬 보강)
  for (let i = 65; i <= 90; i++) {
    const L = String.fromCharCode(i);
    try { await fs.access(`${L}:\\`); add(`${L}:`, `${L}:`, false); } catch (e) {}
  }

  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
});

// 네트워크의 SMB 컴퓨터/NAS 목록 (Explorer '네트워크'와 동일, UPnP/DLNA는 제외)
ipcMain.handle('list-network', async () => {
  const ps = "$ErrorActionPreference='SilentlyContinue';$sh=New-Object -ComObject Shell.Application;$n=$sh.NameSpace(18);if($n){$n.Items()|ForEach-Object{ \"$($_.Name)|$($_.Path)|$($_.IsFolder)\" }}";
  const out = await execText('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], 12000);
  const seen = new Set();
  const list = [];
  for (const l of out.split(/\r?\n/)) {
    const t = l.trim(); if (!t) continue;
    const parts = t.split('|');
    if (parts.length < 3) continue;
    const name = parts[0];
    const p = parts[1].trim();
    const isFolder = /true/i.test(parts[2]);
    if (!isFolder || !p.startsWith('\\\\')) continue;       // SMB 공유 서버만 (\\호스트)
    const host = p.replace(/^\\+/, '').split('\\')[0];
    const key = host.toLowerCase();
    if (!host || seen.has(key)) continue; seen.add(key);
    list.push({ name: name || host, path: '\\\\' + host });
  }
  return list;
});

// 한 컴퓨터(\\호스트)의 공유 폴더 목록
ipcMain.handle('list-shares', async (event, comp) => {
  if (!comp) return [];
  const host = comp.replace(/[\\/]+$/, '');
  // 주의: cmd 인자에 따옴표를 넣으면 Node가 \" 로 이스케이프해 깨짐. 호스트명엔 공백이 없으므로 따옴표 없이 전달.
  // chcp 65001 로 출력 인코딩을 UTF-8 로 바꿔 한글 공유명이 깨지지 않게 함.
  const out = await execText('cmd.exe', ['/d', '/s', '/c', `chcp 65001>nul & net view ${host} /all`], 12000);
  const lines = out.split(/\r?\n/);
  const start = lines.findIndex(l => /^-{3,}/.test(l.trim()));
  const shares = [];
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) break;                              // 표 끝(빈 줄)
      // 공유명 + 2칸 이상 공백 + 타입컬럼(글자) 형태만 허용 → 푸터("...completed") 같은 줄 제외
      const m = line.match(/^(.+?)\s{2,}\S/);
      if (!m) continue;
      const name = m[1].trim();
      if (!name || name.endsWith('$')) continue;            // IPC$ 등 제외
      shares.push({ name, path: host + '\\' + name });
    }
  }
  return shares;
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
