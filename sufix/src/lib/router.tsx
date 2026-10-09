// A small History-API router: <Link>, navigate(), useRoute() with :params.
import React, { createContext, useContext, useEffect, useState } from 'react'

type RouterState = { path: string; search: URLSearchParams }
const Ctx = createContext<RouterState>({ path: '/', search: new URLSearchParams() })
const listeners = new Set<() => void>()

// The preview build (an embedded single page) keeps the route in the hash: #/shop?category=drones
const HASH = import.meta.env.VITE_HASH_ROUTER === '1'

function read(): RouterState {
  if (HASH) {
    const h = window.location.hash.replace(/^#/, '') || '/'
    const [p, q = ''] = h.split('?')
    return { path: p.replace(/\/+$/, '') || '/', search: new URLSearchParams(q) }
  }
  return { path: window.location.pathname.replace(/\/+$/, '') || '/', search: new URLSearchParams(window.location.search) }
}

export function navigate(to: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  const url = HASH ? `#${to}` : to
  if (opts.replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  listeners.forEach(l => l())
  if (opts.scroll !== false) window.scrollTo({ top: 0 })
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(read)
  useEffect(() => {
    const update = () => setState(read())
    listeners.add(update)
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    return () => { listeners.delete(update); window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update) }
  }, [])
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

export const useRoute = () => useContext(Ctx)

/** Matches "/product/:id" against the current path and returns the params, or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const keys: string[] = []
  const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
  const m = path.match(re)
  if (!m) return null
  const params: Record<string, string> = {}
  keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])))
  return params
}

export function Link({ to, children, className, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={HASH ? `#${to}` : to}
      className={className}
      onClick={e => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
