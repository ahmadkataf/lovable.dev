// /history: every receipt grouped by day with filters and a number / barcode search; /history/:id the receipt
// with its details, reprint, share and refunds.
import './i18n'
import './history.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import { HistoryList } from './HistoryList'
import { SaleDetail } from './SaleDetail'

export default function HistoryScreen() {
  return (
    <Routes>
      <Route index element={<HistoryList />} />
      <Route path=":id" element={<SaleDetail />} />
      <Route path="*" element={<Navigate to="/history" replace />} />
    </Routes>
  )
}
