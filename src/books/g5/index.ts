import type { BookMeta, Module } from '../../engine/types'
import meta from './book.json'
import { module1 } from './module1'
import { module2 } from './module2'
import { module3 } from './module3'
import { module4 } from './module4'

export const book: BookMeta = meta
export const modules: Module[] = [module1, module2, module3, module4]
export { exams } from './exams'
