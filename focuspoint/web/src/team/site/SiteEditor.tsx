// /team/site — «الموقع» (admin): every customer-visible text, image and link of the website and the Android app.
// The list shows one card per section of CONTENT_SECTIONS (معدّل / الأصل, last save, unsaved draft); a card opens
// its SectionEditor at /team/site/<section>. Loaded lazily by TeamApp (staff never need it).
import { useEffect, type ReactElement } from 'react'
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { CONTENT_SECTIONS, isSectionId } from '@shared/content'
import { useOnline } from '../../offline'
import { SiteIcon } from '../../pages/site/SiteIcon'
import { Badge, Button, Icon, Spinner } from '../../ui'
import { PageHead } from '../common'
import { SectionEditor, whenLabel } from './SectionEditor'
import { siteErrorText } from './media'
import { siteState, useSiteState } from './state'

export default function SiteEditor() {
  useEffect(() => { void siteState.load() }, [])
  return (
    <Routes>
      <Route index element={<SectionList />} />
      <Route path=":section" element={<SectionRoute />} />
      <Route path="*" element={<Navigate to="/team/site" replace />} />
    </Routes>
  )
}

/** Waits for the content (or a cached copy) before mounting the editor, so the form starts from the real values. */
function Loading({ children }: { children: () => ReactElement }) {
  const st = useSiteState()
  if (st.content) return children()
  if (st.status === 'error') {
    return (
      <div className="se-page">
        <PageHead title="الموقع" />
        <div className="alert alert-error">{siteErrorText(st.error)}</div>
        <Button className="mt" variant="soft" onClick={() => void siteState.load()}>جرّب كمان مرة</Button>
      </div>
    )
  }
  return <div className="center center-pad"><Spinner /></div>
}

function SectionRoute() {
  const { section } = useParams()
  const spec = CONTENT_SECTIONS.find((s) => s.id === section)
  if (!isSectionId(section) || !spec) return <Navigate to="/team/site" replace />
  return <Loading>{() => <SectionEditor key={spec.id} spec={spec} />}</Loading>
}

function SectionList() {
  const st = useSiteState()
  const online = useOnline()
  return (
    <div className="se-page">
      <PageHead title="الموقع" sub="نصوص وصور وروابط الموقع والتطبيق. أي «حفظ» بيطلع عالموقع فوراً.">
        <a className="btn btn-soft btn-md" href="/" target="_blank" rel="noopener noreferrer"><Icon name="eye" size={18} /> عرض الموقع</a>
      </PageHead>
      {!online && (
        <div className="se-offline" role="status">
          <Icon name="cloudOff" size={18} />
          <div><b>دون اتصال بالإنترنت.</b> فيك تفتح الأقسام وتكتب، بس الحفظ بيستنى رجعة الاتصال.</div>
        </div>
      )}
      <Loading>
        {() => (
          <>
            {st.updated_at && <p className="muted tiny mb">آخر تعديل عالموقع: {whenLabel(st.updated_at)}</p>}
            {st.error != null && <div className="alert alert-error mb">{siteErrorText(st.error)} — منعرض آخر نسخة وصلت لهالجهاز.</div>}
            <div className="se-cards">
              {CONTENT_SECTIONS.map((s) => {
                const overridden = st.overridden.includes(s.id)
                const last = st.history[s.id]?.[0]?.saved_at
                const draft = st.drafts[s.id]
                return (
                  <Link key={s.id} to={`/team/site/${s.id}`} className="card se-card" data-section={s.id}>
                    <span className="se-card-icon"><SiteIcon name={s.icon} size={22} /></span>
                    <span className="se-card-body">
                      <span className="se-card-top">
                        <span className="se-card-title">{s.title}</span>
                        {overridden ? <Badge tone="wine">معدّل</Badge> : <Badge tone="grey">الأصل</Badge>}
                      </span>
                      <span className="se-card-help">{s.help}</span>
                      {(last || draft) && (
                        <span className="se-card-meta">
                          {last && overridden && <span>آخر حفظ: {whenLabel(last)}</span>}
                          {draft && <span className="se-card-draft"><span className="se-dot" /> تعديلات ما انحفظت</span>}
                        </span>
                      )}
                    </span>
                    <Icon name="back" size={18} className="se-card-go" />
                  </Link>
                )
              })}
            </div>
            <Link to="/team/settings" className="card se-card se-card-settings">
              <span className="se-card-icon"><Icon name="settings" size={22} /></span>
              <span className="se-card-body">
                <span className="se-card-title">خيارات الحجز والدفع</span>
                <span className="se-card-help">تشغيل وإيقاف الحجز، شام كاش والدفع عند الوصول، المهل والتذكير: من الإعدادات.</span>
              </span>
              <Icon name="back" size={18} className="se-card-go" />
            </Link>
          </>
        )}
      </Loading>
    </div>
  )
}
