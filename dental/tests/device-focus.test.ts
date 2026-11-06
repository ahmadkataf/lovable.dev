// Two small platform contracts: the device id the licence is bound to (the Windows and Android shells are asked,
// never replaced by a random id), and what a dialog focuses when it opens (no on-screen keyboard on touch screens).
import { DEVICE_ID_RETRY_MS, DeviceIdError, isDeviceIdError, rawDeviceId } from '../src/platform'
import { dialogFocusTarget } from '../src/ui/Overlay'
import { isTextEntry } from '../src/app/keyboard'

const w = window as any
const SHELL_KEY = 'dentora.device.shell'

describe('device id in the Windows and Android apps', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { delete w.dentora; delete w.DentoraAndroid; localStorage.clear() })

  it('comes from the shell and is remembered', async () => {
    w.dentora = { platform: 'electron', deviceId: async () => 'machine-42', appVersion: async () => '' }
    expect(await rawDeviceId()).toBe('machine-42')
    expect(localStorage.getItem(SHELL_KEY)).toBe('machine-42')
    expect(localStorage.getItem('dentora.device')).toBeNull()             // no random id is made
  })
  it('asks the shell once more when it throws or answers empty', async () => {
    let n = 0
    w.dentora = { platform: 'electron', deviceId: async () => { n++; if (n === 1) throw new Error('ipc'); return 'machine-42' }, appVersion: async () => '' }
    const t0 = Date.now()
    expect(await rawDeviceId()).toBe('machine-42')
    expect(n).toBe(2)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(DEVICE_ID_RETRY_MS - 50)
    let m = 0
    w.dentora = undefined
    w.DentoraAndroid = { deviceId: () => (++m === 1 ? '' : 'a1b2c3d4e5f60789'), appVersion: () => '' }
    expect(await rawDeviceId()).toBe('a1b2c3d4e5f60789')
    expect(m).toBe(2)
  })
  it('uses the last id the shell gave when it keeps failing, so an activated clinic stays activated', async () => {
    localStorage.setItem(SHELL_KEY, 'a1b2c3d4e5f60789')
    w.DentoraAndroid = { deviceId: () => { throw new Error('gone') }, appVersion: () => '' }
    expect(await rawDeviceId()).toBe('a1b2c3d4e5f60789')
  })
  it('reports an error instead of making up an id when the shell never answered on this device', async () => {
    w.dentora = { platform: 'electron', deviceId: async () => '', appVersion: async () => '' }
    const e = await rawDeviceId().then(() => null, err => err)
    expect(e).toBeInstanceOf(DeviceIdError)
    expect(isDeviceIdError(e)).toBe(true)
    expect(localStorage.getItem('dentora.device')).toBeNull()
    expect(localStorage.getItem(SHELL_KEY)).toBeNull()
  })
  it('in a browser, keeps one random id per browser', async () => {
    const a = await rawDeviceId()
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(await rawDeviceId()).toBe(a)
  })
})

describe('what a dialog focuses when it opens', () => {
  let root: HTMLElement
  beforeEach(() => {
    document.body.innerHTML = ''
    root = document.createElement('div')
    root.tabIndex = -1
    root.innerHTML = '<button class="modal-x">x</button><select><option>a</option></select><input type="checkbox"><input type="text" id="name"><textarea></textarea><button id="ok">ok</button>'
    document.body.appendChild(root)
  })
  const by = (sel: string) => root.querySelector<HTMLElement>(sel)!

  it('with a mouse: the first text field, ready for typing', () => {
    expect(dialogFocusTarget(root, false)).toBe(by('#name'))
  })
  it('on a touch screen: the dialog itself, so the keyboard does not come up', () => {
    expect(dialogFocusTarget(root, true)).toBe(root)
    by('#name').focus()                                     // a field that grabbed the focus (React autoFocus) does not keep it
    expect(dialogFocusTarget(root, true)).toBe(root)
    by('#ok').focus()                                       // a button that took it (a confirmation) keeps it
    expect(dialogFocusTarget(root, true)).toBe(by('#ok'))
  })
  it('[data-autofocus] wins everywhere, a text field included', () => {
    by('textarea').setAttribute('data-autofocus', '')
    expect(dialogFocusTarget(root, true)).toBe(by('textarea'))
    expect(dialogFocusTarget(root, false)).toBe(by('textarea'))
  })
  it('knows which controls raise the keyboard', () => {
    expect(isTextEntry(by('#name'))).toBe(true)
    expect(isTextEntry(by('textarea'))).toBe(true)
    expect(isTextEntry(by('input[type=checkbox]'))).toBe(false)
    expect(isTextEntry(by('select'))).toBe(false)
    expect(isTextEntry(by('#ok'))).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})
