; Glyde installer for Windows (built with NSIS on Linux during the build, see post-package-windows.sh).
;
; It makes Glyde a proper Windows app: installs to the user's own program folder (no administrator
; prompt, and the in-browser updater can write there), adds a Start menu entry and an optional desktop
; shortcut, lists Glyde in Settings > Apps so it can be uninstalled, and registers it so it can be
; chosen as the default browser.
;
; Build:  makensis -DVERSION=0.1.0 -DSRCDIR=/path/to/glyde -DICON=/path/to/glyde.ico \
;                  -DART=/path/to/art -DOUTFILE=/path/to/glyde-windows-x86_64-setup.exe glyde.nsi

Unicode true
!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef SRCDIR
  !error "Pass -DSRCDIR=<folder that contains glyde.exe>"
!endif

!define NAME "Glyde"
!define PUBLISHER "Cirkle Development Group"
!define EXE "glyde.exe"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Glyde"
!define CLIENTKEY "Software\Clients\StartMenuInternet\Glyde"

Name "${NAME}"
BrandingText "${NAME} ${VERSION}"
!ifdef OUTFILE
  OutFile "${OUTFILE}"
!else
  OutFile "glyde-setup.exe"
!endif
InstallDir "$LOCALAPPDATA\Programs\Glyde"
InstallDirRegKey HKCU "${UNINSTKEY}" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails nevershow
ShowUninstDetails nevershow

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${NAME}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "FileDescription" "${NAME} installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "${PUBLISHER}"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!ifdef ICON
  !define MUI_ICON "${ICON}"
  !define MUI_UNICON "${ICON}"
!endif
!ifdef ART
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${ART}/side.bmp"
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${ART}/side.bmp"
!endif
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to Glyde"
!define MUI_WELCOMEPAGE_TEXT "This installs Glyde ${VERSION} on your computer. It does not need administrator rights.$\r$\n$\r$\nGlyde is built on Mozilla open source technology and is not officially associated with Mozilla or its products."
!define MUI_FINISHPAGE_TITLE "Glyde is installed"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Open Glyde now"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Add a shortcut to my desktop"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION DesktopShortcut

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; Stop if Glyde is running: its files are locked and would be left half replaced.
Function CheckNotRunning
  retry:
  ClearErrors
  IfFileExists "$INSTDIR\${EXE}" 0 done
  FileOpen $0 "$INSTDIR\${EXE}" a
  IfErrors locked
  FileClose $0
  Goto done
  locked:
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Glyde is running. Please close all Glyde windows, then choose Retry." IDRETRY retry
  Abort
  done:
FunctionEnd

Function .onInit
  ; A second copy of the installer cannot run at the same time.
  System::Call 'kernel32::CreateMutex(p 0, i 0, t "GlydeSetupMutex") p .r1 ?e'
  Pop $R0
  StrCmp $R0 0 +3
  MessageBox MB_OK|MB_ICONEXCLAMATION "The Glyde installer is already running."
  Abort
FunctionEnd

Function DesktopShortcut
  CreateShortCut "$DESKTOP\${NAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
FunctionEnd

Section "Glyde" SecMain
  SectionIn RO
  Call CheckNotRunning
  SetOutPath "$INSTDIR"
  File /r "${SRCDIR}/*.*"
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Start menu entry (this is what makes Glyde searchable and pinnable like any other app)
  CreateShortCut "$SMPROGRAMS\${NAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0

  ; Settings > Apps > Installed apps
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${NAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegStr HKCU "${UNINSTKEY}" "URLInfoAbout" "https://glyde.teamcirkle.co.uk"
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "$0"

  ; Lets Glyde appear in Settings > Default apps
  WriteRegStr HKCU "${CLIENTKEY}" "" "${NAME}"
  WriteRegStr HKCU "${CLIENTKEY}\DefaultIcon" "" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${CLIENTKEY}\shell\open\command" "" '"$INSTDIR\${EXE}"'
  WriteRegStr HKCU "${CLIENTKEY}\Capabilities" "ApplicationName" "${NAME}"
  WriteRegStr HKCU "${CLIENTKEY}\Capabilities" "ApplicationDescription" "A fast, private web browser."
  WriteRegStr HKCU "${CLIENTKEY}\Capabilities" "ApplicationIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${CLIENTKEY}\Capabilities\URLAssociations" "http" "GlydeURL"
  WriteRegStr HKCU "${CLIENTKEY}\Capabilities\URLAssociations" "https" "GlydeURL"
  WriteRegStr HKCU "${CLIENTKEY}\Capabilities\FileAssociations" ".htm" "GlydeHTML"
  WriteRegStr HKCU "${CLIENTKEY}\Capabilities\FileAssociations" ".html" "GlydeHTML"
  WriteRegStr HKCU "Software\RegisteredApplications" "${NAME}" "${CLIENTKEY}\Capabilities"
  WriteRegStr HKCU "Software\Classes\GlydeURL" "" "Glyde URL"
  WriteRegStr HKCU "Software\Classes\GlydeURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\GlydeURL\DefaultIcon" "" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "Software\Classes\GlydeURL\shell\open\command" "" '"$INSTDIR\${EXE}" -osint -url "%1"'
  WriteRegStr HKCU "Software\Classes\GlydeHTML" "" "Glyde HTML Document"
  WriteRegStr HKCU "Software\Classes\GlydeHTML\DefaultIcon" "" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "Software\Classes\GlydeHTML\shell\open\command" "" '"$INSTDIR\${EXE}" -osint -url "%1"'
SectionEnd

Function un.onInit
  retry:
  ClearErrors
  IfFileExists "$INSTDIR\${EXE}" 0 done
  FileOpen $0 "$INSTDIR\${EXE}" a
  IfErrors locked
  FileClose $0
  Goto done
  locked:
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Glyde is running. Please close all Glyde windows, then choose Retry." IDRETRY retry
  Abort
  done:
FunctionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\${NAME}.lnk"
  Delete "$DESKTOP\${NAME}.lnk"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "${CLIENTKEY}"
  DeleteRegValue HKCU "Software\RegisteredApplications" "${NAME}"
  DeleteRegKey HKCU "Software\Classes\GlydeURL"
  DeleteRegKey HKCU "Software\Classes\GlydeHTML"
  ; Your bookmarks, history and settings live in your profile folder and are left alone.
  RMDir /r "$INSTDIR"
SectionEnd
