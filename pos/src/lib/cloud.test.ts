import { describe, it, expect } from 'vitest'
import { gzipText, gunzipText, shouldAutoBackup, cloudState, CLOUD_EVERY } from './cloud'
import type { LicenseStatus } from '../license/types'

const base: LicenseStatus = { state: 'active', deviceCode: 'AAAA-BBBB', checking: false, online: true }

describe('cloud', () => {
  it('compresses and restores text', async () => {
    const text = JSON.stringify({ app: 'kaseb', rows: Array.from({ length: 500 }, (_, i) => ({ i, name: 'منتج ' + i })) })
    const gz = await gzipText(text)
    expect(gz[0]).toBe(0x1f); expect(gz[1]).toBe(0x8b)
    expect(gz.length).toBeLessThan(text.length / 3)
    expect(await gunzipText(gz)).toBe(text)
  })
  it('uploads once a day when the plan is active and the switch is on', () => {
    const now = 1_800_000_000_000
    expect(shouldAutoBackup(null, true, true, now)).toBe(true)
    expect(shouldAutoBackup(now - CLOUD_EVERY + 1000, true, true, now)).toBe(false)
    expect(shouldAutoBackup(now - CLOUD_EVERY - 1, true, true, now)).toBe(true)
    expect(shouldAutoBackup(null, false, true, now)).toBe(false)
    expect(shouldAutoBackup(null, true, false, now)).toBe(false)
  })
  it('derives the cloud state from the license', () => {
    const now = 1_800_000_000_000
    expect(cloudState({ ...base, state: 'demo' }, now)).toBe('demo')
    expect(cloudState({ ...base, state: 'trial' }, now)).toBe('unlicensed')
    expect(cloudState(base, now)).toBe('none')
    expect(cloudState({ ...base, cloudUntil: now + 1 }, now)).toBe('active')
    expect(cloudState({ ...base, cloudUntil: now - 1 }, now)).toBe('expired')
  })
})
