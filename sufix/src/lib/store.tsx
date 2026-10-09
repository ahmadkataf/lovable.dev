// Site-wide state: the bootstrap data (settings, categories, products), the cart, toasts and the theme.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { CartItem, Category, DroneModel, Product, SiteSettings } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import { DJI_DRONES } from '@shared/dji'
import { api } from './api'
import type { Bootstrap } from './backend'

type Toast = { id: number; text: string; kind: 'ok' | 'err' | 'info' }

interface Store {
  ready: boolean
  error: string | null
  settings: SiteSettings
  categories: Category[]
  products: Product[]
  drones: DroneModel[]
  reload: () => Promise<void>
  cart: CartItem[]
  cartCount: number
  cartTotal: number
  addToCart: (p: Product, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  toast: (text: string, kind?: Toast['kind']) => void
  toasts: Toast[]
}

const Ctx = createContext<Store>(null!)
const CART_KEY = 'sufix_cart'

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

export function applyTheme(s: SiteSettings) {
  const root = document.documentElement
  root.dataset.theme = s.theme
  const p = hexToRgb(s.primaryColor), a = hexToRgb(s.accentColor)
  if (p) root.style.setProperty('--primary-rgb', p)
  if (a) root.style.setProperty('--accent-rgb', a)
  document.title = s.seo.title || s.siteName
  document.querySelector('meta[name="description"]')?.setAttribute('content', s.seo.description || s.tagline)
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Bootstrap>({ settings: DEFAULT_SETTINGS, categories: [], products: [], drones: DJI_DRONES })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>(() => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') } catch { return [] } })
  const [toasts, setToasts] = useState<Toast[]>([])

  const reload = useCallback(async () => {
    try {
      const b = await api.bootstrap()
      setData(b)
      applyTheme(b.settings)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setReady(true)
    }
  }, [])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, text, kind }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  const addToCart = useCallback((p: Product, qty = 1) => {
    setCart(c => {
      const i = c.findIndex(x => x.productId === p.id)
      if (i >= 0) return c.map((x, k) => (k === i ? { ...x, qty: Math.min(x.qty + qty, Math.max(1, p.stock)) } : x))
      return [...c, { productId: p.id, name: p.name, price: p.price, qty, image: p.images[0], illustration: p.illustration }]
    })
    toast('أُضيف إلى السلة')
  }, [toast])
  const setQty = useCallback((id: string, qty: number) => setCart(c => c.map(x => (x.productId === id ? { ...x, qty: Math.max(1, qty) } : x))), [])
  const removeFromCart = useCallback((id: string) => setCart(c => c.filter(x => x.productId !== id)), [])
  const clearCart = useCallback(() => setCart([]), [])

  const value = useMemo<Store>(() => ({
    ready, error, ...data, reload, cart, cartCount: cart.reduce((s, x) => s + x.qty, 0), cartTotal: cart.reduce((s, x) => s + x.qty * x.price, 0),
    addToCart, setQty, removeFromCart, clearCart, toast, toasts,
  }), [ready, error, data, reload, cart, addToCart, setQty, removeFromCart, clearCart, toast, toasts])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
