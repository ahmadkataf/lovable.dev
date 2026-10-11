// The 404 page, in Arabic and English at once (a wrong link says nothing about the reader's language). Static: it
// needs no database, so it still answers when everything else is failing.
import { shell, type PageAssets } from './legal'

export function renderNotFound(origin: string, assets: PageAssets): string {
  const body = `<main id="main" class="legal-main legal-404">
<div class="container legal-wrap">
<p class="legal-404-code" aria-hidden="true">404</p>
<section class="legal-404-block" lang="ar" dir="rtl">
<h1>الصفحة غير موجودة</h1>
<p>ربما تغيّر الرابط أو كُتب بشكل خاطئ. يمكنك متابعة التصفح من الصفحة الرئيسية.</p>
<a class="btn btn-primary legal-btn" href="/">الصفحة الرئيسية</a>
</section>
<section class="legal-404-block" lang="en" dir="ltr">
<h2>Page not found</h2>
<p>The link may have changed or been mistyped. You can carry on from the home page.</p>
<a class="btn btn-outline legal-btn legal-btn-ghost" href="/en">Home page in English</a>
</section>
</div>
</main>`
  return shell({ lang: 'ar', title: 'الصفحة غير موجودة · Page not found — Dentora', description: 'Dentora', origin, assets, path: null, langSwitch: false, body })
}
