import type { Module } from '../engine/types'
import { module1 } from './module1'
import { module2 } from './module2'
import { module3 } from './module3'
import { module4 } from './module4'
import { module5 } from './module5'
import { module6 } from './module6'

export const modules: Module[] = [module1, module2, module3, module4, module5, module6]
export const allUnits = modules.flatMap(m => m.units)
export function findUnit(id: string) { return allUnits.find(u => u.id === id) }
export function moduleOfUnit(id: string) { return modules.find(m => m.units.some(u => u.id === id)) }
