import type { Expense } from '@/db/types'
export interface ExpenseFormModalProps { open: boolean; onClose: () => void; expense?: Expense; onSaved?: (id: string) => void }
export default function ExpenseFormModal(_: ExpenseFormModalProps) { return null }
