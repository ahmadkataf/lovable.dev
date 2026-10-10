import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n, useTSafe } from '@/i18n'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T, index: number) => ReactNode
  className?: string            // e.g. 'num' | 'actions'
  width?: number | string
  hideBelow?: 'sm' | 'md' | 'lg' // responsive: hide on small screens
}
export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  compact?: boolean
  footer?: ReactNode
  className?: string
  rowClassName?: (row: T) => string | undefined
}
const HIDE: Record<string, string> = { sm: 'hide-below-sm', md: 'hide-below-md', lg: 'hide-below-lg' }

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty, compact, footer, className, rowClassName }: DataTableProps<T>) {
  return (
    <div className={['table-wrap', className].filter(Boolean).join(' ')}>
      <table className={['table', compact && 'table-compact'].filter(Boolean).join(' ')}>
        <thead><tr>{columns.map(c => <th key={c.key} className={[c.className, c.hideBelow && HIDE[c.hideBelow]].filter(Boolean).join(' ')} style={{ width: c.width }}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && empty ? <tr><td colSpan={columns.length} style={{ padding: 0 }}>{empty}</td></tr>
            : rows.map((r, i) => (
              <tr key={rowKey(r)} className={[onRowClick && 'clickable', rowClassName?.(r)].filter(Boolean).join(' ')} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map(c => <td key={c.key} className={[c.className, c.hideBelow && HIDE[c.hideBelow]].filter(Boolean).join(' ')}>{c.render(r, i)}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
      {footer}
    </div>
  )
}

export function usePagination<T>(rows: T[], pageSize = 25) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const slice = useMemo(() => rows.slice((current - 1) * pageSize, current * pageSize), [rows, current, pageSize])
  return { page: current, pages, setPage, slice, total: rows.length, from: rows.length ? (current - 1) * pageSize + 1 : 0, to: Math.min(rows.length, current * pageSize) }
}

export function Pagination({ page, pages, setPage, from, to, total }: { page: number; pages: number; setPage: (p: number) => void; from: number; to: number; total: number }) {
  const { t } = useI18n()
  const tt = useTSafe()
  if (total === 0) return null
  const nums: number[] = []
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p)
  return (
    <div className="table-footer">
      <span className="num">{t('showing', { from, to, total })}</span>
      {pages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={tt('previous')} title={tt('previous')}><ChevronLeft /></button>
          {nums[0] > 1 && <><button onClick={() => setPage(1)}>1</button>{nums[0] > 2 && <span className="muted">…</span>}</>}
          {nums.map(p => <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>)}
          {nums[nums.length - 1] < pages && <>{nums[nums.length - 1] < pages - 1 && <span className="muted">…</span>}<button onClick={() => setPage(pages)}>{pages}</button></>}
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label={tt('next')} title={tt('next')}><ChevronRight /></button>
        </div>
      )}
    </div>
  )
}
