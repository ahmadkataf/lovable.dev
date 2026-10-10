/** Record a payment for a patient, optionally against one invoice. */
export interface PaymentFormModalProps { open: boolean; onClose: () => void; patientId?: string; invoiceId?: string; onSaved?: (id: string) => void }
export default function PaymentFormModal(_: PaymentFormModalProps) { return null }
