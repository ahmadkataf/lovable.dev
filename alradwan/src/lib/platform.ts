// Where the app runs: the website, the Windows app (Electron) or the Android app (WebView with a small bridge).
declare global {
  interface Window {
    GarageAndroid?: {
      saveFile(name: string, mime: string, base64: string): void
      print(): void
      deviceId(): string
    }
    garageDesktop?: {
      saveFile(name: string, base64: string): Promise<boolean>
      print(): void
      autoBackup(name: string, text: string): Promise<boolean>
      listBackups(): Promise<{ name: string; size: number; mtime: number }[]>
      readBackup(name: string): Promise<string | null>
      backupsFolder(): Promise<string>
    }
  }
}

export const isAndroid = () => typeof window !== 'undefined' && !!window.GarageAndroid
export const isDesktop = () => typeof window !== 'undefined' && !!window.garageDesktop
export const platformName = () => (isAndroid() ? 'android' : isDesktop() ? 'windows' : 'web')

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Hands a file to the user: a download on the web, the share sheet on Android, a save dialog on Windows. */
export async function saveFile(name: string, data: Blob | string, mime = 'application/octet-stream'): Promise<void> {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data
  if (window.GarageAndroid) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    window.GarageAndroid.saveFile(name, blob.type || mime, toBase64(bytes))
    return
  }
  if (window.garageDesktop) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    await window.garageDesktop.saveFile(name, toBase64(bytes))
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export function printPage(): void {
  if (window.GarageAndroid) { window.GarageAndroid.print(); return }
  if (window.garageDesktop) { window.garageDesktop.print(); return }
  window.print()
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    // some WebViews never fire change when the picker is cancelled
    window.addEventListener('focus', () => setTimeout(() => resolve(input.files?.[0] ?? null), 800), { once: true })
    input.click()
  })
}
