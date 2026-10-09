// The camera barcode scanner: a full-screen modal with a live preview, a viewfinder, torch and camera switch.
// Engine: the browser's BarcodeDetector when it exists (Android Chrome / WebView), otherwise ZXing loaded lazily.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, CameraOff, Zap, ZapOff, SwitchCamera, ShieldAlert, Keyboard, RefreshCw, Check, PauseCircle, Lock } from 'lucide-react'
import type { BrowserMultiFormatReader } from '@zxing/browser'
import { Modal, Button, Input } from './ui'
import { addMessages, useT } from '../i18n'
import { beep } from '../lib/audio'
import { platform } from '../lib/platform'
import { cleanBarcode } from '../lib/barcode'

addMessages({
  ar: {
    'scanner.title': 'مسح باركود',
    'scanner.hint': 'وجّه الكاميرا نحو الباركود',
    'scanner.starting': 'جارٍ تشغيل الكاميرا…',
    'scanner.paused': 'الكاميرا متوقفة مؤقتاً',
    'scanner.resume': 'متابعة',
    'scanner.retry': 'إعادة المحاولة',
    'scanner.torch': 'الفلاش',
    'scanner.switch': 'تبديل الكاميرا',
    'scanner.manual': 'أدخل الباركود يدوياً',
    'scanner.manualGo': 'إدخال',
    'scanner.readCount': 'تمت القراءة: {n}',
    'scanner.last': 'آخر قراءة',
    'scanner.done': 'تم',
    'scanner.err.noCamera': 'لا توجد كاميرا',
    'scanner.err.noCameraHelp': 'لم نجد كاميرا على هذا الجهاز. يمكنك إدخال الباركود يدوياً في الأسفل أو استخدام قارئ باركود خارجي.',
    'scanner.err.denied': 'لم يُسمح باستخدام الكاميرا',
    'scanner.err.deniedHelpAndroid': 'افتح إعدادات الهاتف ← التطبيقات ← كاشير ← الأذونات ← الكاميرا، واختر «السماح»، ثم ارجع إلى هنا واضغط إعادة المحاولة.',
    'scanner.err.deniedHelpDesktop': 'اسمح للتطبيق باستخدام الكاميرا: من إعدادات ويندوز ← الخصوصية والأمان ← الكاميرا، أو من رمز القفل بجانب عنوان الصفحة ← الكاميرا ← سماح. ثم اضغط إعادة المحاولة.',
    'scanner.err.insecure': 'الكاميرا تحتاج اتصالاً آمناً',
    'scanner.err.insecureHelp': 'المسح بالكاميرا يعمل فقط عبر https أو من داخل التطبيق. استخدم الإدخال اليدوي أو قارئ باركود خارجي.',
    'scanner.err.busy': 'الكاميرا مشغولة',
    'scanner.err.busyHelp': 'تطبيق آخر يستخدم الكاميرا الآن. أغلقه ثم اضغط إعادة المحاولة.',
    'scanner.err.unknown': 'تعذّر تشغيل الكاميرا',
    'scanner.err.unknownHelp': 'حاول مرة أخرى، أو أدخل الباركود يدوياً في الأسفل.',
  },
  en: {
    'scanner.title': 'Scan barcode',
    'scanner.hint': 'Point the camera at the barcode',
    'scanner.starting': 'Starting the camera…',
    'scanner.paused': 'Camera paused',
    'scanner.resume': 'Resume',
    'scanner.retry': 'Try again',
    'scanner.torch': 'Torch',
    'scanner.switch': 'Switch camera',
    'scanner.manual': 'Type the barcode',
    'scanner.manualGo': 'Enter',
    'scanner.readCount': 'Scanned: {n}',
    'scanner.last': 'Last read',
    'scanner.done': 'Done',
    'scanner.err.noCamera': 'No camera found',
    'scanner.err.noCameraHelp': 'This device has no camera we can use. Type the barcode below or use a USB/Bluetooth scanner.',
    'scanner.err.denied': 'Camera access was denied',
    'scanner.err.deniedHelpAndroid': 'Open the phone Settings → Apps → Kasher → Permissions → Camera and choose "Allow", then come back and tap Try again.',
    'scanner.err.deniedHelpDesktop': 'Allow the camera: Windows Settings → Privacy & security → Camera, or the lock icon next to the page address → Camera → Allow. Then press Try again.',
    'scanner.err.insecure': 'The camera needs a secure connection',
    'scanner.err.insecureHelp': 'Camera scanning only works over https or inside the app. Type the barcode or use an external scanner.',
    'scanner.err.busy': 'The camera is busy',
    'scanner.err.busyHelp': 'Another app is using the camera. Close it, then press Try again.',
    'scanner.err.unknown': 'Could not start the camera',
    'scanner.err.unknownHelp': 'Try again, or type the barcode below.',
  },
})

export interface ScannerModalProps {
  open: boolean
  onClose: () => void
  /** Called for every code read. Return false to keep scanning after a code, true (or nothing) to close. */
  onScan: (code: string) => boolean | void | Promise<boolean | void>
  /** Keep the camera open and read many codes in a row (the sales screen). */
  continuous?: boolean
  title?: string
}

type ScanError = 'noCamera' | 'denied' | 'insecure' | 'busy' | 'unknown'
type Status = 'idle' | 'starting' | 'running' | 'paused' | 'error'

interface DetectedBarcode { rawValue: string; format: string }
interface BarcodeDetectorLike { detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<DetectedBarcode[]> }
interface BarcodeDetectorCtor { new (opts?: { formats: string[] }): BarcodeDetectorLike; getSupportedFormats?: () => Promise<string[]> }
interface ExtraCapabilities { torch?: boolean; focusMode?: string[] }

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix']
const DEDUPE_MS = 1500
const FRAME_MS = 80
const MAX_SIDE = 1280

/** The ZXing reader, loaded on first use so the main bundle stays small. */
let zxingPromise: Promise<BrowserMultiFormatReader> | null = null
function loadZxing(): Promise<BrowserMultiFormatReader> {
  if (!zxingPromise) {
    zxingPromise = (async () => {
      const [{ BrowserMultiFormatReader: Reader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
      const hints = new Map<unknown, unknown>()
      hints.set(DecodeHintType.TRY_HARDER, true)
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93, BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX,
      ])
      return new Reader(hints as Map<never, never>, { delayBetweenScanAttempts: FRAME_MS, delayBetweenScanSuccess: 300 })
    })().catch(e => { zxingPromise = null; throw e })
  }
  return zxingPromise
}

async function makeNativeDetector(): Promise<BarcodeDetectorLike | null> {
  const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (!BD) return null
  try {
    const supported = BD.getSupportedFormats ? await BD.getSupportedFormats() : NATIVE_FORMATS
    const formats = NATIVE_FORMATS.filter(f => supported.includes(f))
    if (!formats.length) return null
    return new BD({ formats })
  } catch { return null }
}

function mapError(e: unknown): ScanError {
  const name = (e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : '') || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') return 'noCamera'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError' || name === 'SourceUnavailableError') return 'busy'
  return 'unknown'
}

async function getStream(deviceId?: string): Promise<MediaStream> {
  const quality = { width: { ideal: 1280 }, height: { ideal: 720 } }
  const tries: MediaStreamConstraints[] = deviceId
    ? [{ video: { ...quality, deviceId: { exact: deviceId } }, audio: false }, { video: { deviceId: { exact: deviceId } }, audio: false }]
    : [{ video: { ...quality, facingMode: { ideal: 'environment' } }, audio: false }, { video: { facingMode: 'environment' }, audio: false }, { video: true, audio: false }]
  let err: unknown = new Error('camera')
  for (const c of tries) {
    try { return await navigator.mediaDevices.getUserMedia(c) } catch (e) { err = e; if (mapError(e) === 'denied') throw e }
  }
  throw err
}

/* Styles live here so the scanner works wherever it is used, without touching the shared stylesheets. */
const STYLE_ID = 'kasher-scanner-css'
const CSS = `
.scanner-modal .modal-body { padding: 0; display: flex; flex-direction: column; min-height: 0; }
.scanner-modal .modal-head { padding-bottom: 8px; }
.scanner { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.scanner-view { position: relative; flex: 1; min-height: 300px; background: #0b1220; overflow: hidden; display: flex; align-items: center; justify-content: center; }
@media (min-width: 900px) { .scanner-view { min-height: 380px; max-height: 60vh; aspect-ratio: 4 / 3; flex: none; } }
.scanner-view video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.scanner-frame { position: absolute; width: min(78%, 420px); height: min(42%, 260px); border-radius: 18px; box-shadow: 0 0 0 9999px rgba(8, 14, 28, .55); pointer-events: none; transition: box-shadow var(--t-fast); }
.scanner-frame::before, .scanner-frame::after, .scanner-frame > i::before, .scanner-frame > i::after { content: ''; position: absolute; width: 26px; height: 26px; border: 3px solid #fff; }
.scanner-frame::before { top: -2px; left: -2px; border-right: 0; border-bottom: 0; border-top-left-radius: 14px; }
.scanner-frame::after { top: -2px; right: -2px; border-left: 0; border-bottom: 0; border-top-right-radius: 14px; }
.scanner-frame > i::before { bottom: -2px; left: -2px; border-right: 0; border-top: 0; border-bottom-left-radius: 14px; }
.scanner-frame > i::after { bottom: -2px; right: -2px; border-left: 0; border-top: 0; border-bottom-right-radius: 14px; }
.scanner-frame .line { position: absolute; left: 10px; right: 10px; height: 2px; background: var(--primary); box-shadow: 0 0 10px var(--primary); border-radius: 2px; animation: scanner-sweep 2.2s ease-in-out infinite; }
.scanner-frame.hit { box-shadow: 0 0 0 9999px rgba(8, 14, 28, .55), inset 0 0 0 4px var(--primary), 0 0 24px var(--primary); }
.scanner-frame.hit::before, .scanner-frame.hit::after, .scanner-frame.hit > i::before, .scanner-frame.hit > i::after { border-color: var(--primary); }
.scanner-frame.hit .line { animation: none; opacity: 0; }
@keyframes scanner-sweep { 0% { top: 8%; opacity: .2 } 50% { top: 90%; opacity: 1 } 100% { top: 8%; opacity: .2 } }
.scanner-hint { position: absolute; bottom: 14px; inset-inline: 0; text-align: center; color: #fff; font-size: 13px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,.6); pointer-events: none; }
.scanner-tools { position: absolute; top: 12px; inset-inline-end: 12px; display: flex; flex-direction: column; gap: 8px; }
.scanner-tools .btn { width: 46px; height: 46px; border-radius: 50%; background: rgba(255,255,255,.16); color: #fff; backdrop-filter: blur(6px); }
.scanner-tools .btn.on { background: var(--primary); color: var(--on-primary); }
.scanner-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; color: #fff; background: #0b1220; }
.scanner-overlay .ico { width: 72px; height: 72px; border-radius: 24px; background: rgba(255,255,255,.1); display: flex; align-items: center; justify-content: center; color: #fff; }
.scanner-overlay h3 { color: #fff; font-size: 17px; }
.scanner-overlay p { color: rgba(255,255,255,.75); font-size: 14px; max-width: 360px; line-height: 1.6; }
.scanner-overlay .btn { background: rgba(255,255,255,.14); color: #fff; }
.scanner-overlay .btn.primary { background: var(--primary); color: var(--on-primary); }
.scanner-status { position: absolute; top: 12px; inset-inline-start: 12px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.scanner-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(8,14,28,.6); color: #fff; font-size: 13px; font-weight: 600; backdrop-filter: blur(6px); }
.scanner-pill .num { font-family: var(--mono); }
.scanner-foot { display: flex; flex-direction: column; gap: 10px; padding: 12px 16px calc(14px + var(--safe-bottom)); background: var(--surface); border-top: 1px solid var(--line); }
.scanner-foot form { display: flex; gap: 8px; align-items: center; }
.scanner-foot form .input-wrap { flex: 1; }
`
function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const s = document.createElement('style')
  s.id = STYLE_ID
  s.textContent = CSS
  document.head.appendChild(s)
}

export function ScannerModal({ open, onClose, onScan, continuous, title }: ScannerModalProps) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const runRef = useRef(0)                       // bumps on every start/stop so a stale loop exits
  const lastRef = useRef({ code: '', at: 0 })
  const busyRef = useRef(false)
  const statusRef = useRef<Status>('idle')
  const deviceRef = useRef<string | undefined>(undefined)
  const wakeRef = useRef<WakeLockSentinel | null>(null)
  const onScanRef = useRef(onScan); onScanRef.current = onScan
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose
  const continuousRef = useRef(!!continuous); continuousRef.current = !!continuous

  const [status, setStatusState] = useState<Status>('idle')
  const [error, setError] = useState<ScanError | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [torchOk, setTorchOk] = useState(false)
  const [torch, setTorch] = useState(false)
  const [flash, setFlash] = useState(false)
  const [last, setLast] = useState('')
  const [count, setCount] = useState(0)
  const [manual, setManual] = useState('')
  const setStatus = (s: Status) => { statusRef.current = s; setStatusState(s) }

  const stop = useCallback(() => {
    runRef.current++
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = undefined }
    const s = streamRef.current
    if (s) { for (const tr of s.getTracks()) { try { tr.stop() } catch { /* already stopped */ } } streamRef.current = null }
    const v = videoRef.current
    if (v) { try { v.pause() } catch { /* ignore */ } v.srcObject = null }
    setTorch(false); setTorchOk(false)
  }, [])

  const handleCode = useCallback(async (raw: string, manual: boolean) => {
    const code = cleanBarcode(raw)
    if (!code) return
    const now = Date.now()
    if (!manual && lastRef.current.code === code && now - lastRef.current.at < DEDUPE_MS) { lastRef.current.at = now; return }
    lastRef.current = { code, at: now }
    busyRef.current = true
    beep('scan')
    setFlash(true); window.setTimeout(() => setFlash(false), 350)
    setLast(code)
    let keep: boolean | void = undefined
    try { keep = await onScanRef.current(code) } catch { keep = false }
    if (keep !== false) setCount(c => c + 1)
    busyRef.current = false
    if (keep === false || continuousRef.current) return
    onCloseRef.current()
  }, [])

  const start = useCallback(async (deviceId?: string) => {
    stop()
    const run = ++runRef.current
    setError(null); setStatus('starting')
    if (typeof window !== 'undefined' && window.isSecureContext === false) { setError('insecure'); setStatus('error'); return }
    if (!navigator.mediaDevices?.getUserMedia) { setError(window.isSecureContext ? 'noCamera' : 'insecure'); setStatus('error'); return }
    let stream: MediaStream
    try { stream = await getStream(deviceId) } catch (e) {
      if (run !== runRef.current) return
      setError(mapError(e)); setStatus('error'); return
    }
    if (run !== runRef.current) { stream.getTracks().forEach(tr => tr.stop()); return }
    streamRef.current = stream
    const track = stream.getVideoTracks()[0]
    try {
      const caps = (track?.getCapabilities?.() ?? {}) as ExtraCapabilities
      if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => { /* optional */ })
      setTorchOk(!!caps.torch)
    } catch { /* capabilities are optional */ }
    const video = videoRef.current
    if (!video) { stop(); return }
    video.srcObject = stream
    video.muted = true
    video.setAttribute('playsinline', 'true')
    try { await video.play() } catch { /* autoplay may be refused until the stream is live; the loop waits on readyState */ }
    if (run !== runRef.current) return
    try {
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
      setDevices(list)
      const cur = track?.getSettings?.().deviceId ?? deviceId
      deviceRef.current = cur
    } catch { /* no device list */ }
    if (run !== runRef.current) return

    let detector = await makeNativeDetector()
    let zx: BrowserMultiFormatReader | null = null
    if (!detector) {
      try { zx = await loadZxing() } catch { if (run === runRef.current) { setError('unknown'); setStatus('error') } return }
    }
    if (run !== runRef.current) return
    setStatus('running')

    const tick = async () => {
      if (run !== runRef.current) return
      if (!busyRef.current && video.readyState >= 2 && !video.paused && video.videoWidth > 0) {
        let code: string | null = null
        if (detector) {
          try {
            const found = await detector.detect(video)
            if (found.length) code = found[0].rawValue
          } catch {
            // the native detector exists but does not work on this platform (desktop Chrome): fall back to ZXing
            detector = null
            try { zx = await loadZxing() } catch { if (run === runRef.current) { setError('unknown'); setStatus('error') } return }
          }
        } else if (zx) {
          const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
          const vw = video.videoWidth, vh = video.videoHeight
          const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh))
          const w = Math.round(vw * scale), h = Math.round(vh * scale)
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h }
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            try {
              ctx.drawImage(video, 0, 0, w, h)
              code = zx.decodeFromCanvas(canvas).getText()
            } catch { /* nothing readable in this frame */ }
          }
        }
        if (run !== runRef.current) return
        if (code) await handleCode(code, false)
        if (run !== runRef.current) return
      }
      timerRef.current = window.setTimeout(tick, FRAME_MS)
    }
    void tick()
  }, [stop, handleCode])

  // open / close
  useEffect(() => {
    if (!open) return
    ensureStyles()
    setLast(''); setCount(0); setManual(''); lastRef.current = { code: '', at: 0 }; busyRef.current = false
    platform.keepScreenOn(true)
    try { void navigator.wakeLock?.request('screen').then(s => { wakeRef.current = s }).catch(() => { /* not granted */ }) } catch { /* unsupported */ }
    void start()
    return () => {
      stop()
      setStatus('idle')
      platform.keepScreenOn(false)
      try { void wakeRef.current?.release(); wakeRef.current = null } catch { /* ignore */ }
    }
  }, [open, start, stop])

  // pause when the app goes to the background, resume when it comes back
  useEffect(() => {
    if (!open) return
    const onVis = () => {
      if (document.hidden) {
        if (statusRef.current === 'running' || statusRef.current === 'starting') { stop(); setStatus('paused') }
      } else if (statusRef.current === 'paused') {
        void start(deviceRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [open, start, stop])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch { setTorchOk(false) }
  }
  const switchCamera = () => {
    if (devices.length < 2) return
    const i = devices.findIndex(d => d.deviceId === deviceRef.current)
    const next = devices[(i + 1) % devices.length]
    void start(next.deviceId)
  }
  const submitManual = (e: FormEvent) => {
    e.preventDefault()
    const v = manual.trim()
    if (!v) return
    setManual('')
    void handleCode(v, true)
  }

  const errorText = (k: ScanError): { title: string; help: string } => {
    if (k === 'denied') return { title: t('scanner.err.denied'), help: t(platform.isAndroid || platform.isTouch ? 'scanner.err.deniedHelpAndroid' : 'scanner.err.deniedHelpDesktop') }
    return { title: t(`scanner.err.${k}`), help: t(`scanner.err.${k}Help`) }
  }

  return (
    <Modal open={open} onClose={onClose} title={title ?? t('scanner.title')} full className="scanner-modal">
      <div className="scanner">
        <div className="scanner-view">
          <video ref={videoRef} autoPlay muted playsInline />
          {status === 'running' && (
            <>
              <div className={`scanner-frame ${flash ? 'hit' : ''}`}><i /><span className="line" /></div>
              <div className="scanner-hint">{t('scanner.hint')}</div>
              <div className="scanner-tools">
                {torchOk && <Button iconOnly className={torch ? 'on' : ''} icon={torch ? <Zap size={20} /> : <ZapOff size={20} />} onClick={() => void toggleTorch()} title={t('scanner.torch')} aria-label={t('scanner.torch')} aria-pressed={torch} />}
                {devices.length > 1 && <Button iconOnly icon={<SwitchCamera size={20} />} onClick={switchCamera} title={t('scanner.switch')} aria-label={t('scanner.switch')} />}
              </div>
              {(continuous || last) && (
                <div className="scanner-status">
                  {continuous && <span className="scanner-pill"><Check size={14} />{t('scanner.readCount', { n: count })}</span>}
                  {last && <span className="scanner-pill"><span className="faint">{t('scanner.last')}</span> <span className="num">{last}</span></span>}
                </div>
              )}
            </>
          )}
          {status === 'starting' && (
            <div className="scanner-overlay"><span className="spinner" /><p>{t('scanner.starting')}</p></div>
          )}
          {status === 'paused' && (
            <div className="scanner-overlay">
              <div className="ico"><PauseCircle size={34} /></div>
              <h3>{t('scanner.paused')}</h3>
              <Button variant="primary" icon={<Camera size={18} />} onClick={() => void start(deviceRef.current)}>{t('scanner.resume')}</Button>
            </div>
          )}
          {status === 'error' && error && (
            <div className="scanner-overlay">
              <div className="ico">{error === 'denied' ? <Lock size={34} /> : error === 'insecure' ? <ShieldAlert size={34} /> : <CameraOff size={34} />}</div>
              <h3>{errorText(error).title}</h3>
              <p>{errorText(error).help}</p>
              {error !== 'insecure' && <Button icon={<RefreshCw size={18} />} onClick={() => void start(deviceRef.current)}>{t('scanner.retry')}</Button>}
            </div>
          )}
        </div>
        <div className="scanner-foot">
          <form onSubmit={submitManual}>
            <Input
              ltr
              value={manual}
              onChange={e => setManual(e.target.value)}
              placeholder={t('scanner.manual')}
              inputMode="text"
              autoComplete="off"
              autoFocus={status === 'error'}
              data-no-wedge=""
              start={<Keyboard size={18} />}
            />
            <Button type="submit" variant="soft" disabled={!manual.trim()}>{t('scanner.manualGo')}</Button>
          </form>
          {continuous && <Button variant="primary" size="lg" block icon={<Check size={20} />} onClick={onClose}>{t('scanner.done')}</Button>}
        </div>
      </div>
    </Modal>
  )
}
