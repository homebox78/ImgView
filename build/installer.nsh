; 설치 마법사 글꼴을 Pretendard로 (설치 중에만 임시 등록)

!macro customHeader
  !define MUI_FONT "Pretendard"
  !define MUI_FONTSIZE 9
!macroend

; 설치 프로그램 초기화 시 Pretendard 임시 등록 (FR_PRIVATE)
!macro customInit
  InitPluginsDir
  File "/oname=$PLUGINSDIR\Pretendard.otf" "${BUILD_RESOURCES_DIR}\Pretendard.otf"
  System::Call 'gdi32::AddFontResourceExW(w "$PLUGINSDIR\Pretendard.otf", i 0x10, i 0) i .r0'
!macroend

; 제거 프로그램에서도 동일 적용
!macro customUnInit
  InitPluginsDir
  File "/oname=$PLUGINSDIR\Pretendard.otf" "${BUILD_RESOURCES_DIR}\Pretendard.otf"
  System::Call 'gdi32::AddFontResourceExW(w "$PLUGINSDIR\Pretendard.otf", i 0x10, i 0) i .r0'
!macroend

; 이미지 확장자별 우클릭 "ImgView로 보기" 등록/해제 매크로
; SystemFileAssociations 아래에 verb 만 추가 → 기존 연결/탐색기 썸네일을 건드리지 않음
!macro RegImgVerb EXT
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\ImgViewOpen" "" "ImgView로 보기"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\ImgViewOpen" "Icon" "$INSTDIR\ImgView.exe,0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\ImgViewOpen\command" "" '"$INSTDIR\ImgView.exe" "%1"'
!macroend
!macro DelImgVerb EXT
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${EXT}\shell\ImgViewOpen"
!macroend

; 설치 시: 우클릭 "ImgView로 보기" 메뉴 등록 (현재 사용자, HKCU)
!macro customInstall
  !insertmacro RegImgVerb ".jpg"
  !insertmacro RegImgVerb ".jpeg"
  !insertmacro RegImgVerb ".png"
  !insertmacro RegImgVerb ".gif"
  !insertmacro RegImgVerb ".webp"
  !insertmacro RegImgVerb ".bmp"
  !insertmacro RegImgVerb ".svg"
  !insertmacro RegImgVerb ".tif"
  !insertmacro RegImgVerb ".tiff"
  !insertmacro RegImgVerb ".ico"
  ; 폴더 우클릭
  WriteRegStr HKCU "Software\Classes\Directory\shell\ImgViewOpen" "" "ImgView로 폴더 보기"
  WriteRegStr HKCU "Software\Classes\Directory\shell\ImgViewOpen" "Icon" "$INSTDIR\ImgView.exe,0"
  WriteRegStr HKCU "Software\Classes\Directory\shell\ImgViewOpen\command" "" '"$INSTDIR\ImgView.exe" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

; 제거 시: 우클릭 메뉴 제거
!macro customUnInstall
  !insertmacro DelImgVerb ".jpg"
  !insertmacro DelImgVerb ".jpeg"
  !insertmacro DelImgVerb ".png"
  !insertmacro DelImgVerb ".gif"
  !insertmacro DelImgVerb ".webp"
  !insertmacro DelImgVerb ".bmp"
  !insertmacro DelImgVerb ".svg"
  !insertmacro DelImgVerb ".tif"
  !insertmacro DelImgVerb ".tiff"
  !insertmacro DelImgVerb ".ico"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\ImgViewOpen"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
