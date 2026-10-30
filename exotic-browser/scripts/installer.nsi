; ============================================================================
; Exotic Browser for Windows 11 — NSIS Modern UI 2 Offline Setup
; Monochrome #000000 & #FFFFFF · Non-Bold Clean Interface
; ============================================================================

Unicode True
SetCompressor /SOLID lzma
SetCompressorDictSize 32

!include "MUI2.nsh"

!define APP_NAME        "Exotic"
!define APP_EXE         "Exotic.exe"
!define APP_VERSION     "2.0.0.159"
!define APP_PUBLISHER   "Exotic"
!define UNINST_KEY      "Software\Microsoft\Windows\CurrentVersion\Uninstall\ExoticBrowser"

!ifndef OUT_FILE
!define OUT_FILE "${ROOT_DIR}/releases/Exotic-Win11-Setup-x64.exe"
!endif

Name "${APP_NAME}"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Exotic"
InstallDirRegKey HKCU "Software\ExoticBrowser" "Install_Dir"
RequestExecutionLevel user
BrandingText "Exotic Browser for Windows 11 (64-bit)"

; --- Monochrome Modern UI 2 Branding ---
!define MUI_ABORTWARNING
!define MUI_ICON "${ROOT_DIR}/assets/exotic.ico"
!define MUI_UNICON "${ROOT_DIR}/assets/exotic.ico"
!define MUI_BGCOLOR "FFFFFF"
!define MUI_TEXTCOLOR "000000"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${ROOT_DIR}/assets/installer-header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${ROOT_DIR}/assets/installer-sidebar.bmp"

!define MUI_WELCOMEPAGE_TITLE "Install Exotic Browser"
!define MUI_WELCOMEPAGE_TEXT "This installer will set up Exotic Browser (64-bit) on your computer.$\r$\n$\r$\nFeatures:$\r$\n - Vertical sidebar with workspaces and pinned shortcuts$\r$\n - Centered floating address bar and side-by-side split view$\r$\n - Clean Dark (#000000) and Light (#FFFFFF) themes$\r$\n - Built-in Exotic Mods and tracking protection$\r$\n$\r$\nClick Next to choose an installation folder."

!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open Exotic Browser"

; --- Pages ---
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; --- PE Metadata ---
VIProductVersion "2.0.0.159"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "Exotic Setup"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "Exotic Browser Installer for Windows 11 (x64)"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "Exotic (MPL 2.0)"

Section "Exotic Browser" SecCore
  SectionIn RO

  ; Close any running Exotic / engine instances so runtime DLLs & omni.ja replace cleanly
  nsExec::ExecToLog 'taskkill /F /IM Exotic.exe /T'
  nsExec::ExecToLog 'taskkill /F /IM firefox.exe /T'
  Sleep 400
  RMDir /r "$LOCALAPPDATA\ExoticBrowser\Profile\startupCache"

  SetOutPath "$INSTDIR"
  File /r "${STAGE_DIR}\*.*"

  WriteRegStr HKCU "Software\ExoticBrowser" "Install_Dir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Start Menu & Desktop Shortcuts
  CreateDirectory "$SMPROGRAMS\Exotic"
  CreateShortcut "$SMPROGRAMS\Exotic\Exotic.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut "$SMPROGRAMS\Exotic\Uninstall Exotic.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\Exotic.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Windows 11 Installed Apps Registration
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "Exotic"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Exotic.lnk"
  RMDir /r "$SMPROGRAMS\Exotic"
  RMDir /r "$INSTDIR\runtime"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\README-WIN11.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\ExoticBrowser"
SectionEnd
