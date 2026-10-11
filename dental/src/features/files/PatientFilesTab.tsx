import FilesSection from './FilesSection'
import NotesSection from './NotesSection'
import './files.css'

/** A tab of the patient profile. Receives the patient id and renders its own data: files & images, then clinical notes. */
export default function PatientFilesTab({ patientId }: { patientId: string }) {
  return (
    <div className="pt-files-tab">
      <FilesSection patientId={patientId} />
      <NotesSection patientId={patientId} />
    </div>
  )
}
