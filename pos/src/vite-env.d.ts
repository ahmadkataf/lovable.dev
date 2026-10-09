/// <reference types="vite/client" />

declare const __POS_API__: string
declare const __POS_PUBLIC_KEY__: string
declare const __POS_VERSION__: string
declare const __POS_BUILD__: string

/** What the Electron preload script puts on the page (electron/preload.cjs). */
interface PosElectronBridge {
  platform: 'electron'
  version: string
  deviceId(): Promise<string>
  deviceName(): Promise<string>
  /** Saves a file through the system "Save as" dialog. `data` is base64 when `base64` is true, else UTF-8 text. */
  saveFile(name: string, mime: string, data: string, base64?: boolean): Promise<boolean>
  /** Prints an HTML document (a receipt). `printer` empty = the default printer; `silent` skips the dialog. */
  print(html: string, opts: { printer?: string; silent?: boolean; widthMm?: number; copies?: number }): Promise<boolean>
  getPrinters(): Promise<{ name: string; isDefault: boolean }[]>
  /** The license token, kept outside the page (encrypted with the OS keychain). */
  licenseGet(): Promise<string | null>
  licenseSet(value: string | null): Promise<void>
  openExternal(url: string): Promise<void>
  /** Fullscreen / kiosk toggles for the cashier screen. */
  setFullscreen(on: boolean): Promise<void>
  /** A random id that changes when the app files are modified (asar integrity is enforced by Electron fuses). */
  appSignature(): Promise<string>
}

/** What the Android shell puts on the page (android/src/.../MainActivity.java). All calls are synchronous. */
interface PosAndroidBridge {
  deviceId(): string
  deviceName(): string
  /** SHA-256 of the APK signing certificate, hex. */
  signature(): string
  version(): string
  /** Opens the system "create document" picker and writes the file. base64 content. */
  saveFile(name: string, mime: string, base64: string): void
  /** Prints an HTML document through the Android print framework (system print dialog). */
  print(html: string): void
  /** Shares plain text with another app (WhatsApp, a Bluetooth printer app...). */
  share(text: string): void
  licenseGet(): string
  licenseSet(value: string): void
  openUrl(url: string): void
  /** Vibrates for `ms` milliseconds. */
  vibrate(ms: number): void
  /** Keeps the screen on while the cashier works. */
  keepScreenOn(on: boolean): void
}

interface Window {
  pos?: PosElectronBridge
  PosAndroid?: PosAndroidBridge
  /** Called by the Android shell when a file saved through saveFile() finished (ok) or was cancelled. */
  onPosFileSaved?: (ok: boolean) => void
}

declare module '*.svg' { const src: string; export default src }
declare module '*.png' { const src: string; export default src }
