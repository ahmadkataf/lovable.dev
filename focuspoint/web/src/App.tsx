// Router: customer screens under the Layout shell; the team panel (written separately) lazily under /team/*.
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { PublicSettings } from '@shared/types'
import { TeamProvider } from './team'
import { NotificationsProvider } from './lib/notifications'
import { Layout } from './components/Layout'
import { BookHome } from './pages/Home'
import { Book } from './pages/Book'
import { BookingPage } from './pages/BookingPage'
import { Mine } from './pages/Mine'
import { Inbox } from './pages/Inbox'
import { Spinner, ToastHost } from './ui'
import { useCached } from './lib/data'
import { ensurePushSubscription } from './lib/push'
import { setTimeZone } from './format'

const TeamApp = lazy(() => import('./team/TeamApp'))
// Site pages (introduce the centre) load on demand; the booking flow stays in the main bundle.
const Landing = lazy(() => import('./pages/site/Landing'))
const Spaces = lazy(() => import('./pages/site/Spaces'))
const About = lazy(() => import('./pages/site/About'))
const Contact = lazy(() => import('./pages/site/Contact'))

/** Keeps an already-granted push subscription registered with the server (new browser, rotated endpoint…) and
 *  applies the centre's time zone to every date shown. */
function PushKeeper() {
  const { data: settings } = useCached<PublicSettings>('/v1/settings')
  useEffect(() => {
    if (settings?.vapid_public_key) ensurePushSubscription(settings.vapid_public_key).catch(() => { /* best effort */ })
  }, [settings?.vapid_public_key])
  useEffect(() => { setTimeZone(settings?.timezone) }, [settings?.timezone])
  return null
}

function FullSpinner() {
  return <div className="center" style={{ minHeight: '60vh' }}><Spinner /></div>
}

const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<FullSpinner />}>{children}</Suspense>

export default function App() {
  return (
    <BrowserRouter>
      <TeamProvider>
        <NotificationsProvider>
          <PushKeeper />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Lazy><Landing /></Lazy>} />
              <Route path="/spaces" element={<Lazy><Spaces /></Lazy>} />
              <Route path="/about" element={<Lazy><About /></Lazy>} />
              <Route path="/contact" element={<Lazy><Contact /></Lazy>} />
              <Route path="/book" element={<BookHome />} />
              <Route path="/book/:roomId" element={<Book />} />
              <Route path="/b/:id" element={<BookingPage />} />
              <Route path="/mine" element={<Mine />} />
              <Route path="/inbox" element={<Inbox />} />
            </Route>
            <Route path="/team/*" element={<Suspense fallback={<FullSpinner />}><TeamApp /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastHost />
        </NotificationsProvider>
      </TeamProvider>
    </BrowserRouter>
  )
}
