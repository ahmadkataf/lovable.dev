// The picture: the DevTools screencast of the page (JPEG frames with the compositor's swap timestamps), written to
// <dir>/NNNNNN.jpg as they come and acknowledged at once. Chromium only sends a frame when something changed, so an
// idle screen costs one frame; the assembler holds each frame until the next one (lib/assemble.mjs).
// Frames are 1920×1080 for a 1280×720 viewport when Chromium runs with --force-device-scale-factor=1.5 (the frame
// size follows the real device scale, not the emulated one; lib/clinic.mjs launches it so).
import fs from 'node:fs'
import path from 'node:path'

/**
 * Starts the screencast of `page` into `dir`. Returns { frames, firstFrame(), stop() }: `frames` is the growing list of
 * { i, file, ts } (ts in epoch seconds, the same clock as Date.now(), so scene starts measured in Node line up with it).
 */
export async function startScreencast(page, dir, { quality = 90, maxWidth = 1920, maxHeight = 1080 } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  const cdp = await page.context().newCDPSession(page)
  const frames = [], writes = []
  let n = 0, skew = null, useReceiveTime = false
  cdp.on('Page.screencastFrame', ev => {
    const i = ++n
    const recv = Date.now() / 1000
    let ts = ev.metadata?.timestamp
    if (skew === null && typeof ts === 'number') {
      // the browser's clock should be ours: when it is not (a sandbox with its own clock), the receive time is used
      skew = recv - ts
      if (Math.abs(skew) > 1.5) { useReceiveTime = true; console.warn(`screencast: frame timestamps are ${skew.toFixed(2)} s off the wall clock; using receive times`) }
    }
    if (typeof ts !== 'number' || useReceiveTime) ts = recv
    const file = path.join(dir, `${String(i).padStart(6, '0')}.jpg`)
    writes.push(fs.promises.writeFile(file, Buffer.from(ev.data, 'base64')))
    frames.push({ i, file, ts })
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => { /* stopping */ })
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth, maxHeight, everyNthFrame: 1 })
  return {
    frames,
    /** Resolves with the first frame's timestamp (the video's zero), nudging the page when nothing arrives by itself. */
    async firstFrame(timeout = 5000) {
      const until = Date.now() + timeout
      while (!frames.length && Date.now() < until) {
        await new Promise(r => setTimeout(r, 100))
        if (!frames.length) await page.evaluate(() => window.__dv?.nudge()).catch(() => {})
      }
      if (!frames.length) throw new Error('the screencast sent no frame')
      return frames[0].ts
    },
    /** Stops the screencast, waits for every frame to be on disk and returns the frames. */
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {})
      await Promise.all(writes)
      await cdp.detach().catch(() => {})
      return frames
    },
  }
}
