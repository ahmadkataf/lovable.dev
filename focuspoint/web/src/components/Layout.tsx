// Customer shell for every customer route: offline bar, sticky site header, the page, site footer, phone bottom nav.
// Site pages (/, /spaces, /about, /contact) are full-width and lay out their own sections (.section > .container);
// the booking-flow pages (/book, /book/:roomId, /b/:id, /mine, /inbox) sit in the narrow .page column.
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { OfflineBar } from '../ui'
import { BottomNav, SiteFooter, SiteHeader } from './site'

const SITE_PAGES = new Set(['/', '/spaces', '/about', '/contact'])

export function Layout() {
  const { pathname } = useLocation()
  const site = SITE_PAGES.has(pathname)
  // New page → start at the top (the router keeps the scroll position otherwise).
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="app">
      <OfflineBar />
      <SiteHeader />
      <main className={site ? 'site-main' : 'page'}>
        <Outlet />
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  )
}
