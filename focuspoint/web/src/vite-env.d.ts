/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
}

// Chrome's install prompt event (not in lib.dom yet).
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}
