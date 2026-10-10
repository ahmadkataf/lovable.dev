// /customers: the list with search / sort / debt filter and the new-customer sheet; /customers/:id the account
// (balance, payments, adjustments, statement, receipts, WhatsApp reminder, print / export).
import './i18n'
import './customers.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import { CustomerList } from './CustomerList'
import { CustomerDetail } from './CustomerDetail'

export { CustomerForm } from './CustomerForm'

export default function CustomersScreen() {
  return (
    <Routes>
      <Route index element={<CustomerList />} />
      <Route path=":id" element={<CustomerDetail />} />
      <Route path="*" element={<Navigate to="/customers" replace />} />
    </Routes>
  )
}
