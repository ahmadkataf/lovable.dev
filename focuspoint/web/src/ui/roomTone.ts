// Flat accent per room type, used for every room-type icon tile in the app (customer pages, site pages, team panel).
// Pair with the CSS classes `.room-swatch.<accent>` or `.tile-icon.<accent>` from styles.css.
import type { RoomType } from '@shared/types'

export type Accent = 'blue' | 'green' | 'violet' | 'sky' | 'teal' | 'rose'

export const ROOM_TONE: Record<RoomType, Accent> = { private: 'blue', meeting: 'violet', desk: 'teal', hall: 'sky' }

/** The accent for a room type (blue when the type is unknown). */
export const roomTone = (type: RoomType | null | undefined): Accent => (type && ROOM_TONE[type]) || 'blue'
