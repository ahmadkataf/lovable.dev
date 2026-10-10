import type { Appointment } from '@/db/types'
/** Create / edit an appointment. `defaults` pre-fills a new one (from the calendar or a patient page). */
export interface AppointmentFormModalProps { open: boolean; onClose: () => void; appointment?: Appointment; defaults?: { patientId?: string; date?: string; time?: string; doctorId?: string }; onSaved?: (id: string) => void }
export default function AppointmentFormModal(_: AppointmentFormModalProps) { return null }
