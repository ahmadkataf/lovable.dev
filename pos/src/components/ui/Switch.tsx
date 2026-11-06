import type { ReactNode } from 'react'

export function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} className={`switch ${on ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(!on)} />
}

export function SwitchRow({ label, desc, on, onChange, disabled }: { label: ReactNode; desc?: ReactNode; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="switch-row">
      <div className="grow"><div className="bold">{label}</div>{desc && <div className="desc">{desc}</div>}</div>
      <Switch on={on} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export function Seg<T extends string>({ value, onChange, options, block }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; block?: boolean }) {
  return (
    <div className={`seg ${block ? 'block' : ''}`} role="tablist">
      {options.map(o => <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}
