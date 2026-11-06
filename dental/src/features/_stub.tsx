import { Construction } from 'lucide-react'
import { EmptyState } from '@/ui'

/** Placeholder shown by feature files that have not been built yet. */
export function Stub({ name }: { name: string }) {
  return <div className="page"><EmptyState icon={<Construction />} title={name} description="This module is being built." /></div>
}
export function StubTab({ name }: { name: string }) {
  return <EmptyState compact icon={<Construction />} title={name} description="This tab is being built." />
}
