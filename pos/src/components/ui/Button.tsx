import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'default' | 'primary' | 'accent' | 'danger' | 'soft' | 'soft-danger' | 'ghost' | 'outline'
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
  iconOnly?: boolean
  loading?: boolean
  block?: boolean
  round?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon, iconOnly, loading, block, round, className = '', children, type = 'button', ...rest }, ref,
) {
  const cls = ['btn', variant !== 'default' ? variant : '', size !== 'md' ? size : '', iconOnly ? 'icon' : '', loading ? 'loading' : '', block ? 'block' : '', round ? 'round' : '', className].filter(Boolean).join(' ')
  return (
    <button ref={ref} type={type} className={cls} {...rest} aria-busy={loading || undefined}>
      {loading ? <span className="spinner sm" /> : icon}
      {!iconOnly && children}
    </button>
  )
})
