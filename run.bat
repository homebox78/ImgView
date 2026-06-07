@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo [ImgView] 최초 실행 - 의존성 설치 중...
  call npm install
)
echo [ImgView] 실행합니다...
call npm start
