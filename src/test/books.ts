// Every test runs against every book the app is built for.
import type { BookMeta, Module } from '../engine/types'
import * as g8 from '../books/g8'
import * as g11 from '../books/g11'
import * as g12 from '../books/g12'

export const books: { book: BookMeta; modules: Module[] }[] = [g8, g11, g12]
