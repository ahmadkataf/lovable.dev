import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'danger-soft' | 'success'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  block?: boolean
  pill?: boolean
  icon?: ReactNode          // leading icon
  iconEnd?: ReactNode
  to?: string               // renders a router Link instead
}
export function buttonClass({ variant = 'secondary', size = 'md', block, pill, loading, iconOnly, className }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; pill?: boolean; loading?: boolean; iconOnly?: boolean; className?: string }) {
  return ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', pill && 'btn-pill', loading && 'btn-loading', iconOnly && 'btn-icon', className].filter(Boolean).join(' ')
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', loading, block, pill, icon, iconEnd, to, className, children, disabled, type = 'button', ...rest }, ref) {
  const cls = buttonClass({ variant, size, block, pill, loading, iconOnly: !children && !!icon && !iconEnd, className })
  const inner = <>{loading && <span className="spinner" />}{icon}{children && <span>{children}</span>}{iconEnd}</>
  if (to) return <Link to={to} className={cls} aria-disabled={disabled} {...(rest as any)}>{inner}</Link>
  return <button ref={ref} type={type} className={cls} disabled={disabled || loading} {...rest}>{inner}</button>
})

/** A square icon-only button; pass `label` for screen readers and the tooltip. */
export function IconButton({ label, children, ...rest }: Omit<ButtonProps, 'icon' | 'children'> & { label: string; children: ReactNode }) {
  return <Button {...rest} icon={children} aria-label={label} title={label} />
}
