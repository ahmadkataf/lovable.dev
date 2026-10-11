// @vitest-environment node
// The backup archive end to end, in Node (its Blob survives fake-indexeddb's structured clone): CRC-32, base64,
// ZIP writing/reading (including ZIP64), encryption, file-type sniffing, the device-settings merge, and full
// write → read → restore round trips with patient files. The real-browser checks (IndexedDB auto-commit, 600 MB
// archives, Electron, the Android bridge) are Playwright scripts.
import 'fake-indexeddb/auto'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { db, ensureClinic, getSetting, importBackup, mergeDeviceSettings, resetDatabase, setSetting, updateClinic, dataUrlToBlob, isQuotaError } from '../src/db'
import type { PatientFile, Setting } from '../src/db/types'
import { BlobBuilder, ChunkBuffer, crc32, fromBase64, toBase64 } from '../src/platform/bytes'
import { sniffMime } from '../src/platform/filetype'
import { ZipReader, ZipWriter } from '../src/features/settings/backup/zip'
import { decryptBackup, DecryptError, encryptingWriter, isEncryptedBackup } from '../src/features/settings/backup/crypto'
import { archiveFileName, BackupError, detectBackup, readBackup, snapshotDatabase, writeBackup } from '../src/features/settings/backup/archive'
import { eraseEverything, restoreBackup } from '../src/features/settings/backup'
import { translate } from '../src/i18n'

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

/** A sink that keeps what is written, as the platform layer would. */
function memorySink() {
  const parts: Uint8Array[] = []
  return { write: async (b: Uint8Array) => { parts.push(b.slice()) }, blob: () => new Blob(parts as BlobPart[]) }
}

// small "files" with real magic bytes
const PNG = (n: number) => { const b = randomBytes(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); return new Uint8Array(b) }
const JPG = (n: number) => { const b = randomBytes(n); b.set([0xff, 0xd8, 0xff, 0xe0], 0); return new Uint8Array(b) }
const PDF = (n: number) => { const b = randomBytes(n); b.set(new TextEncoder().encode('%PDF-1.7\n'), 0); return new Uint8Array(b) }

describe('bytes', () => {
  it('crc32 matches zlib for every length and across pieces', () => {
    const data = new Uint8Array(randomBytes(70_001))
    for (const n of [0, 1, 7, 8, 9, 15, 16, 17, 255, 4096, 70_001]) expect(crc32(data.subarray(0, n))).toBe(zlib.crc32(data.subarray(0, n)))
    let c = 0
    for (let i = 0; i < data.length; i += 997) c = crc32(data.subarray(i, i + 997), c)
    expect(c).toBe(zlib.crc32(data))
  })
  it('base64 both ways, any length', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 100, 49_153, 300_000]) {
      const b = new Uint8Array(randomBytes(n))
      const s = toBase64(b)
      expect(s).toBe(Buffer.from(b).toString('base64'))
      expect(sha(fromBase64(s))).toBe(sha(b))
    }
    expect(Array.from(fromBase64('aGk=\n'))).toEqual([104, 105])
    expect(() => fromBase64('a<b>')).toThrow()
  })
  it('ChunkBuffer keeps order and sizes; BlobBuilder gives back the same bytes', async () => {
    const out: Uint8Array[] = []
    const cb = new ChunkBuffer(1000, async c => { out.push(c) })
    const src = new Uint8Array(randomBytes(12_345))
    for (let i = 0; i < src.length;) { const n = (i % 7) * 333 + 1; await cb.write(src.subarray(i, i + n)); i += n }
    await cb.end()
    expect(out.slice(0, -1).every(c => c.length === 1000)).toBe(true)
    const bb = new BlobBuilder(4096)
    for (const c of out) bb.push(c)
    expect(sha(await blobBytes(bb.build()))).toBe(sha(src))
  })
})

describe('file types come from the bytes', () => {
  it('recognises pictures and PDFs, refuses the rest', () => {
    expect(sniffMime(JPG(20))).toBe('image/jpeg')
    expect(sniffMime(PNG(20))).toBe('image/png')
    expect(sniffMime(PDF(20))).toBe('application/pdf')
    expect(sniffMime(new TextEncoder().encode('GIF89a......'))).toBe('image/gif')
    expect(sniffMime(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffMime(new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic')]))).toBe('image/heic')
    expect(sniffMime(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull()
    expect(sniffMime(new TextEncoder().encode('<svg onload="x()"/>'))).toBeNull()
  })
  it('an HTML page labelled as a PDF in an old backup is stored as inert bytes', () => {
    const html = 'data:text/html;base64,' + Buffer.from('<script>parent.pwned=1</script>').toString('base64')
    expect(dataUrlToBlob(html)!.type).toBe('application/octet-stream')
    expect(dataUrlToBlob('data:application/pdf;base64,' + Buffer.from(PDF(40)).toString('base64'))!.type).toBe('application/pdf')
    expect(dataUrlToBlob('https://example.com/x.pdf')).toBeNull()
    expect(dataUrlToBlob('data:image/png;base64,@@@')).toBeNull()
  })
})

describe('zip', () => {
  it('writes an archive any unzip tool accepts and reads it back', async () => {
    const sink = memorySink()
    const z = new ZipWriter(sink.write)
    const pic = JPG(300_000)
    await z.addDeflated('tables/patients-0.json', [new TextEncoder().encode(JSON.stringify([{ id: 'p1', name: 'سارة' }]))])
    await z.addStored('files/f1/أشعة.jpg', [pic.subarray(0, 100_000), pic.subarray(100_000)])
    await z.finish()
    const blob = sink.blob()
    const tmp = path.join(os.tmpdir(), `dentora-zip-${process.pid}.zip`)
    fs.writeFileSync(tmp, await blobBytes(blob))
    try { expect(execFileSync('unzip', ['-t', tmp], { encoding: 'utf8' })).toMatch(/No errors detected/) } finally { fs.unlinkSync(tmp) }
    const r = await ZipReader.open(blob)
    expect(JSON.parse(await r.text(r.get('tables/patients-0.json')!))).toEqual([{ id: 'p1', name: 'سارة' }])
    const e = r.get('files/f1/أشعة.jpg')!
    expect(e.crc).toBe(zlib.crc32(pic))
    expect(sha(await blobBytes(await r.slice(e)))).toBe(sha(pic))
  })
  it('switches to ZIP64 records past 65,535 entries', async () => {
    const sink = memorySink()
    const z = new ZipWriter(sink.write)
    for (let i = 0; i < 65_600; i++) await z.addStored(`e/${i}`, [new Uint8Array([i & 255])])
    await z.finish()
    const blob = sink.blob()
    const r = await ZipReader.open(blob)
    expect(r.entries.size).toBe(65_600)
    expect(Array.from(await r.read(r.get('e/65599')!))).toEqual([65_599 & 255])
    const tmp = path.join(os.tmpdir(), `dentora-zip64-${process.pid}.zip`)
    fs.writeFileSync(tmp, await blobBytes(blob))
    try { expect(execFileSync('unzip', ['-tq', tmp], { encoding: 'utf8' })).toMatch(/No errors detected/) } finally { fs.unlinkSync(tmp) }
  }, 60_000)
  it('notices a damaged archive', async () => {
    const sink = memorySink()
    const z = new ZipWriter(sink.write)
    await z.addDeflated('a.json', [new TextEncoder().encode('[1,2,3]')])
    await z.finish()
    const bytes = await blobBytes(sink.blob())
    await expect(ZipReader.open(new Blob([bytes.subarray(0, bytes.length - 30)]))).rejects.toThrow()
    const flipped = bytes.slice(); flipped[40] ^= 0xff
    const r = await ZipReader.open(new Blob([flipped]))
    await expect(r.read(r.get('a.json')!)).rejects.toThrow()
  })
})

describe('password protection', () => {
  const ITER = 100_000   // the real exports use 600,000
  async function seal(password: string, data: Uint8Array) {
    const sink = memorySink()
    const w = await encryptingWriter(password, sink.write, ITER)
    for (let i = 0; i < data.length; i += 300_001) await w.write(data.subarray(i, i + 300_001))
    await w.end()
    return sink.blob()
  }
  it('round-trips any size, including exact segment multiples and nothing at all', async () => {
    for (const n of [0, 1, 1024 * 1024, 1024 * 1024 + 1, 3 * 1024 * 1024]) {
      const data = new Uint8Array(randomBytes(n))
      const blob = await seal('كلمة سر قوية', data)
      expect(await isEncryptedBackup(blob)).toBe(true)
      expect(sha(await blobBytes(await decryptBackup(blob, 'كلمة سر قوية')))).toBe(sha(data))
    }
  }, 60_000)
  it('refuses a wrong password, a cut file and a changed byte', async () => {
    const data = new Uint8Array(randomBytes(2 * 1024 * 1024 + 10))
    const blob = await seal('correct horse', data)
    await expect(decryptBackup(blob, 'wrong horse')).rejects.toMatchObject({ reason: 'password' })
    const bytes = await blobBytes(blob)
    const segEnd = bytes.length - (10 + 16)                    // drop the last segment: the one before is not marked last
    await expect(decryptBackup(new Blob([bytes.subarray(0, segEnd)]), 'correct horse')).rejects.toBeInstanceOf(DecryptError)
    const flipped = bytes.slice(); flipped[bytes.length - 100] ^= 1
    await expect(decryptBackup(new Blob([flipped]), 'correct horse')).rejects.toMatchObject({ reason: 'damaged' })
  }, 60_000)
})

describe('device settings through a restore', () => {
  const now = Date.parse('2026-10-11T12:00:00Z')
  const rows = (o: Record<string, unknown>): Setting[] => Object.entries(o).map(([key, value]) => ({ key, value }))
  const get = (s: Setting[], k: string) => s.find(r => r.key === k)?.value
  it('keeps this device’s activation; takes the backup’s only when the device has none', () => {
    expect(get(mergeDeviceSettings(rows({ license: 'B' }), rows({ license: 'D' }), {}, now), 'license')).toBe('D')
    expect(get(mergeDeviceSettings(rows({ license: 'B' }), [], {}, now), 'license')).toBe('B')
  })
  it('takes the earliest trial start; never a future one; never "now" when an earlier date is known', () => {
    const m = (b: unknown, d: unknown, clinic?: string) => get(mergeDeviceSettings(rows(b === undefined ? {} : { installedAt: b }), rows(d === undefined ? {} : { installedAt: d }), { clinicCreatedAt: clinic }, now), 'installedAt')
    expect(m('2026-09-01T00:00:00.000Z', '2026-10-10T00:00:00.000Z')).toBe('2026-09-01T00:00:00.000Z')      // clear data + restore: the trial is not reset
    expect(m('2026-10-05T00:00:00.000Z', '2026-09-20T00:00:00.000Z')).toBe('2026-09-20T00:00:00.000Z')
    expect(m('2099-01-01T00:00:00.000Z', '2026-10-10T00:00:00.000Z')).toBe('2026-10-10T00:00:00.000Z')      // an edited backup gains nothing
    expect(m(undefined, '2026-10-10T00:00:00.000Z', '2026-08-01T00:00:00.000Z')).toBe('2026-08-01T00:00:00.000Z') // a backup without the row: the clinic's age
    expect(m('garbage', undefined)).toBe(new Date(now).toISOString())
    // an edited backup (trial start and clinic date both in the future) still cannot start a trial after its own date
    expect(get(mergeDeviceSettings(rows({ installedAt: '2099-01-01T00:00:00.000Z' }), [], { clinicCreatedAt: '2099-01-01T00:00:00.000Z', exportedAt: '2026-08-15T10:00:00.000Z' }, now), 'installedAt')).toBe('2026-08-15T10:00:00.000Z')
    // a genuine backup: its date is never earlier than the clinic, so it changes nothing
    expect(get(mergeDeviceSettings(rows({ installedAt: '2026-09-01T00:00:00.000Z' }), [], { clinicCreatedAt: '2026-09-01T00:00:00.000Z', exportedAt: '2026-10-01T00:00:00.000Z' }, now), 'installedAt')).toBe('2026-09-01T00:00:00.000Z')
  })
  it('keeps the device’s last export, or uses the backup’s date on a device that never exported', () => {
    expect(get(mergeDeviceSettings(rows({ lastBackupAt: '2026-01-01T00:00:00.000Z' }), rows({ lastBackupAt: '2026-10-09T00:00:00.000Z' }), { exportedAt: '2026-10-01T00:00:00.000Z' }, now), 'lastBackupAt')).toBe('2026-10-09T00:00:00.000Z')
    expect(get(mergeDeviceSettings([], [], { exportedAt: '2026-10-01T00:00:00.000Z' }, now), 'lastBackupAt')).toBe('2026-10-01T00:00:00.000Z')
    expect(get(mergeDeviceSettings(rows({ pref: 1 }), [], {}, now), 'pref')).toBe(1)
  })
})

describe('backup archive round trip', () => {
  const at = '2026-10-01T09:00:00.000Z'
  const files: Record<string, Uint8Array> = {}
  async function seedClinic(nFiles: number) {
    await resetDatabase()
    await ensureClinic()
    await updateClinic({ name: 'عيادة الابتسامة', setupDone: true })
    await db.users.put({ id: 'u1', name: 'د. أحمد', role: 'admin', pinHash: 'h', pinSalt: 's', color: '#000', active: true, createdAt: at, updatedAt: at })
    for (let i = 0; i < 30; i++) await db.patients.put({ id: `p${i}`, fileNo: i + 1, name: `مريض ${i}`, gender: 'male', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: at, updatedAt: at })
    for (let i = 0; i < nFiles; i++) {
      const bytes = i % 3 === 0 ? PDF(50_000 + i) : i % 3 === 1 ? JPG(120_000 + i) : PNG(80_000 + i)
      files[`f${i}`] = bytes
      const f: PatientFile = { id: `f${i}`, patientId: `p${i % 30}`, kind: 'xray', name: `صورة ${i}.bin`, mime: 'image/jpeg', size: bytes.length, data: new Blob([bytes as BlobPart]), createdAt: at }
      await db.files.put(f)
    }
    await setSetting('installedAt', '2026-09-01T00:00:00.000Z')
    await setSetting('license', { code: 'OLD-DEVICE', plan: 'pro', until: null })
  }
  async function exportArchive(password?: string) {
    const sink = memorySink()
    await writeBackup(await snapshotDatabase(), sink.write, { password })
    return sink.blob()
  }
  async function checkFiles(n: number, restored = true) {
    expect(await db.files.count()).toBe(n)
    for (const f of await db.files.toArray()) {
      expect(sha(await blobBytes(f.data))).toBe(sha(files[f.id]))
      if (restored) expect(f.data.type).toBe(f.mime)
    }
  }

  it('names files .dentora with the local date and time', () => {
    expect(archiveFileName(new Date(2026, 9, 5, 9, 7))).toBe('dentora-backup-2026-10-05-0907.dentora')
  })

  it('20 files: export → wipe → read → restore gives byte-identical files and every row', async () => {
    await seedClinic(20)
    const blob = await exportArchive()
    expect(await detectBackup(blob)).toBe('archive')
    const before = { patients: await db.patients.count(), users: await db.users.count() }

    await resetDatabase()
    await setSetting('installedAt', '2026-10-10T00:00:00.000Z')            // a fresh install
    await setSetting('license', { code: 'THIS-DEVICE', plan: 'standard', until: null })
    const r = await readBackup(new File([blob], 'b.dentora'))
    expect(r.info).toMatchObject({ format: 2, encrypted: false, files: 20, damaged: [] })
    expect(r.summary).toMatchObject({ clinicName: 'عيادة الابتسامة', patients: 30 })
    await restoreBackup(r.data)
    expect(await db.patients.count()).toBe(before.patients)
    expect(await db.users.count()).toBe(before.users)
    await checkFiles(20)
    expect((await db.files.get('f0'))!.mime).toBe('application/pdf')   // the type is what the bytes are, not what was declared
    expect(await getSetting('installedAt', null)).toBe('2026-09-01T00:00:00.000Z')
    expect(await getSetting('license', null)).toEqual({ code: 'THIS-DEVICE', plan: 'standard', until: null })
  }, 60_000)

  it('a password-protected backup needs its password', async () => {
    await seedClinic(4)
    const blob = await exportArchive('سر العيادة 2026')
    expect(await detectBackup(blob)).toBe('encrypted')
    await expect(readBackup(blob)).rejects.toMatchObject({ reason: 'password' })
    await expect(readBackup(blob, { password: 'غلط غلط غلط' })).rejects.toMatchObject({ reason: 'password' })
    await resetDatabase()
    const r = await readBackup(blob, { password: 'سر العيادة 2026' })
    expect(r.info.encrypted).toBe(true)
    await restoreBackup(r.data)
    await checkFiles(4)
  }, 60_000)

  it('a damaged attachment is reported and left out; a damaged table refuses the whole file', async () => {
    await seedClinic(3)
    const bytes = await blobBytes(await exportArchive())
    const zip = await ZipReader.open(new Blob([bytes as BlobPart]))
    const e = [...zip.entries.values()].find(x => x.name.startsWith('files/f1/'))!
    const [start] = await zip.dataRange(e)
    const bad = bytes.slice(); bad[start + 500] ^= 0xff
    const r = await readBackup(new Blob([bad]))
    expect(r.info.damaged).toEqual(['صورة 1.bin'])
    expect(r.info.files).toBe(2)
    const t = [...zip.entries.values()].find(x => x.name.startsWith('tables/patients'))!
    const [ts] = await zip.dataRange(t)
    const badTable = bytes.slice(); badTable[ts + 3] ^= 0xff
    await expect(readBackup(new Blob([badTable]))).rejects.toBeInstanceOf(BackupError)
  }, 60_000)

  it('refuses newer versions and foreign files with a reason', async () => {
    await expect(readBackup(new Blob(['hello']))).rejects.toMatchObject({ reason: 'app' })
    await expect(readBackup(new Blob([JSON.stringify({ app: 'dentora', version: 9, tables: { clinic: [], users: [], patients: [] } })]))).rejects.toMatchObject({ reason: 'newer' })
    await expect(readBackup(new Blob(['{"app":"dentora",']))).rejects.toMatchObject({ reason: 'json' })
  })

  it('still reads the old single-JSON backups, with their files', async () => {
    const pic = JPG(5000)
    const legacy = {
      app: 'dentora', version: 1, exportedAt: at,
      tables: {
        clinic: [{ id: 'clinic', name: 'قديمة', createdAt: '2025-01-01T00:00:00.000Z' }], users: [{ id: 'u1', name: 'x' }], patients: [{ id: 'p1', name: 'y' }],
        files: [
          { id: 'f1', patientId: 'p1', kind: 'xray', name: 'a.jpg', mime: 'image/jpeg', size: 5000, data: 'data:image/jpeg;base64,' + Buffer.from(pic).toString('base64'), createdAt: at },
          { id: 'f2', patientId: 'p1', kind: 'document', name: 'report.pdf', mime: 'application/pdf', size: 30, data: 'data:text/html;base64,' + Buffer.from('<script>x()</script>').toString('base64'), createdAt: at },
          { id: 'f3', patientId: 'p1', kind: 'document', name: 'lost.pdf', mime: 'application/pdf', size: 30, data: 'https://evil.example/x', createdAt: at },
        ],
        settings: [{ key: 'installedAt', value: '2099-01-01T00:00:00.000Z' }],
      },
    }
    await resetDatabase()
    await setSetting('installedAt', '2026-10-10T00:00:00.000Z')
    const r = await readBackup(new Blob([JSON.stringify(legacy)]))
    expect(r.info).toMatchObject({ format: 1, files: 2, damaged: ['lost.pdf'] })
    await restoreBackup(r.data)
    const f1 = await db.files.get('f1')
    expect(sha(await blobBytes(f1!.data))).toBe(sha(pic))
    expect((await db.files.get('f2'))!.data.type).toBe('application/octet-stream')
    expect(await getSetting('installedAt', null)).toBe('2025-01-01T00:00:00.000Z')
  })

  it('a restore that fails half-way changes nothing', async () => {
    await seedClinic(2)
    const blob = await exportArchive()
    const r = await readBackup(blob)
    await db.patients.put({ id: 'new-after-export', fileNo: 99, name: 'جديد', gender: 'female', allergies: [], chronicDiseases: [], medications: [], tags: [], archived: false, createdAt: at, updatedAt: at })
    // a notes row IndexedDB cannot store (it holds a function) comes after patients and files in the restore order,
    // so it fails inside the transaction, after those tables were already replaced
    ;(r.data.tables as any).notes = [{ id: 'n1', text: 'x', bad: () => 1 }]
    await expect(restoreBackup(r.data)).rejects.toThrow()
    expect(await db.patients.get('new-after-export')).toBeTruthy()
    expect(await db.patients.count()).toBe(31)
    expect(await getSetting('license', null)).toEqual({ code: 'OLD-DEVICE', plan: 'pro', until: null })
    await checkFiles(2, false)
  }, 60_000)

  it('erase keeps the activation and trial start in the same transaction', async () => {
    await seedClinic(1)
    await setSetting('lastBackupAt', at)
    await eraseEverything()
    expect(await db.patients.count()).toBe(0)
    expect(await db.files.count()).toBe(0)
    expect(await getSetting('installedAt', null)).toBe('2026-09-01T00:00:00.000Z')
    expect(await getSetting('license', null)).toBeTruthy()
    expect(await getSetting('lastBackupAt', null)).toBeNull()
  })

  it('importBackup refuses rows without a key before touching anything', async () => {
    await seedClinic(0)
    await expect(importBackup({ app: 'dentora', version: 1, exportedAt: at, tables: { patients: [{ name: 'no id' }] } })).rejects.toThrow()
    expect(await db.patients.count()).toBe(30)
  })

  it('keeps only embedded pictures in logo, photo and thumbnail fields (a crafted backup cannot make the app load an address)', async () => {
    await resetDatabase()
    const png = 'data:image/png;base64,' + Buffer.from(PNG(64)).toString('base64')
    const r = await importBackup({
      app: 'dentora', version: 1, exportedAt: at,
      tables: {
        clinic: [{ id: 'clinic', name: 'x', logo: 'https://tracker.example/pixel.png?c=1', createdAt: at }],
        users: [{ id: 'u1', name: 'x' }],
        patients: [{ id: 'p1', name: 'a', photo: png }, { id: 'p2', name: 'b', photo: '//tracker.example/p.jpg' }, { id: 'p3', name: 'c', photo: 'javascript:alert(1)' }],
        files: [{ id: 'f1', patientId: 'p1', kind: 'photo', name: 'a.png', mime: 'image/png', size: 64, data: png, thumb: 'http://tracker.example/t.png', createdAt: at }],
      },
    })
    expect(r.skippedFiles).toBe(0)
    expect((await db.clinic.get('clinic'))!.logo).toBeUndefined()
    expect((await db.patients.get('p1'))!.photo).toBe(png)
    expect((await db.patients.get('p2'))!.photo).toBeUndefined()
    expect((await db.patients.get('p3'))!.photo).toBeUndefined()
    const f = await db.files.get('f1')
    expect(f!.thumb).toBeUndefined()
    expect(f!.data.type).toBe('image/png')
  })

  it('counts damaged files in good Arabic and English', () => {
    expect(translate('en', 'backup.damagedTitle', { n: 1 })).toBe('1 patient file in this backup could not be read')
    expect(translate('en', 'backup.damagedTitle', { n: 3 })).toBe('3 patient files in this backup could not be read')
    expect(translate('ar', 'backup.damagedTitle', { n: 1 })).toBe('تعذّرت قراءة ملف واحد من ملفات المرضى في هذه النسخة')
    expect(translate('ar', 'backup.damagedTitle', { n: 3 })).toBe('تعذّرت قراءة 3 ملفات من ملفات المرضى في هذه النسخة')
    expect(translate('ar', 'backup.restoredSkipped', { n: 12 })).toBe('لم يُستعد 12 ملفاً تالفاً.')
    expect(translate('en', 'backup.restoredSkipped', { n: 1 })).toBe('1 damaged file was not restored.')
    expect(translate('en', 'backup.damagedDesc', { n: 1, names: 'a.jpg' })).toBe('Everything else is restored without it: a.jpg')
    expect(translate('ar', 'backup.damagedDesc', { n: 4, names: 'a.jpg' })).toBe('تُستعاد بقية البيانات من دونها: a.jpg')
  })

  it('recognises a full disk', () => {
    expect(isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true)
    expect(isQuotaError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true)
    expect(isQuotaError(new Error('ENOSPC: no space left on device'))).toBe(true)
    expect(isQuotaError(new Error('nope'))).toBe(false)
  })
})
