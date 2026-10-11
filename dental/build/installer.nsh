; Dentora — additions to electron-builder's NSIS installer (electron-builder.yml → nsis.include).
; This file is UTF-8 (makensis runs with -INPUTCHARSET UTF8).

; ---- per-user install, no "who should this be installed for?" page -------------------------------------------------
; Dentora installs for the current Windows user only: into %LOCALAPPDATA%\Programs\Dentora, without administrator
; rights or a UAC prompt, next to the clinic's data in %APPDATA%\Dentora, which belongs to the same user. The page that
; asked "all users / only for me" is skipped (it existed only in English, and "all users" needs an administrator).
; An "all users" installation made earlier (Dentora 1.0 offered it) is updated, or removed, where it is, so a clinic never
; ends up with two copies.
!macro customInstallMode
  ${if} $hasPerMachineInstallation == "1"
  ${andIf} $hasPerUserInstallation == "0"
    StrCpy $isForceMachineInstall "1"
  ${else}
    StrCpy $isForceCurrentInstall "1"
  ${endIf}
!macroend

; ---- Arabic for the few installer messages electron-builder has only in English ---------------------------------------
; (the buttons and the standard pages come from NSIS's own Arabic language file). Each replaces the English fallback
; electron-builder defined for Arabic (1025). NSIS reports a second definition (warning 6030) when it builds its string
; tables at the end of the script, so the warning stays off from here on; it concerns only redefined LangStrings.
!pragma warning disable 6030
LangString installing 1025 "جارٍ تثبيت ${PRODUCT_NAME}، يُرجى الانتظار…"
LangString appClosing 1025 "جارٍ إغلاق ${PRODUCT_NAME}…"
LangString areYouSureToUninstall 1025 "هل تريد إزالة ${PRODUCT_NAME} من هذا الحاسوب؟ بيانات العيادة لا تُحذف."
LangString win7Required 1025 "يحتاج ${PRODUCT_NAME} إلى Windows 7 أو أحدث."
LangString x64WinRequired 1025 "يحتاج ${PRODUCT_NAME} إلى نسخة Windows بنظام 64 بت."
