// The floor plan as a responsive SVG (flat): walls are slate blocks, free rooms white with a slate border and a brand
// label, busy rooms slate-hatched, the selected room solid brand with white text.
import type { Plan, Room } from '@shared/types'

export type RoomPlanStatus = 'free' | 'busy' | 'selected' | 'inactive'

export interface PlanViewProps {
  plan: Plan
  rooms: Room[]
  status: (room: Room) => RoomPlanStatus
  onSelect?: (room: Room) => void
  selectedId?: number | null
  className?: string
}

const STATUS_TEXT: Record<RoomPlanStatus, string> = { free: 'متاحة', busy: 'محجوزة', selected: 'مختارة', inactive: 'غير متاحة' }

export function PlanView({ plan, rooms, status, onSelect, selectedId, className }: PlanViewProps) {
  const W = Math.max(1, plan.width)
  const H = Math.max(1, plan.height)
  // Font sizes scale with the plan so labels stay readable whatever the plan units are.
  const unit = Math.min(W, H) / 100
  const nameSize = Math.max(2.2 * unit, 3)
  const capSize = Math.max(1.8 * unit, 2.4)
  const radius = 1.2 * unit

  return (
    <svg
      className={['plan', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="مخطط المركز"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="plan-hatch" width={2 * unit} height={2 * unit} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={2 * unit} height={2 * unit} fill="#f1f5f9" />
          <line x1="0" y1="0" x2="0" y2={2 * unit} stroke="#cbd5e1" strokeWidth={0.6 * unit} />
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx={radius} className="plan-floor" />
      {plan.walls.map((w, i) => (
        <rect key={`w${i}`} x={w.x} y={w.y} width={w.w} height={w.h} className="plan-wall" />
      ))}
      {rooms.map((room) => {
        if (!room.plan) return null
        const r = room.plan
        const s: RoomPlanStatus = room.id === selectedId ? 'selected' : status(room)
        const clickable = !!onSelect && s !== 'inactive'
        const cx = r.x + r.w / 2
        // Labels grow with the room box (so they stay legible when the plan is drawn phone-narrow), never past it.
        const fit = Math.min(r.h * 0.16, (r.w * 0.86) / Math.max(4, room.name.length * 0.58))
        const ns = Math.min(Math.max(nameSize, fit), nameSize * 2.2)
        const cs = ns * 0.78
        const twoLines = r.h > ns * 3.2
        return (
          <g
            key={room.id}
            className={`plan-room is-${s} ${clickable ? 'is-clickable' : ''}`}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={`${room.name} — ${STATUS_TEXT[s]}`}
            onClick={clickable ? () => onSelect?.(room) : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(room) } } : undefined}
          >
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={radius} fill={s === 'busy' ? 'url(#plan-hatch)' : undefined} />
            <text x={cx} y={twoLines ? r.y + r.h / 2 - cs * 0.55 : r.y + r.h / 2} fontSize={ns} textAnchor="middle" dominantBaseline="central" className="plan-name">
              {room.name}
            </text>
            {twoLines && (
              <text x={cx} y={r.y + r.h / 2 + ns * 0.95} fontSize={cs} textAnchor="middle" dominantBaseline="central" className="plan-cap">
                {room.capacity} {room.capacity === 1 ? 'شخص' : room.capacity === 2 ? 'شخصين' : 'أشخاص'}
              </text>
            )}
          </g>
        )
      })}
      {plan.labels.map((l, i) => {
        // Keep a zone label inside the wall strip it sits on: turn it upright in a tall narrow strip, else shrink it to fit.
        let fs = capSize * 1.6
        let rotate = false
        const est = (n: number) => l.text.length * n * 0.58
        const wall = plan.walls.find((w) => l.x >= w.x && l.x <= w.x + w.w && l.y >= w.y && l.y <= w.y + w.h)
        if (wall && est(fs) > wall.w * 0.9) {
          if (wall.h > wall.w) {
            rotate = true
            fs = Math.min(fs, wall.w * 0.62, (wall.h * 0.9) / (l.text.length * 0.58))
          } else {
            fs = Math.max(capSize, (wall.w * 0.9) / (l.text.length * 0.58))
          }
        }
        return (
          <text key={`l${i}`} x={l.x} y={l.y} fontSize={fs} textAnchor="middle" dominantBaseline="central" className="plan-label"
            transform={rotate ? `rotate(-90 ${l.x} ${l.y})` : undefined}>{l.text}</text>
        )
      })}
    </svg>
  )
}
