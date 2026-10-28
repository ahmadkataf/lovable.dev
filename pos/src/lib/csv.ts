import { platform } from './platform'

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')
}

/** Reads a CSV (comma or semicolon separated, quotes, any line ending). Returns rows of strings. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const sep = (text.split('\n')[0]?.split(';').length ?? 0) > (text.split('\n')[0]?.split(',').length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(x => x.trim() !== ''))
}

export async function saveCsv(name: string, rows: (string | number | null | undefined)[][]): Promise<boolean> {
  return platform.saveFile(name, 'text/csv;charset=utf-8', toCsv(rows))
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(file)
  })
}

/** Opens the file picker and returns the chosen file, or null. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = accept
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = () => { resolve(input.files?.[0] ?? null); input.remove() }
    // cancel: the dialog closes without a change event
    const onFocus = () => { setTimeout(() => { if (document.body.contains(input)) { input.remove(); resolve(null) } }, 800); window.removeEventListener('focus', onFocus) }
    window.addEventListener('focus', onFocus)
    input.click()
  })
}
