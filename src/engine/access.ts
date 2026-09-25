// What a student may open before activating the app, and the activation state itself.
import { useEffect, useState } from 'react'
import meta from '@book-meta'
import type { Exam, Lesson, Module } from './types'
import { checkCode, deviceNumber } from './license'

const LICENSE_KEY = `${meta.storageKey}.license`
const RAW_KEY = 'emar.device'

function read(k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function write(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

/** The phone's own id from the Android app (the same after reinstalling); in a browser, a random id kept locally. */
function rawDeviceId(): string {
  try {
    const id = (window as unknown as { EmarAndroid?: { deviceId?: () => string } }).EmarAndroid?.deviceId?.()
    if (id) return `a:${id}`
  } catch { /* not in the Android app */ }
  let r = read(RAW_KEY)
  if (!r) { r = `w:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; write(RAW_KEY, r) }
  return r
}

/** Free before activation: every lesson of the book's first unit, and the first exam paper. */
export function freeLesson(l: Lesson, modules: Module[]): boolean {
  return l.unitId === modules[0]?.units[0]?.id && !['boss', 'bookReview', 'progressTest'].includes(l.kind)
}
export function freeUnit(unitId: string, modules: Module[]): boolean { return unitId === modules[0]?.units[0]?.id }
export function freeExam(e: Exam, exams: Exam[]): boolean { return e.id === exams[0]?.id }

export interface Access {
  pro: boolean
  until: Date | null
  device: string
  code: string
  activate: (code: string) => Promise<'ok' | 'format' | 'device' | 'expired'>
}

export function useAccess(): Access {
  const [device, setDevice] = useState('')
  const [pro, setPro] = useState(false)
  const [until, setUntil] = useState<Date | null>(null)
  const [code, setCode] = useState(read(LICENSE_KEY) || '')
  useEffect(() => {
    let live = true
    deviceNumber(meta.id, rawDeviceId()).then(async d => {
      if (!live) return
      setDevice(d)
      const saved = read(LICENSE_KEY)
      if (saved) {
        const r = await checkCode(meta.id, d, saved)
        if (live && r.ok) { setPro(true); setUntil(r.until) }
      }
    })
    return () => { live = false }
  }, [])
  const activate = async (c: string) => {
    const r = await checkCode(meta.id, device, c)
    if (!r.ok) return r.reason
    write(LICENSE_KEY, c.trim()); setCode(c.trim()); setPro(true); setUntil(r.until)
    return 'ok' as const
  }
  return { pro, until, device, code, activate }
}

/** Keep the activation when the student resets their progress. */
export function keepLicense<T>(fn: () => T): T {
  const lic = read(LICENSE_KEY), raw = read(RAW_KEY)
  const out = fn()
  if (lic) write(LICENSE_KEY, lic)
  if (raw) write(RAW_KEY, raw)
  return out
}
