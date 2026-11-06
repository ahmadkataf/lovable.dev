// Shared bits of the expenses screens: category icon and badge.
import { Building2, CircleDashed, FlaskConical, Hammer, Landmark, Megaphone, Package, Stethoscope, Users, Zap, type LucideIcon } from 'lucide-react'
import type { ExpenseCategory } from '@/db/types'
import { Badge } from '@/ui'
import { useI18n } from '@/i18n'
import { CATEGORY_TONE } from './lib'

export const CATEGORY_ICON: Record<ExpenseCategory, LucideIcon> = {
  rent: Building2, salaries: Users, materials: Package, lab: FlaskConical, equipment: Stethoscope, utilities: Zap, marketing: Megaphone, maintenance: Hammer, taxes: Landmark, other: CircleDashed,
}

export function ExpenseCategoryBadge({ category }: { category: ExpenseCategory }) {
  const { t } = useI18n()
  const I = CATEGORY_ICON[category] ?? CircleDashed
  return <Badge tone={CATEGORY_TONE[category] === 'default' ? 'default' : CATEGORY_TONE[category] ?? 'default'} icon={<I />}>{t(`exp.${category}`)}</Badge>
}
