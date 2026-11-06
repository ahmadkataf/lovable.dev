// CSV export: UTF-8 with BOM and CRLF so Excel opens Arabic text correctly.
export type Cell = string | number | boolean | null | undefined

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (rows: Cell[][]): string => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'

export function csvResponse(rows: Cell[][], filename: string): Response {
  return new Response(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
