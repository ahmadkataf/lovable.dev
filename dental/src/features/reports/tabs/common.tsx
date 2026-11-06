import { useEffect, type ReactNode } from 'react'
import { CalendarRange } from 'lucide-react'
import { Button, Card, EmptyState } from '@/ui'
import { useI18n } from '@/i18n'
import type { Period } from '../queries'
import type { ReportData } from '../useReportData'
import { fmtPeriod } from '../parts'

export interface ExportSpec { name: string; rows: (string | number | null | undefined)[][] }
export interface TabProps {
  period: Period
  data: ReportData | undefined
  /** The tab registers the table "Export CSV" writes (null = nothing to export). */
  setExport: (e: ExportSpec | null) => void
  /** Switches the period to this year (the empty-state action). */
  onShowYear?: () => void
}

/** Registers the active table for the CSV button while the tab is shown. */
export function useExport(setExport: TabProps['setExport'], spec: ExportSpec | null) {
  const key = spec ? JSON.stringify(spec) : ''
  useEffect(() => { setExport(spec) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setExport(null), [setExport])
}

/** The whole tab is empty for this period: say so, and offer a longer period and the page where data is entered. */
export function EmptyTab({ icon, title, desc, period, onShowYear, action }: { icon: ReactNode; title: string; desc: string; period: Period; onShowYear?: () => void; action?: ReactNode }) {
  const { t, lang } = useI18n()
  return (
    <Card className="rp-empty-tab" data-testid="rp-empty">
      <EmptyState icon={icon} title={title} description={desc.replace('{range}', fmtPeriod(period, lang))}
        actions={<>{onShowYear && <Button variant="primary" icon={<CalendarRange />} onClick={onShowYear}>{t('reports.showYear')}</Button>}{action}</>} />
    </Card>
  )
}

/** File-name friendly date range: 2026-10-01_2026-10-31. */
export const rangeSlug = (p: Period) => `${p.from}_${p.to}`
