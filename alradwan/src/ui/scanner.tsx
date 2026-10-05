import { useEffect, useRef, useState } from 'react'
import { Camera, Focus, ImagePlus, RefreshCw, Zap, ZapOff } from 'lucide-react'
import { Modal } from './modal'
import { decodeImageData, decodeStill, formatLabel, loadDecoder, UNCHECKED, type Decoded } from '../lib/camera'
import { scanFeedback } from '../lib/scan'

const CAMERA_KEY = 'alradwan.camera'
const savedCamera = () => { try { return localStorage.getItem(CAMERA_KEY) } catch { return null } }
const saveCamera = (id: string) => { try { localStorage.setItem(CAMERA_KEY, id) } catch { /* private mode */ } }
const isAndroidApp = () => typeof (window as unknown as { GarageAndroid?: unknown }).GarageAndroid !== 'undefined'

/** Reads barcodes with the camera: every common type, on the phone, the Windows app and any browser.
 *  `onCode` returns true to keep scanning (several items in a row), anything else closes. */
export function CameraScanner({ onCode, onClose, title = 'مسح الباركود بالكاميرا', hint }: {
  onCode: (d: Decoded) => boolean | void | Promise<boolean | void>; onClose: () => void; title?: string; hint?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const [state, setState] = useState<'loading' | 'live' | 'nocam'>('loading')
  const [err, setErr] = useState('')
  const [denied, setDenied] = useState(false)
  const [last, setLast] = useState<Decoded | null>(null)
  const [cams, setCams] = useState<MediaDeviceInfo[]>([])
  const [camId, setCamId] = useState<string | null>(savedCamera)
  const [attempt, setAttempt] = useState(0)
  const [torch, setTorch] = useState<boolean | null>(null)
  const [busyPhoto, setBusyPhoto] = useState(false)
  const handle = useRef(onCode); handle.current = onCode
  const seen = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  // every code in front of the camera: a box held there counts once, until it leaves the picture for a moment
  const inView = useRef(new Map<string, { last: number; frames: number; done: boolean }>())
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const torchOn = useRef(false)

  const deliver = async (d: Decoded) => {
    // closed while a photo was still being read: it is not wanted any more
    if (!alive.current) return false
    const now = Date.now()
    if (d.text === seen.current.text && now - seen.current.at < 1800) return false
    seen.current = { text: d.text, at: now }
    setLast(d)
    scanFeedback(true)
    const keep = await handle.current(d)
    if (keep !== true) onClose()
    return true
  }

  useEffect(() => {
    const dbg = (() => { try { return !!localStorage.getItem('alradwan.debugScan') } catch { return false } })()
    const t0 = performance.now()
    const log = (m: string) => { if (dbg) console.log(`[scan ${Math.round(performance.now() - t0)}ms] ${m}`) }
    let stop = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let pass = 0
    const open = async () => {
      const size = { width: { ideal: 1280 }, height: { ideal: 720 } }
      if (camId) {
        try { return await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: camId }, ...size }, audio: false }) }
        catch (e) { if ((e as Error).name === 'NotAllowedError') throw e /* the remembered camera is gone: any back camera */ }
      }
      try { return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, ...size }, audio: false }) }
      catch (e) { if ((e as Error).name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ video: true, audio: false }); throw e }
    }
    const start = async () => {
      try {
        await loadDecoder()
        if (stop) return
        log('decoder ready')
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam')
        const s = await open()
        if (stop) { s.getTracks().forEach(t => t.stop()); return }
        stream.current = s
        const track = s.getVideoTracks()[0]
        // keep the picture sharp up close and offer the flashlight where the camera has one
        try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }) } catch { /* not supported */ }
        try {
          const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean | boolean[] }
          setTorch(caps?.torch === true || (Array.isArray(caps?.torch) && caps.torch.includes(true)) ? false : null)
        } catch { setTorch(null) }
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}) }
        try { setCams((await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')) } catch { /* ignore */ }
        setState('live'); setErr(''); setDenied(false)
        log('camera live ' + (video.current?.videoWidth ?? 0))
        const tick = async () => {
          if (stop) return
          const v = video.current
          // nothing to read while the app is in the background
          if (document.hidden) { timer = setTimeout(tick, 400); return }
          if (v && v.readyState >= 2 && v.videoWidth) {
            // a smaller frame decodes faster; every third pass looks harder (rotated, inverted, small, 2D codes)
            const scale = Math.min(1, 960 / v.videoWidth)
            const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale)
            const c = (canvas.current ??= document.createElement('canvas'))
            if (c.width !== w) c.width = w
            if (c.height !== h) c.height = h
            const ctx = c.getContext('2d', { willReadFrequently: true })
            if (ctx) {
              ctx.drawImage(v, 0, 0, w, h)
              try {
                const td = performance.now()
                const found = await decodeImageData(ctx.getImageData(0, 0, w, h), pass++ % 3 !== 2)
                log(`pass ${pass} ${w}x${h} ${Math.round(performance.now() - td)}ms found ${found.length}`)
                const now = Date.now()
                for (const x of found) {
                  const seenBefore = inView.current.get(x.text)
                  if (!seenBefore || now - seenBefore.last > 1500) inView.current.set(x.text, { last: now, frames: 1, done: false })
                  else { seenBefore.last = now; seenBefore.frames++ }
                }
                if (inView.current.size > 50) for (const [k, v] of inView.current) if (now - v.last > 10000) inView.current.delete(k)
                // a code with no check digit counts only when a second frame reads the same
                const fresh = found.filter(x => { const v = inView.current.get(x.text)!; return !v.done && (!UNCHECKED.has(x.format) || v.frames >= 2) })
                const d = fresh.find(x => !UNCHECKED.has(x.format)) ?? fresh[0]
                if (d && !stop) {
                  // the other codes on the same box (its part-number label) are the same item
                  for (const x of found) inView.current.get(x.text)!.done = true
                  await deliver(d)
                }
              } catch { /* keep trying */ }
            }
          }
          if (!stop) timer = setTimeout(tick, 120)
        }
        tick()
      } catch (e) {
        if (stop) return
        setState('nocam')
        const name = (e as Error).name, msg = (e as Error).message || ''
        setDenied(name === 'NotAllowedError' || name === 'SecurityError')
        setErr(name === 'NotAllowedError' || name === 'SecurityError' ? (isAndroidApp() ? 'اسمح للتطبيق باستخدام الكاميرا عندما يسألك الهاتف، ثم اضغط «إعادة المحاولة». أو اختر صورة للباركود بزر «صورة».' : 'لم يُسمح باستخدام الكاميرا. اسمح بها من إعدادات الجهاز أو المتصفح (وفي ويندوز: الإعدادات ← الخصوصية ← الكاميرا)، ثم اضغط «إعادة المحاولة».')
          : name === 'NotFoundError' || msg === 'nocam' ? 'لا توجد كاميرا في هذا الجهاز. استخدم زر «صورة» أو قارئ باركود.'
          : name === 'NotReadableError' ? 'الكاميرا مشغولة ببرنامج آخر. أغلقه ثم اضغط «إعادة المحاولة».'
          : name === 'CompileError' || name === 'RuntimeError' || msg.startsWith('wasm') ? (isAndroidApp() ? 'تعذّر تشغيل قارئ الباركود على هذا الهاتف. حدّث «Android System WebView» و«Chrome» من المتجر ثم أعد فتح التطبيق.' : 'تعذّر تحميل قارئ الباركود. أعد فتح البرنامج.')
          : 'تعذّر فتح الكاميرا. أغلق أي برنامج آخر يستخدمها ثم اضغط «إعادة المحاولة»، أو استخدم زر «صورة».')
      }
    }
    start()
    // the Android app calls this when the user has just allowed the camera
    const w = window as unknown as { alradwanCameraReady?: () => void }
    w.alradwanCameraReady = () => { setState('loading'); setErr(''); setAttempt(a => a + 1) }
    return () => {
      stop = true
      if (timer) clearTimeout(timer)
      const track = stream.current?.getVideoTracks()[0]
      if (track && torchOn.current) { try { void track.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] }) } catch { /* ignore */ } }
      torchOn.current = false
      stream.current?.getTracks().forEach(t => t.stop()); stream.current = null
      if (video.current) video.current.srcObject = null
      if (w.alradwanCameraReady) delete w.alradwanCameraReady
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camId, attempt])

  const switchCam = () => {
    if (cams.length < 2) return
    const current = stream.current?.getVideoTracks()[0]?.getSettings().deviceId ?? camId
    const next = cams[(cams.findIndex(c => c.deviceId === current) + 1) % cams.length]
    if (!next?.deviceId) return
    saveCamera(next.deviceId)
    setState('loading'); setTorch(null); setCamId(next.deviceId)
  }
  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0]
    if (!track || torch === null) return
    try { await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); torchOn.current = !torch; setTorch(!torch) } catch { setTorch(null) }
  }
  const readStill = async (src: Blob | HTMLVideoElement) => {
    setBusyPhoto(true); setErr('')
    try {
      const found = await decodeStill(src)
      if (!alive.current) return
      if (found.length) await deliver(found[0]); else setErr('لم أجد باركوداً. قرّب الكاميرا حتى يملأ الباركود الصورة وتكون الخطوط واضحة، أو شغّل الضوء.')
    } catch { if (alive.current) setErr('تعذّر قراءة الصورة.') } finally { if (alive.current) setBusyPhoto(false) }
  }
  // one sharp picture at the camera's full size: for small or dense codes the live view cannot resolve
  const snap = async () => {
    const track = stream.current?.getVideoTracks()[0]
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture
    if (track && IC) {
      try { setBusyPhoto(true); return await readStill(await new IC(track).takePhoto()) } catch { /* fall back to the video frame */ }
    }
    if (video.current) await readStill(video.current)
  }
  const photo = (file: File | undefined) => { if (file) void readStill(file) }

  return (
    <Modal title={title} onClose={onClose} size="narrow">
      <div className="scanner">
        {state !== 'nocam' && <div className="scanner-view">
          <video ref={video} muted playsInline />
          <div className="scanner-aim"><i /></div>
          {state === 'loading' && <div className="scanner-wait"><Camera /> جارٍ تشغيل الكاميرا…</div>}
        </div>}
        {err && <div className="error mt">{err}</div>}
        {last && <div className="scanner-last mt"><b className="mono" dir="ltr">{last.text}</b><span className="muted small">{formatLabel(last.format)}</span></div>}
        <p className="help mt">{hint ?? 'وجّه الكاميرا نحو الباركود: يقرأ الخطوط العادية والطويلة ورموز QR وData Matrix وغيرها.'}</p>
        <div className="row mt" style={{ flexWrap: 'wrap' }}>
          {state === 'live' && <button className="btn sm" onClick={snap} disabled={busyPhoto} title="صورة واحدة بأعلى دقة للباركود الصغير أو الكثيف"><Focus /> {busyPhoto ? 'جارٍ القراءة…' : 'لقطة دقيقة'}</button>}
          {state === 'nocam' && <button className={`btn sm ${denied ? 'primary' : ''}`} onClick={() => { setState('loading'); setErr(''); setAttempt(a => a + 1) }}><RefreshCw /> إعادة المحاولة</button>}
          <label className="btn sm" aria-busy={busyPhoto}><ImagePlus /> صورة<input type="file" accept="image/*" capture="environment" hidden onChange={e => { photo(e.target.files?.[0]); e.target.value = '' }} /></label>
          {cams.length > 1 && <button className="btn sm" onClick={switchCam}><RefreshCw /> كاميرا أخرى</button>}
          {torch !== null && <button className="btn sm" onClick={toggleTorch}>{torch ? <ZapOff /> : <Zap />} {torch ? 'إطفاء الضوء' : 'الضوء'}</button>}
        </div>
      </div>
    </Modal>
  )
}
