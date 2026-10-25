// The floor plan as a responsive SVG. Walls are light blocks, rooms are rounded rectangles coloured by status.
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
          <rect width={2 * unit} height={2 * unit} fill="#ece6df" />
          <line x1="0" y1="0" x2="0" y2={2 * unit} stroke="#cfc6bd" strokeWidth={0.6 * unit} />
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
        const twoLines = r.h > nameSize * 3.2
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
            <text x={cx} y={twoLines ? r.y + r.h / 2 - capSize * 0.4 : r.y + r.h / 2} fontSize={nameSize} textAnchor="middle" dominantBaseline="central" className="plan-name">
              {room.name}
            </text>
            {twoLines && (
              <text x={cx} y={r.y + r.h / 2 + nameSize * 0.95} fontSize={capSize} textAnchor="middle" dominantBaseline="central" className="plan-cap">
                {room.capacity} {room.capacity === 1 ? 'شخص' : room.capacity === 2 ? 'شخصين' : 'أشخاص'}
              </text>
            )}
          </g>
        )
      })}
      {plan.labels.map((l, i) => (
        <text key={`l${i}`} x={l.x} y={l.y} fontSize={capSize} textAnchor="middle" dominantBaseline="central" className="plan-label">{l.text}</text>
      ))}
    </svg>
  )
}
