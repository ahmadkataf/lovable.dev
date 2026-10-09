// PLACEHOLDER — replaced by the real client (docs/LICENSE-SPEC.md). Demo mode: everything is open.
import type { LicenseStatus, SellerInfo } from './types'

const demo: LicenseStatus = { state: 'demo', deviceCode: 'DEMO-MODE', checking: false, online: true, info: { price: '35$', whatsapp: '', trialDays: 7 } }
const listeners = new Set<(s: LicenseStatus) => void>()

export const license = {
  async init(): Promise<LicenseStatus> { return demo },
  get(): LicenseStatus { return demo },
  subscribe(cb: (s: LicenseStatus) => void): () => void { listeners.add(cb); return () => { listeners.delete(cb) } },
  async activate(_code: string): Promise<LicenseStatus> { return demo },
  async startTrial(): Promise<LicenseStatus> { return demo },
  async check(): Promise<LicenseStatus> { return demo },
  async release(): Promise<LicenseStatus> { return demo },
  async fetchInfo(): Promise<SellerInfo> { return demo.info! },
}
