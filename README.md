# ImgView (이미뷰)

> 보기 좋게, 빠르게 · ImageZip 시리즈의 이미지 뷰어

가볍고 빠른 **이미지 뷰어 & 기본 편집 데스크톱 도구**입니다.
왼쪽 **폴더 트리(윈도우 탐색기)** 로 폴더를 넘나들며, 가운데 **바둑판 썸네일**로 훑어보고,
클릭하면 **우측 미리보기**, 더블클릭하면 **단독 크게보기**로 봅니다.
회전·크기변경·포맷변환까지 한 곳에서 처리합니다. 다크 톤 + 민트 포인트의 ImageZip 시리즈 통일 디자인.

---

## ✨ 주요 기능

### 보기
- **폴더 트리 탐색기** — 좌측에 내 PC의 드라이브(로컬·**네트워크 매핑 드라이브** 포함) → 폴더 트리. 폴더를 클릭하면 그 폴더의 이미지가 바로 로드됩니다.
- **네트워크/NAS 탐색** — 별도 **네트워크** 노드에서 SMB 컴퓨터(예: `\\HBnas`) → 공유 폴더까지 탐색. 드라이브 문자 매핑이 없는 UNC 공유도 직접 접근.
- **바둑판 그리드** — 폴더의 이미지를 썸네일 격자로 한눈에. 대용량 폴더도 부드럽게 스크롤되도록 **지연 썸네일 + 화면 밖 렌더링 생략**(content-visibility) 적용.
- **보기 전환** — 썸네일(바둑판) ↔ **자세히 목록**(이름·크기·용량·생성일) 토글.
- **클릭 = 우측 미리보기** — 선택한 이미지를 우측 패널에 즉시 미리보기(이름·해상도 표시).
- **더블클릭 = 단독 크게보기** — 좌우 이동, 휠 줌, 창 맞춤, 드래그 팬. `목록` 버튼/`Esc`로 그리드 복귀.
- **밝기 보정** — 단독 뷰에서 슬라이더로 간단한 밝기 조절(이미지별 자동 리셋).
- **드래그앤드롭** — 이미지·폴더를 끌어다 놓으면 바로 열림.
- **지원 포맷** — JPG · PNG · WebP · GIF · BMP · **SVG** · TIFF · ICO.

### 편집 (선택한 이미지 기준)
- **회전** — 90° / -90° (저장 시 원본을 같은 폴더의 `ImgView_원본/`에 자동 백업).
- **크기변경** — 비율(%) · 해상도(가로×세로) · 긴 축(px).
- **포맷변환** — JPG · PNG · WebP · BMP(PNG로 폴백).
- **파일 관리** — 이름변경, 삭제(휴지통).

### 연동
- **탐색기 연동** — 이미지 우클릭 **"ImgView로 보기"** · 폴더 우클릭 **"ImgView로 폴더 보기"**, Windows **연결 프로그램(열기)** 등록. (기본 연결을 가로채지 않아 탐색기 썸네일은 그대로 유지.)
- **ImageZip 연동** — 단독 뷰에서 압축 시 절감 가능한 용량(WebP 기준 추정)을 표시하고, **용량 줄이기**를 누르면 형제 앱 [ImageZip](https://github.com/homebox78)으로 넘겨 처리(미설치 시 설치 안내).

> 모든 처리는 PC 내부(로컬)에서만 이루어집니다.

---

## ⌨ 단축키

알씨(ALSee)에 익숙한 조작을 그대로 반영했습니다.

| 키 / 마우스 | 기능 | 키 / 마우스 | 기능 |
|---|---|---|---|
| `←` `→` · `Space` `Backspace` | 이전/다음 이미지 | `Home` `End` | 처음/마지막 |
| `휠` (단독뷰) | 이전/다음 이미지 | `Ctrl+휠` | 확대/축소 |
| `+` `-` | 확대/축소 | `0` / `1` | 창 맞춤 / 원본 100% |
| 이미지 **더블클릭** | 목록으로 | `Esc` `Enter` | 목록으로 |
| 확대 후 **드래그** | 이미지 이동(팬) | `Del` | 삭제(휴지통) |
| `Ctrl+.` / `Ctrl+,` | 오른쪽/왼쪽 회전 | `Ctrl+R` `Ctrl+E` | 크기변경 / 포맷변환 |
| 트리 폴더 **더블클릭** | 하위 폴더 펼침/접힘 | `F2` | 이름변경 |

> 그리드에서 클릭=미리보기, 더블클릭/`Enter`=크게보기. 창 최대화/최소화/닫기는 창 우측 상단 기본 버튼 사용.

---

## 🖥 실행 (개발)

```bash
npm install
npm start
```

## 📦 설치 파일(.exe) 빌드

```bash
npm run dist
```

`dist/ImgView-Install-<버전>.exe` 가 생성됩니다 (한국어 NSIS 설치 마법사).

---

## 🛠 기술 스택

- **Electron 42** — 데스크톱 셸 (메인/프리로드/렌더러 분리, contextIsolation)
- **Canvas API** — 회전·리사이즈·포맷 인코딩, `createImageBitmap` 기반 썸네일
- **electron-builder** — Windows NSIS 인스톨러 (한국어, 파일 연결)
- **Pretendard** — UI 글꼴 (로컬 내장 woff2)

---

## 📁 폴더 구조

```
ImgView/
├─ main.js                  # Electron 메인 프로세스
│                           #  - 창 생성, 단일 인스턴스, 실행 인자/우클릭 이미지 수신
│                           #  - IPC(파일): open-files / open-folder / load-folder / list-dir
│                           #         save-overwrite(원본 백업) / save-files
│                           #         rename-file / delete-file(휴지통) / show-in-folder
│                           #  - IPC(드라이브·네트워크): list-drives / list-network / list-shares
│                           #  - IPC(연동): imgzip-info / open-in-imgzip / open-external
├─ preload.js               # contextBridge로 렌더러에 안전한 imgview API 노출
├─ index.html               # 전체 UI + 뷰어/편집/트리 로직 (단일 파일)
│                           #  - 폴더 트리 · 바둑판/자세히 목록 · 우측 미리보기 · 단독 뷰
│                           #  - 지연 썸네일(IntersectionObserver), 캔버스 편집
│                           #  - 커스텀 셀렉트/이름변경 다이얼로그, 밝기 보정, ImageZip 바
├─ package.json             # 메타 + electron-builder(build) 설정
├─ package-lock.json
│
├─ icon.ico / icon.png      # 앱 아이콘
├─ license_ko.txt           # 설치 마법사 이용약관 (UTF-16LE)
│
├─ fonts/
│  └─ PretendardVariable.woff2   # 앱 UI 글꼴
│
├─ build/                   # 설치 마법사 리소스
│  ├─ installer.nsh         #  NSIS 커스텀 스크립트(폰트 임베딩·우클릭 메뉴, 옵션)
│  └─ Pretendard.otf        #  설치 화면 BMP 렌더용 글꼴
├─ installerHeader.bmp      # 설치 마법사 상단 배너 (150×57)
├─ installerSidebar.bmp     # 설치 마법사 좌측 배너 (164×314)
│
└─ run.bat / start.bat      # 개발 실행 보조 스크립트
```

> `node_modules/`(의존성)와 `dist/`(빌드 산출물 — NSIS `.exe` 설치 파일·압축 해제 실행본)는
> git에 포함되지 않습니다. `npm install` / `npm run dist` 로 언제든 다시 생성됩니다.

---

## 📄 라이선스

MIT License.
포함 구성요소: Electron (MIT), Pretendard (SIL Open Font License 1.1).
