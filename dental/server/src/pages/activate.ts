// /activate and /en/activate: a clinic turns its licence key into the activation code of its device, once, online
// (docs/LICENCE-KEYS.md → Public activation). The page is the legal pages' shell (header, footer, fonts, colours)
// around a form that /js/activate.js posts to /api/activate. Nothing inline, per the CSP: the words the script needs
// travel in a JSON block the browser never runs. Styles: the activation section of /css/legal.css.
import { escapeHtml } from '../http'
import { formatDeviceInput, isDeviceNumber } from '../licence'
import { DEFAULT_SETTINGS, type Lang, type SiteSettings } from '../types'
import type { IconName } from './content'
import { ICONS, jsonForScript } from './landing'
import { sellerWa, shell, type PageAssets } from './legal'

/** What activate.js shows: every reason /api/activate gives, plus its own (empty fields, no network, a pasted code). */
interface ScriptText {
  /** Locale for Intl (dates, plural rules), with Latin digits like the rest of the site. */
  locale: string
  sending: string
  /** One sentence per error code; {time} in `locked` is one of `minutes`. */
  err: Record<'deviceEmpty' | 'keyEmpty' | 'device' | 'key' | 'code' | 'unknown' | 'used' | 'void' | 'expired' | 'locked' | 'signing' | 'network' | 'server', string>
  /** "{n} minutes" by plural category (Intl.PluralRules); `other` is the fallback. */
  minutes: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }
  plans: Record<'standard' | 'pro', string>
  lifetime: string
  /** {date}: the last day, written out. */
  until: string
  copy: string
  copied: string
  copyFailed: string
  /** The WhatsApp help message, and the lines added when the form holds a device number or a key. */
  wa: string
  waDevice: string
  waKey: string
}

interface ActivateCopy {
  title: string
  description: string
  kicker: string
  h1: string
  lead: string
  formTitle: string
  noscript: string
  device: string
  deviceHint: string
  deviceWhere: string
  key: string
  keyHint: string
  bind: string
  submit: string
  sent: string
  done: { title: string; lead: string; plan: string; validity: string; device: string; code: string; stepsTitle: string; steps: string[]; offline: string; again: string; keep: string }
  where: { title: string; steps: string[]; note: string; mock: { settings: string; licence: string; device: string; copy: string } }
  app: { title: string; text: string }
  privacy: { title: string; text: string }
  help: { title: string; text: string; button: string }
  script: ScriptText
}

// Where the device number is, kept on one line (no-break spaces) in the sentences that name it.
const PATH = { ar: 'Dentora\u00A0←\u00A0الإعدادات\u00A0←\u00A0الترخيص', en: 'Dentora\u00A0→\u00A0Settings\u00A0→\u00A0Licence' }

const T: Record<Lang, ActivateCopy> = {
  ar: {
    title: 'تفعيل الترخيص — Dentora',
    description: 'فعّل برنامج Dentora لإدارة عيادة الأسنان بمفتاح الترخيص: أدخل رقم الجهاز والمفتاح، واحصل فوراً على رمز التفعيل الخاص بجهازك.',
    kicker: 'Dentora · التفعيل',
    h1: 'فعّل Dentora بمفتاح الترخيص',
    lead: 'أدخل رقم جهازك ومفتاح الترخيص الذي وصلك بعد الشراء، لتحصل على رمز التفعيل الخاص بجهازك. تلصقه في البرنامج مرة واحدة، فيعمل بعدها دون إنترنت.',
    formTitle: 'احصل على رمز التفعيل',
    noscript: 'تحتاج هذه الصفحة إلى تشغيل JavaScript في المتصفح. إن تعذّر ذلك فراسلنا على واتساب لنساعدك في التفعيل.',
    device: 'رقم الجهاز',
    deviceHint: `8\u00A0خانات، تجده في ${PATH.ar}.`,
    deviceWhere: 'أين أجده؟',
    key: 'مفتاح الترخيص',
    keyHint: 'الصق رسالة البائع كما وصلتك، أو المفتاح وحده (16\u00A0خانة): يُستخرج المفتاح منها تلقائياً، والمسافات والشرطات لا تهم.',
    bind: 'يرتبط المفتاح نهائياً برقم الجهاز الذي تُدخله، فتأكد من الرقم قبل المتابعة.',
    submit: 'احصل على رمز التفعيل',
    sent: 'لا يُرسل إلا المفتاح ورقم الجهاز، ولا شيء من بيانات عيادتك أو مرضاك.',
    done: {
      title: 'رمز التفعيل جاهز',
      lead: 'هذا رمز التفعيل الخاص بجهازك، الصقه في البرنامج على الجهاز نفسه.',
      plan: 'الباقة', validity: 'الصلاحية', device: 'رقم الجهاز', code: 'رمز التفعيل',
      stepsTitle: 'الخطوة الأخيرة: الصقه في Dentora',
      steps: ['افتح Dentora على الجهاز الذي أدخلت رقمه.', 'اذهب إلى الإعدادات ← الترخيص.', 'الصق الرمز في خانة رمز التفعيل، ثم اضغط «تفعيل».'],
      offline: 'لا يحتاج البرنامج الإنترنت في هذه الخطوة. وإن كان على جهاز آخر، فأرسل الرمز إلى نفسك عبر واتساب أو البريد والصقه هناك.',
      keep: 'احتفظ بالمفتاح: إن أعدت تثبيت البرنامج على الجهاز نفسه، تعطيك هذه الصفحة الرمز نفسه مرة أخرى.',
      again: 'تفعيل مفتاح آخر',
    },
    where: {
      title: 'أين أجد رقم الجهاز؟',
      steps: ['افتح Dentora على الجهاز الذي تريد تفعيله.', 'اذهب إلى الإعدادات ← الترخيص.', 'انسخ «رقم الجهاز» بزر «نسخ الرقم» والصقه هنا.'],
      note: 'الرقم ثابت لهذا الجهاز ولا يكشف شيئاً عن بياناتك. وإن فتحت هذه الصفحة من داخل البرنامج تجده مكتوباً مسبقاً.',
      mock: { settings: 'الإعدادات', licence: 'الترخيص', device: 'رقم الجهاز', copy: 'نسخ الرقم' },
    },
    app: {
      title: 'أو فعّله من داخل البرنامج',
      text: 'في الإصدار 1.1.0 وما بعده، الصق المفتاح مباشرة في الإعدادات ← الترخيص والجهاز متصل بالإنترنت، فيُفعَّل البرنامج دون هذه الصفحة.',
    },
    privacy: {
      title: 'ما الذي يُرسل؟',
      text: 'المفتاح ورقم الجهاز فقط، مرة واحدة، لإصدار رمز التفعيل. يحفظ الخادم رقم الجهاز ووقت التفعيل مع الترخيص كي لا يُستخدم المفتاح على جهاز آخر، ويعدّ المحاولات الخاطئة من كل عنوان مدة 15 دقيقة لمنع التخمين. أما بيانات العيادة والمرضى فلا يرسلها Dentora إلى أي مكان.',
    },
    help: {
      title: 'تحتاج مساعدة؟',
      text: 'راسلنا على واتساب ونساعدك في التفعيل خطوة بخطوة.',
      button: 'راسلنا على واتساب',
    },
    script: {
      locale: 'ar-SY-u-ca-gregory-nu-latn',
      sending: 'جارٍ إصدار الرمز…',
      err: {
        deviceEmpty: 'أدخل رقم الجهاز.',
        keyEmpty: 'أدخل مفتاح الترخيص.',
        device: `رقم الجهاز غير صحيح: يتكوّن من 8 خانات من أحرف إنجليزية وأرقام. انسخه من ${PATH.ar}.`,
        key: 'المفتاح غير مكتمل أو فيه خطأ: يتكوّن من 16 خانة من أحرف إنجليزية وأرقام، ليس بينها 0 ولا O ولا 1 ولا I. انسخه من رسالة البائع كما هو.',
        code: `هذا رمز تفعيل جاهز وليس مفتاح ترخيص، فلا حاجة إلى هذه الصفحة: الصقه مباشرة في ${PATH.ar}.`,
        unknown: 'لم نجد هذا المفتاح. قارنه خانةً خانة برسالة البائع، أو راسلنا على واتساب.',
        used: 'هذا المفتاح مُفعَّل على جهاز آخر، وكل مفتاح يفعّل جهازاً واحداً فقط. إن أدخلت رقم الجهاز خطأً في المرة الأولى أو غيّرت جهازك، فراسلنا على واتساب.',
        void: 'هذا المفتاح مُلغى أو استُرِدّ ثمنه، فلا يمكن التفعيل به. إن كنت تظن أن في ذلك خطأً فراسلنا على واتساب.',
        expired: 'انتهت صلاحية هذا المفتاح قبل أن يُفعَّل. راسلنا على واتساب لتجديده.',
        locked: 'محاولات خاطئة كثيرة من هذا الاتصال. انتظر {time} ثم حاول مرة أخرى.',
        signing: 'تعذّر إصدار رمز التفعيل الآن بسبب عطل مؤقت لدينا. حاول مرة أخرى بعد قليل، وإن تكرر ذلك فراسلنا على واتساب.',
        network: 'تعذّر الاتصال بالخادم. تأكد من اتصال الإنترنت ثم حاول مرة أخرى.',
        server: 'حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل، وإن تكرر ذلك فراسلنا على واتساب.',
      },
      minutes: { one: 'دقيقة واحدة', two: 'دقيقتين', few: '{n} دقائق', many: '{n} دقيقة', other: '{n} دقيقة' },
      plans: { standard: 'الباقة الأساسية', pro: 'الباقة الاحترافية' },
      lifetime: 'ترخيص دائم',
      until: 'صالح حتى {date}',
      copy: 'نسخ الرمز',
      copied: 'نُسخ الرمز',
      copyFailed: 'تعذّر النسخ، وقد حدّدنا الرمز لك: انسخه يدوياً.',
      wa: 'مرحباً، أحتاج مساعدة في تفعيل Dentora بمفتاح الترخيص.',
      // ‎ keeps a device number such as 2345-ABCD from showing as ABCD-2345 inside Arabic text
      waDevice: 'رقم الجهاز: ‎{device}',
      waKey: 'المفتاح: ‎{key}',
    },
  },
  en: {
    title: 'Activate your licence — Dentora',
    description: 'Activate Dentora dental clinic software with your licence key: enter your device number and the key, and get the activation code for your device at once.',
    kicker: 'Dentora · Activation',
    h1: 'Activate Dentora with your licence key',
    lead: 'Enter your device number and the licence key you received after buying, and get the activation code for your device. Paste it into Dentora once, and from then on it works offline.',
    formTitle: 'Get your activation code',
    noscript: 'This page needs JavaScript turned on in your browser. If you cannot turn it on, message us on WhatsApp and we will help you activate.',
    device: 'Device number',
    deviceHint: `8 characters, in ${PATH.en}.`,
    deviceWhere: 'Where is it?',
    key: 'Licence key',
    keyHint: 'Paste the seller’s message as it came, or just the key (16\u00A0characters): the key is picked out automatically, and spaces and dashes do not matter.',
    bind: 'The key is tied for good to the device number you enter, so check the number before you continue.',
    submit: 'Get activation code',
    sent: 'Only the key and the device number are sent, nothing from your clinic or patients.',
    done: {
      title: 'Your activation code is ready',
      lead: 'This code belongs to your device. Paste it into Dentora on that same device.',
      plan: 'Plan', validity: 'Validity', device: 'Device number', code: 'Activation code',
      stepsTitle: 'Last step: paste it into Dentora',
      steps: ['Open Dentora on the device whose number you entered.', 'Go to Settings → Licence.', 'Paste the code into the activation code field and press “Activate”.'],
      offline: 'Dentora needs no internet for this step. If it is on another device, send the code to yourself by WhatsApp or e-mail and paste it there.',
      keep: 'Keep your key: if you reinstall Dentora on the same device, this page gives you the same code again.',
      again: 'Activate another key',
    },
    where: {
      title: 'Where do I find my device number?',
      steps: ['Open Dentora on the device you want to activate.', 'Go to Settings → Licence.', 'Copy the “Device number” with “Copy number” and paste it here.'],
      note: 'The number is fixed for that device and reveals nothing about your data. If you opened this page from inside Dentora, it is already filled in.',
      mock: { settings: 'Settings', licence: 'Licence', device: 'Device number', copy: 'Copy number' },
    },
    app: {
      title: 'Or activate inside Dentora',
      text: 'From version 1.1.0, paste the key straight into Settings → Licence while the device is online, and Dentora activates without this page.',
    },
    privacy: {
      title: 'What is sent?',
      text: 'Only the key and the device number, once, to issue the activation code. The server keeps the device number and the activation time with your licence so the key cannot be used on another device, and counts wrong attempts from each address for 15 minutes to stop guessing. Dentora never sends clinic or patient data anywhere.',
    },
    help: {
      title: 'Need help?',
      text: 'Message us on WhatsApp and we will walk you through the activation.',
      button: 'Message us on WhatsApp',
    },
    script: {
      locale: 'en-GB',
      sending: 'Getting your code…',
      err: {
        deviceEmpty: 'Enter your device number.',
        keyEmpty: 'Enter your licence key.',
        device: `That device number is not valid: it has 8 letters and digits. Copy it from ${PATH.en}.`,
        key: 'That key is incomplete or has a typo: it has 16 letters and digits, never 0, O, 1 or I. Copy it from the seller’s message exactly.',
        code: `This is already an activation code, not a licence key, so you do not need this page: paste it straight into ${PATH.en}.`,
        unknown: 'We could not find this key. Check it character by character against the seller’s message, or message us on WhatsApp.',
        used: 'This key is already activated on another device, and each key activates one device only. If you mistyped the device number the first time, or changed your device, message us on WhatsApp.',
        void: 'This key has been cancelled or refunded, so it cannot be used. If you think this is a mistake, message us on WhatsApp.',
        expired: 'This key expired before it was activated. Message us on WhatsApp to renew it.',
        locked: 'Too many wrong attempts from this connection. Wait {time}, then try again.',
        signing: 'The activation code cannot be issued right now because of a temporary fault on our side. Try again shortly; if it keeps happening, message us on WhatsApp.',
        network: 'Could not reach the server. Check your internet connection and try again.',
        server: 'Something went wrong. Try again shortly; if it keeps happening, message us on WhatsApp.',
      },
      minutes: { one: '1 minute', other: '{n} minutes' },
      plans: { standard: 'Standard plan', pro: 'Pro plan' },
      lifetime: 'Lifetime licence',
      until: 'Valid until {date}',
      copy: 'Copy code',
      copied: 'Code copied',
      copyFailed: 'Could not copy. The code is selected: copy it by hand.',
      wa: 'Hello, I need help activating Dentora with my licence key.',
      waDevice: 'Device number: {device}',
      waKey: 'Key: {key}',
    },
  },
}

/** An inline icon (the landing page's set); stroke and fill come from .ic. */
const ic = (name: IconName, cls = '') =>
  `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`

/** The seller's wa.me link, or the default number's when the settings hold none (as the landing page does). */
function sellerChat(s: SiteSettings): string {
  const digits = String(s.whatsapp ?? '').replace(/\D/g, '').replace(/^00/, '')
  return sellerWa(digits.length >= 8 && digits.length <= 15 ? digits : DEFAULT_SETTINGS.whatsapp)
}

function field(id: string, name: string, label: string, hint: string, value: string, placeholder: string, extra = ''): string {
  return `<div class="act-field">
<label for="act-${id}">${escapeHtml(label)}</label>
<input class="act-input act-input-${id}" id="act-${id}" name="${name}" type="text" dir="ltr" value="${escapeHtml(value)}" placeholder="${placeholder}" required autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" aria-describedby="act-${id}-hint act-${id}-err">
<p class="act-hint" id="act-${id}-hint">${escapeHtml(hint)}${extra}</p>
<p class="act-err" id="act-${id}-err" hidden>${ic('circleAlert')}<span></span></p>
</div>`
}

/** The whole page. `device` is the router's validated ?device= ('' when none); it is checked and escaped again here. */
export function renderActivate(lang: Lang, s: SiteSettings, origin: string, assets: PageAssets, device: string): string {
  const t = T[lang]
  const dev = device && isDeviceNumber(device) ? formatDeviceInput(device) : ''
  const chat = sellerChat(s)
  const helpText = dev ? `${t.script.wa}\n${t.script.waDevice.replace('{device}', dev)}` : t.script.wa
  const where = ` <a href="#act-where">${escapeHtml(t.deviceWhere)}</a>`
  const list = (items: string[]) => items.map(x => `<li>${escapeHtml(x)}</li>`).join('')
  const m = t.where.mock
  const body = `<main id="main" class="legal-main act">
<div class="legal-hero act-hero"><div class="container legal-wrap">
<p class="legal-kicker">${escapeHtml(t.kicker)}</p>
<h1>${escapeHtml(t.h1)}</h1>
<p class="act-lead">${escapeHtml(t.lead)}</p>
</div></div>
<div class="container legal-wrap act-grid">
<div class="act-primary">
<section class="act-card" id="act-start" aria-labelledby="act-form-title">
<h2 id="act-form-title">${escapeHtml(t.formTitle)}</h2>
<noscript><p class="act-alert act-noscript">${ic('circleAlert')}<span>${escapeHtml(t.noscript)}</span></p></noscript>
<form class="act-form" id="act-form" action="/api/activate" method="post" novalidate>
${field('device', 'device', t.device, t.deviceHint, dev, 'XXXX-XXXX', where)}
${field('key', 'key', t.key, t.keyHint, '', 'XXXX-XXXX-XXXX-XXXX')}
<p class="act-note">${ic('info')}<span>${escapeHtml(t.bind)}</span></p>
<div class="act-alert-region" id="act-alert" role="alert"><p class="act-alert" hidden>${ic('circleAlert')}<span></span></p></div>
<button class="btn btn-primary btn-lg btn-block legal-btn act-submit" type="submit">${ic('loaderCircle', 'act-spin')}<span>${escapeHtml(t.submit)}</span></button>
<p class="act-sent">${ic('lockKeyhole')}<span>${escapeHtml(t.sent)}</span></p>
</form>
</section>
<section class="act-card act-done" id="act-done" aria-labelledby="act-done-title" hidden>
<div class="act-done-head"><span class="act-done-icon">${ic('badgeCheck')}</span><div><h2 id="act-done-title" tabindex="-1">${escapeHtml(t.done.title)}</h2><p>${escapeHtml(t.done.lead)}</p></div></div>
<dl class="act-facts">
<div><dt>${escapeHtml(t.done.plan)}</dt><dd id="act-plan"></dd></div>
<div><dt>${escapeHtml(t.done.validity)}</dt><dd id="act-validity"></dd></div>
<div><dt>${escapeHtml(t.done.device)}</dt><dd><bdi dir="ltr" id="act-done-device"></bdi></dd></div>
</dl>
<h3 class="act-code-title" id="act-code-title">${escapeHtml(t.done.code)}</h3>
<div class="act-code" id="act-code" dir="ltr" translate="no" role="group" aria-labelledby="act-code-title"></div>
<div class="act-copy-row">
<button class="btn btn-primary btn-lg legal-btn act-copy" id="act-copy" type="button">${ic('copy', 'act-copy-icon')}${ic('check', 'act-copied-icon')}<span>${escapeHtml(t.script.copy)}</span></button>
<p class="act-copy-note" id="act-copy-note" hidden></p>
</div>
<h3 class="act-steps-title">${escapeHtml(t.done.stepsTitle)}</h3>
<ol class="act-steps">${list(t.done.steps)}</ol>
<p class="act-tip">${ic('wifiOff')}<span>${escapeHtml(t.done.offline)}</span></p>
<p class="act-tip">${ic('keyRound')}<span>${escapeHtml(t.done.keep)}</span></p>
<button class="btn btn-outline legal-btn legal-btn-ghost act-again" id="act-again" type="button">${escapeHtml(t.done.again)}</button>
</section>
<section class="act-side" aria-labelledby="act-privacy-title">
<h2 id="act-privacy-title"><span class="act-side-icon">${ic('shieldCheck')}</span>${escapeHtml(t.privacy.title)}</h2>
<p>${escapeHtml(t.privacy.text)}</p>
</section>
</div>
<aside class="act-aside">
<section class="act-side" id="act-where" aria-labelledby="act-where-title">
<h2 id="act-where-title"><span class="act-side-icon">${ic('settings')}</span>${escapeHtml(t.where.title)}</h2>
<div class="act-mock" aria-hidden="true">
<p class="act-mock-path"><span>Dentora</span>${ic(lang === 'ar' ? 'arrowLeft' : 'arrowRight')}<span>${escapeHtml(m.settings)}</span>${ic(lang === 'ar' ? 'arrowLeft' : 'arrowRight')}<span>${escapeHtml(m.licence)}</span></p>
<div class="act-mock-row"><span class="act-mock-k">${escapeHtml(m.device)}</span><span class="act-mock-v" dir="ltr">7KQ4-M2XD</span><span class="act-mock-btn">${ic('copy')}${escapeHtml(m.copy)}</span></div>
</div>
<ol class="act-steps act-steps-sm">${list(t.where.steps)}</ol>
<p class="act-side-note">${escapeHtml(t.where.note)}</p>
</section>
<section class="act-side" aria-labelledby="act-app-title">
<h2 id="act-app-title"><span class="act-side-icon">${ic('monitorSmartphone')}</span>${escapeHtml(t.app.title)}</h2>
<p>${escapeHtml(t.app.text)}</p>
</section>
<section class="act-side act-help" aria-labelledby="act-help-title">
<h2 id="act-help-title"><span class="act-side-icon">${ic('messageCircle')}</span>${escapeHtml(t.help.title)}</h2>
<p>${escapeHtml(t.help.text)}</p>
<a class="btn btn-wa btn-block legal-btn act-wa" id="act-wa" href="${escapeHtml(`${chat}?text=${encodeURIComponent(helpText)}`)}" rel="noopener" target="_blank">${ic('messageCircle')}<span>${escapeHtml(t.help.button)}</span></a>
</section>
</aside>
</div>
<p class="sr-only act-sr" id="act-status" role="status"></p>
</main>
<script type="application/json" id="act-text">${jsonForScript({ ...t.script, chat })}</script>
<script src="/js/activate.js" defer></script>`
  return shell({ lang, title: t.title, description: t.description, origin, assets, path: '/activate', body })
}
