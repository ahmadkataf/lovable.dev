import type { Patient } from '@/db/types'
/** Create / edit a patient. onSaved receives the saved patient's id. */
export interface PatientFormModalProps { open: boolean; onClose: () => void; patient?: Patient; onSaved?: (id: string) => void }
export default function PatientFormModal(_: PatientFormModalProps) { return null }
