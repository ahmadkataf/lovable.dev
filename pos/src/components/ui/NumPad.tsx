import { Delete } from 'lucide-react'

export interface NumPadProps {
  value: string
  onChange: (v: string) => void
  decimals?: number          // 0 hides the dot
  onEnter?: () => void
  enterLabel?: string
  maxLength?: number
  extra?: { label: string; onClick: () => void }[]   // quick buttons shown above the keys
}

/** A big touch keypad. `value` is the text being typed ("12.5"); the caller parses it. */
export function NumPad({ value, onChange, decimals = 2, onEnter, enterLabel, maxLength = 12, extra }: NumPadProps) {
  const press = (k: string) => {
    if (k === '⌫') { onChange(value.slice(0, -1)); return }
    if (k === 'C') { onChange(''); return }
    if (k === '.') { if (decimals === 0 || value.includes('.')) return; onChange((value || '0') + '.'); return }
    if (value.length >= maxLength) return
    if (value.includes('.') && value.split('.')[1].length >= decimals) return
    onChange(value === '0' ? k : value + k)
  }
  return (
    <div className="col">
      {extra && extra.length > 0 && (
        <div className="row wrap">{extra.map(e => <button key={e.label} type="button" className="btn soft sm grow" onClick={e.onClick}>{e.label}</button>)}</div>
      )}
      <div className="numpad">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(k => <button key={k} type="button" onClick={() => press(k)}>{k}</button>)}
        <button type="button" onClick={() => press(decimals > 0 ? '.' : 'C')}>{decimals > 0 ? '.' : 'C'}</button>
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" onClick={() => press('⌫')} aria-label="backspace"><Delete size={22} /></button>
        {onEnter && <button type="button" className="accent" style={{ gridColumn: '1 / -1' }} onClick={onEnter}>{enterLabel ?? 'OK'}</button>}
      </div>
    </div>
  )
}
