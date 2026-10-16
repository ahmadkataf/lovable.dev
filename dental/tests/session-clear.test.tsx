// "Delete all data" signs the user out for good: the session provider must not write the old user back when the page
// is hidden or unloaded right after (the app reloads into the setup wizard), so nobody is signed in without a PIN.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { db, resetDatabase } from '../src/db'
import { hashPin } from '../src/lib/crypto'
import { SessionProvider, clearSession, useSession, type Session } from '../src/app/session'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const KEY = 'dentora.session'
const stored = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null')?.id ?? null } catch { return null } }
const setHidden = (hidden: boolean) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })

describe('clearSession()', () => {
  let current: Session | null = null
  function Probe() { current = useSession(); return null }
  const until = async (cond: () => boolean) => { for (let i = 0; i < 100 && !cond(); i++) await act(() => new Promise(r => setTimeout(r, 20))) }

  beforeEach(async () => {
    await resetDatabase(); sessionStorage.clear(); localStorage.clear(); setHidden(false)
    const now = new Date().toISOString()
    await db.users.put({ id: 'u-admin', name: 'مدير', role: 'admin', pinSalt: 's', pinHash: await hashPin('1234', 's', 1000), color: '#000', active: true, createdAt: now, updatedAt: now })
  })
  afterEach(() => setHidden(false))

  it('signs out in memory and in storage, and the provider cannot write the old user back', async () => {
    const host = document.createElement('div'); document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => { root.render(<SessionProvider><Probe /></SessionProvider>) })
    await until(() => !!current?.ready)
    let ok = false
    await act(async () => { ok = await current!.login('u-admin', '1234') })
    expect(ok).toBe(true)
    await until(() => current?.user?.id === 'u-admin')
    expect(stored()).toBe('u-admin')

    await act(async () => { clearSession() })
    await until(() => current?.user === null)
    expect(current!.user).toBeNull()
    expect(stored()).toBeNull()
    // the page is hidden / unloaded (the reload after the wipe): nothing is written back
    setHidden(true)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    window.dispatchEvent(new Event('pointerdown'))
    expect(stored()).toBeNull()

    // a real sign-in afterwards works as usual
    setHidden(false)
    await act(async () => { ok = await current!.login('u-admin', '1234') })
    expect(ok).toBe(true)
    expect(stored()).toBe('u-admin')
    await act(async () => { root.unmount() })
    host.remove()
  })
})
