// The book this build is for. `@book` resolves to src/books/<BOOK>/ (see vite.config.ts).
import { book, exams, modules } from '@book'

export { book, exams, modules }
export const allUnits = modules.flatMap(m => m.units)
export function findUnit(id: string) { return allUnits.find(u => u.id === id) }
export function moduleOfUnit(id: string) { return modules.find(m => m.units.some(u => u.id === id)) }
