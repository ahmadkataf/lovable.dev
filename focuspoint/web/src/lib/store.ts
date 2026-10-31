// Small per-device memory (localStorage): the customer's name/phone, one-time prompts, dismissals.
const CUSTOMER = 'fp_customer'

export interface RememberedCustomer { name: string; phone: string }

function read(key: string): string | null { try { return localStorage.getItem(key) } catch { return null } }
function write(key: string, value: string | null) { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* ignore */ } }

export function getCustomer(): RememberedCustomer {
  try { return { name: '', phone: '', ...(JSON.parse(read(CUSTOMER) || '{}') as Partial<RememberedCustomer>) } } catch { return { name: '', phone: '' } }
}
export function setCustomer(c: RememberedCustomer) { write(CUSTOMER, JSON.stringify(c)) }

export type Flag = 'fp_push_asked' | 'fp_prompt_push' | 'fp_install_dismissed'
export function flag(key: Flag): string | null { return read(key) }
export function setFlag(key: Flag, value: string | null = '1') { write(key, value) }
