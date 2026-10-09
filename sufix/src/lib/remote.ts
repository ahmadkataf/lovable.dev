// The API client. The admin session token lives in localStorage.
import type { Backend } from './backend'

const TOKEN_KEY = 'sufix_admin_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''
const setToken = (t: string) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  const token = getToken()
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { throw new ApiError(res.status, 'الخادم أعاد استجابة غير متوقعة') }
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/api/admin/') && !path.endsWith('/login') && !path.endsWith('/password')) setToken('')
    throw new ApiError(res.status, data?.error || `خطأ ${res.status}`)
  }
  return data as T
}

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const remote: Backend = {
  bootstrap: () => call('GET', '/api/bootstrap'),
  product: id => call('GET', `/api/products/${encodeURIComponent(id)}`),
  createOrder: o => call('POST', '/api/orders', o),
  orderWhatsapp: id => call('POST', `/api/orders/${id}/whatsapp`),
  createTicket: t => call('POST', '/api/tickets', t),
  ticketWhatsapp: id => call('POST', `/api/tickets/${id}/whatsapp`),
  track: (number, phone) => call('GET', `/api/track${qs({ number, phone })}`),
  uploadImage: async data => (await call<{ url: string }>('POST', getToken() ? '/api/admin/images' : '/api/images', { data })).url,
  admin: {
    status: () => call('GET', '/api/admin/status'),
    setup: async password => setToken((await call<{ token: string }>('POST', '/api/admin/setup', { password })).token),
    login: async password => setToken((await call<{ token: string }>('POST', '/api/admin/login', { password })).token),
    logout: async () => { await call('POST', '/api/admin/logout').catch(() => {}); setToken('') },
    changePassword: (current, password) => call('POST', '/api/admin/password', { current, password }),
    dashboard: () => call('GET', '/api/admin/dashboard'),
    reports: (from, to) => call('GET', `/api/admin/reports${qs({ from, to })}`),
    products: () => call('GET', '/api/admin/products'),
    saveProduct: p => (p.id ? call('PUT', `/api/admin/products/${p.id}`, p) : call('POST', '/api/admin/products', p)),
    deleteProduct: id => call('DELETE', `/api/admin/products/${id}`),
    categories: () => call('GET', '/api/admin/categories'),
    saveCategories: list => call('PUT', '/api/admin/categories', list),
    orders: (q, status) => call('GET', `/api/admin/orders${qs({ q, status })}`),
    updateOrder: (id, patch) => call('PATCH', `/api/admin/orders/${id}`, patch),
    deleteOrder: id => call('DELETE', `/api/admin/orders/${id}`),
    tickets: (q, status) => call('GET', `/api/admin/tickets${qs({ q, status })}`),
    createTicket: t => call('POST', '/api/admin/tickets', t),
    updateTicket: (id, patch) => call('PATCH', `/api/admin/tickets/${id}`, patch),
    deleteTicket: id => call('DELETE', `/api/admin/tickets/${id}`),
    ledger: (from, to, type) => call('GET', `/api/admin/ledger${qs({ from, to, type })}`),
    saveLedger: e => (e.id ? call('PUT', `/api/admin/ledger/${e.id}`, e) : call('POST', '/api/admin/ledger', e)),
    deleteLedger: id => call('DELETE', `/api/admin/ledger/${id}`),
    settings: () => call('GET', '/api/admin/settings'),
    saveSettings: s => call('PUT', '/api/admin/settings', s),
    clearDemo: () => call('POST', '/api/admin/demo/clear'),
    restoreDemo: () => call('POST', '/api/admin/demo/restore'),
    exportAll: () => call('GET', '/api/admin/export'),
    importAll: b => call('POST', '/api/admin/import', b),
  },
}
