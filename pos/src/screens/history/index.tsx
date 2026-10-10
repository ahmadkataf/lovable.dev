// /history: every receipt grouped by day with filters and a number / barcode search; /history/:id the receipt
// with its details, reprint, share and refunds. Cashiers reach it only with the cashierSeeHistory permission.
import './i18n'
import './history.css'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useT } from '../../i18n'
import { Empty } from '../../components/ui'
import { useSettings, useUser } from '../../state/store'
import { allowed } from '../../lib/audit'
import { HistoryList } from './HistoryList'
import { SaleDetail } from './SaleDetail'

export default function HistoryScreen() {
  const t = useT()
  const user = useUser()
  const settings = useSettings()
  if (!allowed(user, settings, 'cashierSeeHistory')) {
    return (
      <div className="page"><div className="page-body">
        <Empty icon={<ShieldAlert size={32} />} title={t('nav.history')} text={t('common.noPermission')} action={<Link to="/" className="btn primary">{t('common.back')}</Link>} />
      </div></div>
    )
  }
  return (
    <Routes>
      <Route index element={<HistoryList />} />
      <Route path=":id" element={<SaleDetail />} />
      <Route path="*" element={<Navigate to="/history" replace />} />
    </Routes>
  )
}
