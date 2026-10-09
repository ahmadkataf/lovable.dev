import React, { lazy, Suspense } from 'react'
import { RouterProvider, matchPath, useRoute } from './lib/router'
import { StoreProvider } from './lib/store'
import { SiteLayout } from './components/Layout'
import { Spinner } from './components/ui'
import { HomePage } from './pages/Home'
import { ShopPage } from './pages/Shop'
import { ProductPage } from './pages/Product'
import { DjiPage } from './pages/Dji'
import { CartPage, CheckoutPage, OrderDonePage } from './pages/Cart'
import { TrackPage } from './pages/Track'
import { RepairPage, RepairDonePage } from './pages/Repair'
import { AboutPage, ContactPage, NotFoundPage } from './pages/Static'

const AdminApp = lazy(() => import('./admin/AdminApp').then(m => ({ default: m.AdminApp })))

function Routes() {
  const { path } = useRoute()
  if (path === '/admin' || path.startsWith('/admin/')) return <Suspense fallback={<Spinner />}><AdminApp /></Suspense>
  let page: React.ReactNode
  let m: Record<string, string> | null
  if (path === '/') page = <HomePage />
  else if (path === '/shop') page = <ShopPage />
  else if ((m = matchPath('/product/:id', path))) page = <ProductPage id={m.id} />
  else if (path === '/dji') page = <DjiPage />
  else if (path === '/cart') page = <CartPage />
  else if (path === '/checkout') page = <CheckoutPage />
  else if ((m = matchPath('/order/:id', path))) page = <OrderDonePage id={m.id} />
  else if (path === '/track') page = <TrackPage />
  else if (path === '/repair') page = <RepairPage />
  else if ((m = matchPath('/repair/done/:id', path))) page = <RepairDonePage id={m.id} />
  else if (path === '/about') page = <AboutPage />
  else if (path === '/contact') page = <ContactPage />
  else page = <NotFoundPage />
  return <SiteLayout>{page}</SiteLayout>
}

export function App() {
  return (
    <RouterProvider>
      <StoreProvider>
        <Routes />
      </StoreProvider>
    </RouterProvider>
  )
}
