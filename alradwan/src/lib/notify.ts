// A toast from code that has no React context (library helpers): the provider registers itself here.
let fn: ((msg: string, kind: 'error' | 'success' | 'info') => void) | null = null
export function setNotify(f: typeof fn) { fn = f }
export function notifyError(msg: string) { fn?.(msg, 'error') }
