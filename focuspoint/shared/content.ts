// Focus Point — the site content contract, shared by api/ and web/ (pure TypeScript: no imports, no DOM, no Node).
//
// The admin edits every customer-visible text, image and link of the website (and the Android app, which shows the
// same site) from the team panel › «الموقع». The API stores only the sections the admin saved; everything else comes
// from DEFAULT_CONTENT, which is today's site, word for word. See docs/cms/DESIGN.md.
//
// Rendering rules (web and api follow them, so an edit never changes the look of anything around it)
// - Live data: {placeholders} take their values from siteTemplateVars() (settings, brand, rooms) on the pages and from
//   the booking in notifications; names and meanings: TEMPLATE_VARS. Unknown placeholders stay as typed, so a typo shows.
// - Page texts render through textParts(): a Latin run (THINK OUTSIDE THE BOX) → <bdi dir="ltr" className="fp-nowrap">,
//   {phone} {instagram} → <bdi dir="ltr" className="num">, {code} {ref} → <b className="num">. Notifications, <title>,
//   meta tags, JSON-LD and the WhatsApp text use plain fillTemplate().
// - Fields marked `rich` may contain **emphasis** (brand colour in headings, bold in body text) and [label](link):
//   parseRich() first, then textParts() on each part, so live data can never inject a link.
// - Wording that depends on the booking settings comes as variants of one field: `x` is today's wording (Sham Cash and
//   pay-on-arrival both on, customers may cancel, reminders on); `x_shamcash_only` (pay-on-arrival off), `x_cash_only`
//   (Sham Cash off), `x_no_cancel` (customer_can_cancel off) and `x_no_reminder` (reminder_minutes 0) replace it.
//   Pick with pickVariant(x, 'field', wordingFlags(settings)); an empty variant means "same as x".
// - Empty optional texts and links ('') hide the element they feed. Headings are required (min 1).
// - Pictures: Photo.alt is required (except in fields marked `decorative`); grids and cards show photoSmall(p).

// ---------- icons ----------

/** Every icon name the site can draw: web/src/pages/site/SiteIcon.tsx EXTRA first, then web/src/ui/Icon.tsx. */
export const SITE_ICONS = [
  'sun', 'quiet', 'arrow', 'instagram', 'map', 'book', 'laptop', 'present', 'heart', 'award', 'wallet', 'spark', 'zoom',
  'chevron',
  'chair', 'table', 'screen', 'wifi', 'ac', 'coffee', 'whiteboard', 'projector', 'door', 'people', 'clock', 'pin',
  'phone', 'bell', 'calendar', 'check', 'x', 'plus', 'edit', 'trash', 'logout', 'home', 'list', 'settings', 'chart',
  'qr', 'copy', 'send', 'back', 'filter', 'download', 'user', 'search', 'grid', 'cloud', 'cloudOff', 'sync', 'menu',
  'arrowLeft', 'arrowRight', 'briefcase', 'sparkle', 'cash', 'card', 'shield', 'bulb', 'external', 'target', 'window',
  'whatsapp',
] as const
export type SiteIconName = (typeof SITE_ICONS)[number]

/** Room equipment the site names (RoomContents keys = their icon names), in the order the site lists them. */
export const AMENITY_KEYS = ['wifi', 'ac', 'screen', 'whiteboard', 'projector', 'coffee'] as const
export type AmenityKey = (typeof AMENITY_KEYS)[number]

// ---------- the content model ----------

/** A picture on the site. */
export interface Photo {
  src: string          // '/img/…' (shipped with the site) or '/media/<id>.webp|.jpg|.png' (uploaded from the editor)
  alt: string          // what the photo shows — required: screen readers, and the gallery's caption and zoom label
  w: number; h: number // pixel size of src (the page reserves the space; `small` keeps the same ratio)
  small?: string       // optional ≤720 px variant for grids and cards. Uploads have none: always read photoSmall(p)
}

export type HomeSectionId = 'hero' | 'facts' | 'features' | 'spaces' | 'how' | 'gallery' | 'visit' | 'faq' | 'cta'
export const HOME_SECTION_IDS: readonly HomeSectionId[] = ['hero', 'facts', 'features', 'spaces', 'how', 'gallery', 'visit', 'faq', 'cta']
export type SpaceGroupId = 'private' | 'meeting' | 'open'
/**
 * The announcement bar: info → --blue-50 band with a --blue icon; success → --green-50 band with a --green icon;
 * warning → a neutral --surface-2 band with a --warn dot (styles.css: --warn is for text and dots, never a background).
 */
export type AnnouncementTone = 'info' | 'success' | 'warning'

/** One landing section in display order; tint = grey band behind it (ignored by hero, facts and cta). */
export interface HomeSectionRef { id: HomeSectionId; visible: boolean; tint: boolean }
export interface IconCard { icon: SiteIconName; title: string; text: string }
export interface HeroChip { icon: SiteIconName; text: string; text_shamcash_only: string; text_cash_only: string }
export interface FactItem { icon: SiteIconName; value: string; label: string }
export interface HowStep {
  icon: SiteIconName
  title: string; title_shamcash_only: string; title_cash_only: string
  text: string; text_shamcash_only: string; text_cash_only: string
}
export interface FaqItem { q: string; a: string; a_shamcash_only: string; a_cash_only: string; a_no_cancel: string }
export interface TextItem { text: string }
export interface AmenityItem { key: AmenityKey }
/** A public space group (rooms are grouped by type: private → private, meeting/hall → meeting, desk → open). */
export interface SpaceGroupText {
  title: string; blurb: string
  cap: string                // capacity line shown while the rooms are not loaded or the group has no active room (live rooms win)
  badge: string              // tag on the photo of the home page card ('' = none)
  icon: SiteIconName
  photo: Photo | null        // null → the drawn placeholder; a room's own photos win on the room cards
  amenities: AmenityItem[]   // listed while the rooms are not loaded or the group has none; else what every room of the group has
}
export interface MessageText { title: string; body: string }

export interface SiteContent {
  brand: {
    name_latin: string       // wordmark next to the logo (header, menu, footer)
    subtitle: string         // small line under the wordmark
    eyebrow: string          // «المشروع الأول من نوعه بدرعا» — hero pill; {eyebrow} in other texts
    slogan: string           // {slogan} in other texts
    logo: Photo | null       // header/footer/menu logo; null = the built-in shared/logo.svg. The browser-tab icon and the
                             // installed-app icons are build files (web/public/icons) and do not follow it
    whatsapp: string         // WhatsApp number; '' = the centre phone (settings.phone). Shown as intlPhone(), linked as whatsappLink()
    email: string            // '' = hidden
    maps_url: string         // exact map link; '' = a Google Maps search for settings.address
    facebook_url: string     // '' = hidden
    tiktok_url: string       // '' = hidden
    play_url: string         // Google Play link of the Android app; '' = hidden
    status_open: string      // live badge on the hours cards (home «زورنا», /contact) while the centre is open
    status_closed: string    // … while it is closed ({open} = the opening hour)
  }
  announcement: { enabled: boolean; text: string; link_label: string; link_url: string; tone: AnnouncementTone }   // link_label and link_url go together
  home: {
    sections: HomeSectionRef[]
    hero: { title: string; lead: string; chips: HeroChip[]; photo: Photo; badge_icon: SiteIconName; badge_title: string; badge_text: string }
    facts: { label: string; items: FactItem[] }   // label: the strip's aria-label
    features: { kicker: string; title: string; lead: string; items: IconCard[] }
    spaces: { kicker: string; title: string; lead: string }
    how: { kicker: string; title: string; steps: HowStep[] }
    /** The mosaic has exactly four photo slots (wide, tall, wide-low, small) plus the brand-colour quote tile in the third
     *  place. The quote renders one line per line with dir="auto"; its aria-label is the lines joined by spaces. */
    gallery: { kicker: string; title: string; lead: string; photos: Photo[]; quote: string }
    visit: { kicker: string; title: string; lead: string; hours_title: string; hours_line: string; address_title: string }
    faq: { kicker: string; title: string; lead: string; items: FaqItem[] }
    cta: { title: string; text: string; text_shamcash_only: string; text_cash_only: string }   // also the CTA band of /about
  }
  spaces: {
    kicker: string; title: string; lead: string
    groups: Record<SpaceGroupId, SpaceGroupText>
    price_from: string; price_from_short: string; price_unit: string; price_unknown: string   // «تبدأ من 15,000 ل.س بالساعة»
    empty_title: string; empty_text: string                                                  // /spaces with no active room
    cta_title: string; cta_text: string
  }
  about: {
    kicker: string; title: string; lead: string
    story: { kicker: string; title: string; paragraphs: TextItem[]; photo: Photo }
    audience: { kicker: string; title: string; items: IconCard[] }
    values: { kicker: string; title: string; items: IconCard[] }
    gallery: { kicker: string; title: string; lead: string }    // photos: home.gallery.photos
  }
  contact: {
    kicker: string; title: string; lead: string
    cards: { phone_title: string; whatsapp_title: string; instagram_title: string; address_title: string }
    hours: { title: string; line: string; sub: string }
    find: { kicker: string; title: string; steps: TextItem[] }
  }
  footer: { tagline: string; hours_line: string; copyright: string }
  booking: {
    intro_title: string; intro_hours: string; intro_fallback: string; no_rooms: string
    closed_title: string; closed_text: string
    method_shamcash: string; method_cash: string; method_hint_shamcash: string; method_hint_cash: string
    note_shamcash: string; note_cash: string
    pay_title: string; pay_held_until: string; pay_steps: TextItem[]; pay_expired_title: string; pay_expired_text: string
    cash_awaiting_title: string; cash_awaiting_text: string
    verifying_title: string; verifying_text: string
    confirmed_title: string
    rejected_title: string; rejected_text: string
    /** expired_text: the hold ran out without a payment reference. expired_text_unverified: the booking expired while it
     *  waited for the team (a reference was sent, or pay on arrival: payment_ref set or method 'cash'). */
    expired_title: string; expired_text: string; expired_text_unverified: string
    cancelled_title: string; cancelled_text: string
    completed_title: string; completed_text: string
    cancel_title: string; cancel_note: string; cancel_note_paid: string
    notify_title: string
    notify_prompt: string; notify_prompt_no_reminder: string
    notify_prompt_mine: string; notify_prompt_mine_no_reminder: string
    install_title: string; install_text: string; install_text_ios: string
    mine_empty_title: string; mine_empty_text: string
    inbox_empty_title: string; inbox_empty_text: string
  }
  messages: {
    booking_created: MessageText                                // → team
    payment_submitted: MessageText & { body_cash: string }      // → team; body_cash for pay-on-arrival bookings
    booking_confirmed: MessageText                              // → customer
    booking_rejected: MessageText                               // → customer
    booking_expired: MessageText & { body_unverified: string }  // → customer; body_unverified: expired while waiting for the team (see booking.expired_text_unverified)
    booking_cancelled: MessageText                              // → customer (team cancel)
    booking_reminder: MessageText                               // → customer, settings.reminder_minutes before the start
    team_whatsapp: string                                       // pre-filled WhatsApp text the team sends a customer
  }
  /**
   * What the Worker's HTMLRewriter writes into index.html (plain fillTemplate, whitespace already collapsed):
   * <title> = pages[page] || title · meta description = description · og:site_name = site_name · og:title and
   * twitter:title = og_title · og:description and twitter:description = og_description · og:image / twitter:image =
   * origin + og_image.src (+ og:image:width/height/alt) · apple-mobile-web-app-title and application-name =
   * app_short_name · JSON-LD = buildJsonLd() · /manifest.webmanifest name / short_name / description = app_name /
   * app_short_name / app_description.
   */
  seo: {
    title: string; description: string; ld_description: string
    site_name: string; og_title: string; og_description: string; og_image: Photo
    pages: { home: string; spaces: string; about: string; contact: string; book: string }   // '' = seo.title
    app_name: string; app_short_name: string; app_description: string
  }
  theme: { brand: string }   // brandStyle(brand) = the <style> the Worker adds to index.html and privacy.html ('' for the default)
}

export type SectionId = keyof SiteContent
export const SECTION_IDS: readonly SectionId[] = ['brand', 'announcement', 'home', 'spaces', 'about', 'contact', 'footer', 'booking', 'messages', 'seo', 'theme']
export const isSectionId = (v: unknown): v is SectionId => typeof v === 'string' && (SECTION_IDS as readonly string[]).includes(v)

// ---------- defaults: today's site, verbatim ----------

const IMG = {
  meeting: { src: '/img/room-a.webp', small: '/img/room-a-720.webp', w: 1105, h: 1400, alt: 'قاعة الاجتماعات في فوكس بوينت: طاولة خمرية طويلة وكراسي مريحة وشاشة وضوء طبيعي من الشباك' },
  meetingTable: { src: '/img/room-a-table.webp', small: '/img/room-a-table-720.webp', w: 919, h: 1400, alt: 'طاولة الاجتماعات الخمرية عن قرب مع مقابس الكهرباء' },
  big: { src: '/img/room-b.webp', small: '/img/room-b-720.webp', w: 1105, h: 1400, alt: 'طاولة كبيرة ونوافذ بانورامية تطل على درعا ولوحة THINK OUTSIDE THE BOX' },
  bigWide: { src: '/img/room-b-wide.webp', small: '/img/room-b-wide-720.webp', w: 1400, h: 821, alt: 'المساحة من الداخل: طاولة كبيرة، كراسي مريحة، ونوافذ واسعة مليانة ضوء' },
} satisfies Record<string, Photo>
const photo = (p: Photo): Photo => ({ ...p })
const amenities = (...keys: AmenityKey[]): AmenityItem[] => keys.map((key) => ({ key }))

export const DEFAULT_BRAND_COLOR = '#7b1e2e'

export const DEFAULT_CONTENT: SiteContent = {
  brand: {
    name_latin: 'Focus Point',
    subtitle: 'فوكس بوينت · درعا',
    eyebrow: 'المشروع الأول من نوعه بدرعا',
    slogan: 'مساحتك وركنك الهادئ للإبداع',
    logo: null,
    whatsapp: '',
    email: '',
    maps_url: '',
    facebook_url: '',
    tiktok_url: '',
    play_url: '',
    status_open: 'مفتوح هلأ',
    status_closed: 'مسكّر هلأ، منفتح الساعة {open}',
  },
  announcement: { enabled: false, text: '', link_label: '', link_url: '', tone: 'info' },
  home: {
    sections: [
      { id: 'hero', visible: true, tint: false },
      { id: 'facts', visible: true, tint: false },
      { id: 'features', visible: true, tint: false },
      { id: 'spaces', visible: true, tint: true },
      { id: 'how', visible: true, tint: false },
      { id: 'gallery', visible: true, tint: true },
      { id: 'visit', visible: true, tint: false },
      { id: 'faq', visible: true, tint: true },
      { id: 'cta', visible: true, tint: false },
    ],
    hero: {
      title: 'مساحتك الهادئة **للشغل والدراسة** والإبداع',
      lead: 'غرف خاصة، قاعة اجتماعات، ومساحة مفتوحة بدرعا، على شارع المجمع الحكومي. احجز مكانك من موبايلك بخطوات بسيطة، وتعال اشتغل على رواق.',
      chips: [
        { icon: 'clock', text: 'يومياً {hours}', text_shamcash_only: '', text_cash_only: '' },
        { icon: 'wifi', text: 'إنترنت سريع', text_shamcash_only: '', text_cash_only: '' },
        // new wording: text_cash_only (Sham Cash switched off) has no counterpart on today's site
        { icon: 'wallet', text: 'الدفع بشام كاش أو عند الوصول', text_shamcash_only: 'الدفع بشام كاش', text_cash_only: 'الدفع عند الوصول' },
      ],
      photo: photo(IMG.meeting),
      badge_icon: 'present',
      badge_title: 'قاعة اجتماعات لعشرة أشخاص',
      badge_text: 'شاشة + سبورة',
    },
    facts: {
      label: '{name} بالأرقام',
      items: [
        { icon: 'grid', value: '{privateCount} غرف خاصة', label: 'وقاعة اجتماعات ومساحة مفتوحة' },
        { icon: 'pin', value: 'شارع المجمع الحكومي', label: 'بدرعا، بناء العايش' },
        { icon: 'clock', value: '{hoursPerDay} ساعة يومياً', label: 'كل يوم، {hours}' },
        { icon: 'user', value: 'حجز بدون حساب', label: 'اسمك ورقم موبايلك وبس' },
      ],
    },
    features: {
      kicker: 'ليش فوكس بوينت؟',
      title: 'كل شي بتحتاجه لتشتغل بتركيز',
      lead: 'جو THINK OUTSIDE THE BOX: مكان مرتب وهادئ، بيعطيك مساحة تفكّر وتبدع.',
      items: [
        { icon: 'quiet', title: 'هدوء يساعدك تركّز', text: 'مكان معمول للتركيز، بعيد عن عجقة البيت والمقاهي، لتخلّص شغلك وإنت مرتاح.' },
        { icon: 'sun', title: 'ضوء طبيعي', text: 'شبابيك كبيرة بتدخّل الضوء الطبيعي طول النهار.' },
        { icon: 'wifi', title: 'إنترنت سريع', text: 'واي فاي سريع لاجتماعاتك أونلاين، رفع ملفاتك، ودراستك.' },
        { icon: 'ac', title: 'تكييف', text: 'تكييف بيخلّي الجو مريح، لتركّز بشغلك وبس.' },
        { icon: 'coffee', title: 'قهوة جنبك', text: 'فنجان قهوة قريب منك وقت ما بدك تاخد نفَس.' },
        { icon: 'screen', title: 'قاعة اجتماعات مجهّزة', text: 'شاشة وسبورة لـ{meetingCapacity} أشخاص، للاجتماعات والعروض والدورات.' },
      ],
    },
    spaces: {
      kicker: 'المساحات',
      title: 'اختار المكان اللي بيناسبك',
      lead: 'لحالك، مع شريكك، أو مع فريق كامل. كل المساحات بتنحجز بالساعة.',
    },
    how: {
      kicker: 'كيف بتحجز؟',
      title: '3 خطوات وحجزك جاهز',
      steps: [
        { icon: 'calendar', title: 'اختار المساحة والوقت', title_shamcash_only: '', title_cash_only: '', text: 'شوف المخطط والغرف الفاضية، واختار اليوم والساعة والمدة اللي بدك ياها.', text_shamcash_only: '', text_cash_only: '' },
        { icon: 'user', title: 'اكتب اسمك ورقمك', title_shamcash_only: '', title_cash_only: '', text: 'بدون حساب وبدون كلمة سر. اسمك ورقم موبايلك بيكفّوا.', text_shamcash_only: '', text_cash_only: '' },
        {
          icon: 'check',
          title: 'ادفع بشام كاش أو عند الوصول',
          title_shamcash_only: 'ادفع بشام كاش',
          title_cash_only: 'ادفع عند الوصول',   // new wording (Sham Cash off)
          text: 'حوّل بشام كاش واكتب رقم العملية، أو اختار الدفع عند الوصول. ويوصلك التأكيد بإشعار.',
          text_shamcash_only: 'حوّل بشام كاش (رمز QR أو الرقم) واكتب رقم العملية، ويوصلك التأكيد بإشعار.',
          text_cash_only: 'الفريق بيأكّد حجزك، وبتدفع بالمركز لما توصل. ويوصلك التأكيد بإشعار.',   // new wording (Sham Cash off)
        },
      ],
    },
    gallery: {
      kicker: 'من جوّا',
      title: 'شوف المكان بعينك',
      lead: 'صور حقيقية من فوكس بوينت.',
      photos: [photo(IMG.bigWide), photo(IMG.meeting), photo(IMG.meetingTable), photo(IMG.big)],
      quote: 'THINK\nOUTSIDE\nTHE BOX',
    },
    visit: {
      kicker: 'زورنا',
      title: 'الدوام والعنوان',
      lead: 'منستناك كل يوم. إذا عندك سؤال قبل ما تجي، احكينا.',
      hours_title: 'أوقات الدوام',
      hours_line: 'كل يوم بالأسبوع، {hoursPerDay} ساعة باليوم.',
      address_title: 'العنوان',
    },
    faq: {
      kicker: 'أسئلة متكررة',
      title: 'عندك سؤال؟',
      lead: 'إذا ما لقيت جوابك هون، [تواصل معنا](/contact).',
      items: [
        { q: 'هل لازم أعمل حساب لأحجز؟', a: 'لا. بتختار المساحة والوقت، وبتكتب اسمك ورقم موبايلك، وبس. التطبيق بيتذكّر حجوزاتك على جهازك، وفيك تلاقي أي حجز برمزه ورقمك من صفحة «حجوزاتي».', a_shamcash_only: '', a_cash_only: '', a_no_cancel: '' },
        {
          q: 'كيف بدفع؟',
          a: 'بتحويل شام كاش: بتمسح الرمز أو بتحوّل عالرقم، وبتكتب رقم العملية بالتطبيق، والفريق بيأكّد حجزك. أو بتختار «الدفع عند الوصول» وبتدفع بالمركز لما توصل.',
          a_shamcash_only: 'بتحويل شام كاش: بتمسح الرمز أو بتحوّل عالرقم، وبتكتب رقم العملية بالتطبيق، والفريق بيأكّد حجزك ويوصلك إشعار.',
          a_cash_only: 'بتدفع بالمركز لما توصل. بتحجز من التطبيق، والفريق بيأكّد حجزك ويوصلك إشعار.',   // new wording (Sham Cash off)
          a_no_cancel: '',
        },
        {
          q: 'فيني ألغي الحجز؟',
          a: 'قبل ما يتأكد الحجز، فيك تلغيه بنفسك من التطبيق (صفحة [حجوزاتي](/mine)). بعد التأكيد، تواصل معنا على {phone} أو عالواتساب ومنساعدك.',
          a_shamcash_only: '',
          a_cash_only: '',
          a_no_cancel: 'إذا بدك تلغي حجزك أو تغيّر وقته، تواصل معنا على {phone} أو عالواتساب ومنساعدك.',   // new wording (customer cancel off)
        },
        { q: 'شو الدوام؟', a: 'مفتوحين كل يوم، من {open} لـ{close}.', a_shamcash_only: '', a_cash_only: '', a_no_cancel: '' },
        { q: 'فيني أحجز لفريق كامل؟', a: 'أكيد. قاعة الاجتماعات بتساع لـ{meetingCapacity} أشخاص وفيها شاشة وسبورة، وفي كمان غرف خاصة من {privateMin} لـ{privateMax} أشخاص. [شوف المساحات](/spaces).', a_shamcash_only: '', a_cash_only: '', a_no_cancel: '' },
        { q: 'وين المكان؟', a: '{address}. إذا ضعت، اتصل فينا أو ابعتلنا عالواتساب ومنوصفلك الطريق.', a_shamcash_only: '', a_cash_only: '', a_no_cancel: '' },
      ],
    },
    cta: {
      title: 'جاهز تبدأ؟ احجز مكانك هلأ',
      text: 'اختار المساحة والوقت، اكتب اسمك ورقمك، وادفع بشام كاش أو عند وصولك. بدون حساب وبدون تعقيد.',
      text_shamcash_only: '',
      text_cash_only: 'اختار المساحة والوقت، اكتب اسمك ورقمك، وادفع عند وصولك. بدون حساب وبدون تعقيد.',   // new wording (Sham Cash off)
    },
  },
  spaces: {
    kicker: 'المساحات',
    title: 'مساحة لكل نوع شغل',
    lead: 'غرف خاصة من {privateMin} لـ{privateMax} أشخاص، قاعة اجتماعات لـ{meetingCapacity} مع شاشة وسبورة، ومساحة مفتوحة مشتركة لـ{openCapacity}. الأسعار هون هي نفسها اللي بتشوفها وقت الحجز.',
    groups: {
      private: { title: 'غرف خاصة', blurb: 'غرفة إلك لحالك أو مع فريقك الصغير، بابها بيتسكّر وبتشتغل فيها على راحتك.', cap: '2–4 أشخاص', badge: '{privateCount} غرف', icon: 'door', photo: null, amenities: amenities('wifi', 'ac') },
      meeting: { title: 'قاعة الاجتماعات', blurb: 'قاعة لـ{meetingCapacity} أشخاص فيها شاشة وسبورة، للاجتماعات والدورات والعروض.', cap: 'حتى 10 أشخاص', badge: 'قاعة', icon: 'present', photo: photo(IMG.meeting), amenities: amenities('wifi', 'ac', 'screen', 'whiteboard') },
      open: { title: 'المساحة المفتوحة', blurb: 'مكان مشترك لـ{openCapacity} أشخاص، ضوء طبيعي وجو بيشجّع عالشغل.', cap: 'حتى 8 أشخاص', badge: 'مشتركة', icon: 'grid', photo: photo(IMG.bigWide), amenities: amenities('wifi', 'ac', 'coffee') },
    },
    price_from: 'تبدأ من',
    price_from_short: 'من',
    price_unit: 'بالساعة',
    price_unknown: 'الأسعار بتبين وقت الحجز',
    empty_title: 'ما في مساحات متاحة حالياً',
    empty_text: 'تواصل معنا ومنساعدك تلاقي وقت مناسب.',
    cta_title: 'لقيت المساحة المناسبة؟',
    cta_text: 'احجزها هلأ بخطوات بسيطة: الوقت، الاسم والرقم، والدفع. ويوصلك التأكيد بإشعار.',
  },
  about: {
    kicker: 'من نحن',
    title: 'فوكس بوينت: **{slogan}**',
    lead: '{eyebrow}. مساحة عمل مشتركة بدرعا، معمولة للي بدو يركّز ويبدع.',
    story: {
      kicker: 'حكايتنا',
      title: 'مكان هادئ، قريب منك',
      paragraphs: [
        { text: 'فوكس بوينت هو المشروع الأول من نوعه بدرعا: مساحة عمل مشتركة فيها غرف خاصة، وقاعة اجتماعات، ومساحة مفتوحة، بتنحجز بالساعة. عملناها لأن الشغل والدراسة بدهم مكان هادئ ومرتب، مو طاولة بمقهى عجقة ولا زاوية بالبيت.' },
        { text: 'عنا ضوء طبيعي من شبابيك كبيرة، تكييف، إنترنت سريع، وقهوة جنبك. مفتوحين كل يوم {hours}، وبتحجز مكانك من موبايلك بخطوات بسيطة بدون ما تعمل حساب. وعلى الحيط عنا جملة بتلخّص كل شي: THINK OUTSIDE THE BOX.' },
      ],
      photo: photo(IMG.big),
    },
    audience: {
      kicker: 'لمين فوكس بوينت؟',
      title: 'لكل حدا بدو مكان يركّز فيه',
      items: [
        { icon: 'book', title: 'طلاب', text: 'لدراسة الامتحانات، المشاريع، وحلقات الدراسة الجماعية بمكان هادئ.' },
        { icon: 'laptop', title: 'مستقلّين وعن بُعد', text: 'مكتب مرتب وإنترنت سريع، بعيد عن ضجة البيت والمقاهي.' },
        { icon: 'people', title: 'فرق صغيرة', text: 'غرف خاصة من {privateMin} لـ{privateMax} أشخاص، وقاعة اجتماعات لعشرة لما يكبر الاجتماع.' },
        { icon: 'present', title: 'مدرّبين ودورات', text: 'قاعة فيها شاشة وسبورة، جاهزة للورشات والعروض والدورات.' },
      ],
    },
    values: {
      kicker: 'قيمنا',
      title: 'شو اللي بيميّزنا',
      items: [
        { icon: 'quiet', title: 'هدوء', text: 'المكان معمول للتركيز. كل تفصيل فيه هدفه يخليك تشتغل براحة.' },
        { icon: 'check', title: 'احترافية', text: 'حجز واضح، أسعار معلنة، وتأكيد بيوصلك بإشعار. بتعرف شو إلك قبل ما توصل.' },
        { icon: 'heart', title: 'ضيافة حورانية', text: 'أهلاً وسهلاً فيك دايماً، والقهوة موجودة وقت ما بدك.' },
      ],
    },
    gallery: { kicker: 'المكان', title: 'جولة سريعة بفوكس بوينت', lead: 'صور حقيقية من فوكس بوينت.' },
  },
  contact: {
    kicker: 'تواصل معنا',
    title: 'منحب نسمع منك',
    lead: 'سؤال عن الحجز، الأسعار، أو بدك تحجز لفريق؟ اتصل أو ابعتلنا عالواتساب، أو مرّ علينا.',
    cards: { phone_title: 'اتصل فينا', whatsapp_title: 'واتساب', instagram_title: 'إنستغرام', address_title: 'العنوان' },
    hours: { title: 'أوقات الدوام', line: 'كل يوم: {hours}', sub: '{hoursPerDay} ساعة يومياً، كل أيام الأسبوع.' },
    find: {
      kicker: 'كيف توصلنا',
      title: 'سهل توصلنا',
      steps: [
        { text: 'توجّه على **شارع المجمع الحكومي** بدرعا.' },
        { text: 'اسأل عن **بناء العايش**، فوكس بوينت فيه.' },
        { text: 'ضعت؟ اتصل أو ابعتلنا واتساب ومنوصفلك الطريق.' },
      ],
    },
  },
  footer: {
    tagline: '{slogan}. {eyebrow} — غرف خاصة، قاعة اجتماعات ومساحة مفتوحة، بتحجزها من موبايلك بخطوات بسيطة.',
    hours_line: 'يومياً {open} – {close}',
    copyright: '© 2026 فوكس بوينت — Focus Point',
  },
  booking: {
    intro_title: 'احجز مكانك',
    intro_hours: 'يومياً {open} – {close}',
    intro_fallback: 'مساحة عمل مشتركة · فوكس بوينت',
    no_rooms: 'لا توجد غرف متاحة حالياً.',
    // new: shown while settings.booking_enabled is false (no such page today) — wording for the owner to review
    closed_title: 'الحجز متوقف مؤقتاً',
    closed_text: 'ما عم نستقبل حجوزات أونلاين هلأ. تواصل معنا عالواتساب أو اتصل فينا ومنساعدك.',
    method_shamcash: 'تحويل شام كاش',
    method_cash: 'الدفع عند الوصول',
    method_hint_shamcash: 'تحوّل المبلغ عبر شام كاش وتدخل رقم العملية — يتأكد الحجز خلال دقائق.',
    method_hint_cash: 'يؤكد الفريق حجزك، وتدفع عند وصولك إلى المركز.',
    note_shamcash: 'بعد التأكيد يُحفَظ المكان لك {holdMinutes} دقيقة لإتمام الدفع عبر شام كاش.',
    note_cash: 'سيصلك إشعار عندما يؤكد الفريق حجزك.',
    pay_title: 'ادفع عبر شام كاش',
    pay_held_until: 'المكان محفوظ لك حتى {time}.',
    pay_steps: [
      { text: 'افتح تطبيق شام كاش وحوّل المبلغ إلى الرقم أعلاه.' },
      { text: 'اكتب رمز الحجز {code} في ملاحظة التحويل.' },
      { text: 'أدخل رقم العملية هنا — وبنأكد حجزك خلال دقائق.' },
    ],
    pay_expired_title: 'انتهت مهلة الحجز',
    pay_expired_text: 'لم يصلنا رقم العملية خلال المهلة، فعاد المكان متاحاً للجميع. إذا كنت قد حوّلت المبلغ فعلاً، تواصل مع المركز ومعك رمز الحجز {code}.',
    cash_awaiting_title: 'استلمنا حجزك',
    cash_awaiting_text: 'سيؤكد الفريق حجزك قريباً، والدفع عند الوصول. بيصلك إشعار، ويظهر التأكيد هنا تلقائياً.',
    verifying_title: 'وصلنا، عم نتحقق',
    verifying_text: 'سجّلنا رقم العملية {ref}. فريقنا يطابق التحويل الآن، وبنأكد حجزك خلال دقائق — بيصلك إشعار، ويظهر هنا تلقائياً.',
    confirmed_title: 'حجزك مؤكد',
    rejected_title: 'ما قدرنا نؤكد الحجز',
    rejected_text: 'لم نتمكن من مطابقة التحويل. تواصل معنا إذا كنت قد دفعت.',
    expired_title: 'انتهت مهلة الدفع',
    expired_text: 'لم يصلنا رقم العملية ضمن المهلة، فعاد المكان متاحاً للجميع.',
    expired_text_unverified: 'لم يصلنا رقم العملية ضمن المهلة، فعاد المكان متاحاً للجميع.',   // today the same text serves both cases
    cancelled_title: 'الحجز ملغى',
    cancelled_text: 'تم إلغاء هذا الحجز.',
    completed_title: 'شكراً لزيارتك',
    completed_text: 'نتمنى أن تكون قد أنجزت ما خططت له.',
    cancel_title: 'إلغاء الحجز؟',
    cancel_note: 'سيعود المكان متاحاً للآخرين.',
    cancel_note_paid: 'إذا كنت قد حوّلت المبلغ، تواصل معنا لاسترجاعه.',
    notify_title: 'فعّل الإشعارات',
    notify_prompt: 'خبّرك أول ما يتأكد حجزك، ونذكّرك قبله ب{reminder}.',
    notify_prompt_no_reminder: 'خبّرك أول ما يتأكد حجزك.',               // new wording (reminders off)
    notify_prompt_mine: 'نخبرك بتأكيد الحجز ونذكّرك قبله ب{reminder}.',
    notify_prompt_mine_no_reminder: 'نخبرك بتأكيد الحجز.',                // new wording (reminders off)
    install_title: 'ثبّت فوكس بوينت على جهازك',
    install_text: 'يفتح كتطبيق، أسرع، ويشتغل حتى بدون إنترنت.',
    install_text_ios: 'من Safari: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».',
    mine_empty_title: 'ما عندك حجوزات قادمة',
    mine_empty_text: 'احجز مكتبك أو غرفتك بثلاث خطوات.',
    inbox_empty_title: 'ما في إشعارات بعد',
    inbox_empty_text: 'بنخبرك هنا عن تأكيد حجوزاتك وأي جديد في المركز.',
  },
  messages: {
    booking_created: { title: 'حجز جديد', body: '{customer_name} · {room} · {when} · {price} · الرمز {code}' },
    payment_submitted: {
      title: 'دفعة بانتظار التحقق',
      body: '{customer_name} · {price} · رقم العملية {ref} · {room} {when}',
      body_cash: '{customer_name} · {price} · دفع عند الوصول · {room} {when}',
    },
    booking_confirmed: { title: 'تم تأكيد حجزك', body: '{room} · {when} · الرمز {code}. نراك في فوكس بوينت!' },
    booking_rejected: { title: 'لم يتم تأكيد الدفع', body: '{room} · {when} · السبب: {reason}. تواصل معنا إن كان هناك خطأ.' },
    booking_expired: {
      title: 'انتهت مهلة الحجز',
      body: 'لم يصلنا رقم عملية الدفع لحجز {room} · {when}. يمكنك الحجز من جديد.',
      body_unverified: 'لم يصلنا رقم عملية الدفع لحجز {room} · {when}. يمكنك الحجز من جديد.',   // today the same text serves both cases
    },
    booking_cancelled: { title: 'تم إلغاء حجزك', body: '{room} · {when}. تواصل معنا على {phone} لأي استفسار.' },
    booking_reminder: { title: 'حجزك بعد {reminder}', body: '{room} · {when} · الرمز {code}. ننتظرك!' },
    team_whatsapp: 'مرحباً {customer_name}، بخصوص حجزك {code} في فوكس بوينت',
  },
  seo: {
    title: 'فوكس بوينت — مساحة عمل هادئة بدرعا | Focus Point',
    description: 'فوكس بوينت، المشروع الأول من نوعه بدرعا: غرف خاصة، غرفة اجتماعات ومساحة عمل مشتركة. هدوء، إضاءة طبيعية، إنترنت سريع وقهوة. احجز من موبايلك بدقيقة — يومياً من 9 الصبح لـ 11 بالليل.',
    ld_description: 'مساحة عمل مشتركة بدرعا: غرف خاصة، غرفة اجتماعات ومساحة مشتركة. المشروع الأول من نوعه بدرعا.',
    site_name: 'Focus Point — فوكس بوينت',
    og_title: 'فوكس بوينت — مساحتك وركنك الهادئ للإبداع',
    og_description: 'المشروع الأول من نوعه بدرعا: غرف خاصة، غرفة اجتماعات ومساحة مشتركة. احجز من موبايلك بدقيقة.',
    og_image: { src: '/img/og.png', w: 1200, h: 630, alt: 'غرفة الاجتماعات في فوكس بوينت بدرعا' },
    pages: {
      home: 'فوكس بوينت | مساحة عمل هادئة بدرعا — احجز غرفتك',
      spaces: 'المساحات والأسعار | فوكس بوينت درعا',
      about: 'من نحن | فوكس بوينت — المشروع الأول من نوعه بدرعا',
      contact: 'تواصل معنا | فوكس بوينت درعا',
      book: '',
    },
    app_name: 'فوكس بوينت',
    app_short_name: 'Focus Point',
    app_description: 'احجز مكانك في فوكس بوينت — درعا',
  },
  theme: { brand: DEFAULT_BRAND_COLOR },
}

// ---------- placeholders ----------

const VARS = {
  name: 'اسم المركز (من الإعدادات)',
  phone: 'رقم هاتف المركز',
  address: 'عنوان المركز',
  instagram: 'حساب إنستغرام',
  hours: 'ساعات الدوام، مثل «9 ص – 11 م»',
  open: 'ساعة الفتح، مثل «9 ص»',
  close: 'ساعة السكّرة، مثل «11 م»',
  hoursPerDay: 'عدد ساعات الدوام باليوم',
  privateCount: 'عدد الغرف الخاصة',
  privateMin: 'أقل عدد أشخاص بالغرف الخاصة',
  privateMax: 'أكبر عدد أشخاص بالغرف الخاصة',
  meetingCapacity: 'كم شخص بتساع أكبر قاعة اجتماعات',
  openCapacity: 'كم شخص بتساع المساحة المفتوحة (كل طاولاتها)',
  slogan: 'الشعار (من «الهوية والتواصل»)',
  eyebrow: 'الجملة المميّزة (من «الهوية والتواصل»)',
  holdMinutes: 'مهلة الدفع بالدقايق',
  reminder: 'وقت التذكير قبل الحجز (من الإعدادات)، مثل «ساعة»',
  customer_name: 'اسم الزبون',
  room: 'اسم الغرفة',
  when: 'اليوم والوقت، مثل «الجمعة 24/10 · 10:00–12:00»',
  price: 'المبلغ مع العملة، مثل «15,000 ل.س»',
  code: 'رمز الحجز',
  ref: 'رقم عملية شام كاش',
  reason: 'سبب الرفض اللي كتبه الفريق',
  time: 'آخر وقت للدفع، مثل «10:30 م»',
} as const
export type TemplateVar = keyof typeof VARS

/** Every {placeholder} a text may use → what it becomes (Arabic, for the editor's chips). */
export const TEMPLATE_VARS: Record<string, string> = VARS

/**
 * Today's values: the editor's preview samples, and the fallbacks while live data is loading (the site's first paint,
 * offline) — the same fallbacks the site uses now (web/src/pages/site/site.tsx CENTRE, Facts.tsx `|| 4`).
 */
export const TEMPLATE_EXAMPLE: Record<TemplateVar, string> = {
  name: 'فوكس بوينت', phone: '0985258963', address: 'درعا – شارع المجمع الحكومي – بناء العايش', instagram: 'its_focus_point',
  hours: '9 ص – 11 م', open: '9 ص', close: '11 م', hoursPerDay: '14',
  privateCount: '4', privateMin: '2', privateMax: '4', meetingCapacity: '10', openCapacity: '8',
  slogan: 'مساحتك وركنك الهادئ للإبداع', eyebrow: 'المشروع الأول من نوعه بدرعا', holdMinutes: '30', reminder: 'ساعة',
  customer_name: 'أحمد', room: 'قاعة الاجتماعات', when: 'الجمعة 24/10 · 10:00–12:00', price: '40,000 ل.س',
  code: 'A7K2QZ', ref: '123456789', reason: 'لم يصل المبلغ', time: '10:30 م',
}

/** Placeholders by source (the editor offers them per field; useTemplateVars loads /v1/rooms only when ROOM_VARS appear). */
export const HOURS_VARS: readonly TemplateVar[] = ['hours', 'open', 'close', 'hoursPerDay']
export const ROOM_VARS: readonly TemplateVar[] = ['privateCount', 'privateMin', 'privateMax', 'meetingCapacity', 'openCapacity']
/** Live data any site text may show. */
export const SITE_VARS: readonly TemplateVar[] = ['name', 'phone', 'address', 'instagram', ...HOURS_VARS, ...ROOM_VARS, 'slogan', 'eyebrow']

const PLACEHOLDER_RE = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g
const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k)

/** "{name}" → vars.name. Unknown placeholders are kept as typed. Plain text: notifications, titles, meta tags. */
export function fillTemplate(t: string, vars: Record<string, string | number>): string {
  return t.replace(PLACEHOLDER_RE, (m, k: string) => (hasOwn(vars, k) ? String(vars[k]) : m))
}

/** The {placeholders} a text uses, in order, without duplicates. */
export function templateKeys(t: string): string[] {
  const out: string[] = []
  for (const m of t.matchAll(PLACEHOLDER_RE)) if (m[1] && !out.includes(m[1])) out.push(m[1])
  return out
}

/** Placeholders shown left-to-right in an isolated run (a phone '+963 …' keeps its '+' in front). */
export const LTR_VARS: readonly string[] = ['phone', 'instagram']
/** Placeholders shown bold on the pages (booking code and transfer number), as today. */
export const STRONG_VARS: readonly string[] = ['code', 'ref']

/**
 * A page text, filled and split for rendering:
 * text → as is · latin → <bdi dir="ltr" className="fp-nowrap"> (a Latin run such as THINK OUTSIDE THE BOX) ·
 * ltr → <bdi dir="ltr" className="num"> ({phone} {instagram}) · strong → <b className="num"> ({code} {ref}).
 * The parts' texts joined equal fillTemplate(t, vars).
 */
export type TextPart = { kind: 'text' | 'latin' | 'ltr' | 'strong'; text: string }
// a Latin run; an unknown {placeholder} left in the text is matched first and stays plain text
const LATIN_RE = /(\{[A-Za-z_][A-Za-z0-9_]*\})|[A-Za-z][A-Za-z0-9]*(?:[ '’&.-]+[A-Za-z0-9]+)*/g

export function textParts(t: string, vars: Record<string, string | number>): TextPart[] {
  const out: TextPart[] = []
  const push = (kind: TextPart['kind'], text: string): void => {
    if (!text) return
    const prev = out[out.length - 1]
    if (prev && prev.kind === 'text' && kind === 'text') prev.text += text
    else out.push({ kind, text })
  }
  const plain = (s: string): void => {
    let last = 0
    for (const m of s.matchAll(LATIN_RE)) {
      if (m[1] !== undefined) continue
      const i = m.index ?? 0
      push('text', s.slice(last, i))
      push('latin', m[0])
      last = i + m[0].length
    }
    push('text', s.slice(last))
  }
  let last = 0
  let buf = ''
  for (const m of t.matchAll(PLACEHOLDER_RE)) {
    const k = m[1] ?? ''
    const i = m.index ?? 0
    if (!hasOwn(vars, k)) continue                     // unknown: stays in the text as typed
    const value = String(vars[k])
    buf += t.slice(last, i)
    last = i + m[0].length
    if (STRONG_VARS.includes(k) || LTR_VARS.includes(k)) {
      plain(buf); buf = ''
      push(STRONG_VARS.includes(k) ? 'strong' : 'ltr', value)
    } else buf += value                                // other live values read as part of the sentence
  }
  plain(buf + t.slice(last))
  return out
}

export type RichPart = { kind: 'text' | 'em'; text: string } | { kind: 'link'; text: string; href: string }

/** Splits a `rich` text into plain runs, **emphasis** and [label](link). A link whose href fails isSafeLink must be shown as text. */
export function parseRich(s: string): RichPart[] {
  const parts: RichPart[] = []
  let last = 0
  for (const m of s.matchAll(/\*\*([^*\n]+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
    const i = m.index ?? 0
    if (i > last) parts.push({ kind: 'text', text: s.slice(last, i) })
    if (m[1] !== undefined) parts.push({ kind: 'em', text: m[1] })
    else parts.push({ kind: 'link', text: m[2] ?? '', href: m[3] ?? '' })
    last = i + m[0].length
  }
  if (last < s.length) parts.push({ kind: 'text', text: s.slice(last) })
  return parts
}

// ---------- wording variants ----------

/** The booking options that change the wording (see the header). */
export interface WordingFlags { payOnArrival: boolean; shamcash: boolean; canCancel: boolean; reminders: boolean }

/**
 * From PublicSettings. While the settings are not loaded (null) every option counts as on — the plain wording, as the
 * site's first paint does today (site.tsx: `payOnArrival: s ? !!s.allow_pay_on_arrival : true`).
 */
export function wordingFlags(s?: Partial<{ allow_pay_on_arrival: boolean; shamcash_enabled: boolean; customer_can_cancel: boolean; reminder_minutes: number }> | null): WordingFlags {
  if (!s) return { payOnArrival: true, shamcash: true, canCancel: true, reminders: true }
  return {
    payOnArrival: s.allow_pay_on_arrival === true,
    shamcash: s.shamcash_enabled !== false,
    canCancel: s.customer_can_cancel !== false,
    reminders: (s.reminder_minutes ?? 60) > 0,
  }
}

/**
 * The wording of `o[field]` for these settings: `field_no_reminder`, `field_no_cancel`, `field_cash_only`,
 * `field_shamcash_only` (first non-empty one whose condition holds, in that order), else `field`.
 */
export function pickVariant<T extends object>(o: T, field: keyof T & string, f: WordingFlags): string {
  const r = o as unknown as Record<string, unknown>
  const v = (suffix: string): string => { const x = r[`${field}_${suffix}`]; return typeof x === 'string' ? x : '' }
  if (!f.reminders && v('no_reminder')) return v('no_reminder')
  if (!f.canCancel && v('no_cancel')) return v('no_cancel')
  if (!f.shamcash && v('cash_only')) return v('cash_only')
  if (!f.payOnArrival && v('shamcash_only')) return v('shamcash_only')
  const base = r[field]
  return typeof base === 'string' ? base : ''
}

// ---------- live values for the placeholders ----------

/** What the room placeholders need from a room (a Room, or a row of GET /v1/rooms). */
export interface RoomFacts { type: string; capacity: number; active?: number | boolean }

/**
 * {privateCount} {privateMin} {privateMax} {meetingCapacity} {openCapacity} from the active rooms:
 * - privateCount = how many private rooms; privateMin / privateMax = their smallest / largest capacity;
 * - meetingCapacity = the largest capacity among meeting rooms and halls (the biggest group one room seats);
 * - openCapacity = the capacities of the open-space (desk) rooms added up (one 8-seat desk or eight 1-seat desks: 8).
 * A group with no active room — and every group while the rooms are not loaded (null) — keeps today's number from
 * TEMPLATE_EXAMPLE, as the site does now (Facts.tsx `|| 4`), so a text never shows "0 غرف" or a raw {placeholder}.
 */
export function roomTemplateVars(rooms: readonly RoomFacts[] | null | undefined): Record<string, string> {
  const live = (rooms ?? []).filter((r) => r.active !== 0 && r.active !== false && Number.isFinite(r.capacity) && r.capacity > 0)
  const caps = (...types: string[]): number[] => live.filter((r) => types.includes(r.type)).map((r) => r.capacity)
  const priv = caps('private'), meet = caps('meeting', 'hall'), open = caps('desk')
  const ex = TEMPLATE_EXAMPLE
  return {
    privateCount: priv.length ? String(priv.length) : ex.privateCount,
    privateMin: priv.length ? String(Math.min(...priv)) : ex.privateMin,
    privateMax: priv.length ? String(Math.max(...priv)) : ex.privateMax,
    meetingCapacity: meet.length ? String(Math.max(...meet)) : ex.meetingCapacity,
    openCapacity: open.length ? String(open.reduce((a, b) => a + b, 0)) : ex.openCapacity,
  }
}

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/
const toMinutes = (hhmm: string): number => { const m = HHMM_RE.exec(hhmm); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN }

/** "09:00" → "9 ص", "21:30" → "9:30 م" (the site's short clock, web/src/format.ts shortClock). */
export function shortClock(hhmm: string): string {
  const t = toMinutes(hhmm)
  if (Number.isNaN(t)) return hhmm
  const h = Math.floor(t / 60), mi = t % 60
  return `${h % 12 === 0 ? 12 : h % 12}${mi ? `:${String(mi).padStart(2, '0')}` : ''} ${h < 12 ? 'ص' : 'م'}`
}

/** {hours} {open} {close} {hoursPerDay} from settings.open / close ("HH:MM"); invalid or missing → today's values. */
export function hoursTemplateVars(open?: string | null, close?: string | null): Record<string, string> {
  const o = toMinutes(open ?? ''), c = toMinutes(close ?? '')
  if (Number.isNaN(o) || Number.isNaN(c)) {
    const ex = TEMPLATE_EXAMPLE
    return { hours: ex.hours, open: ex.open, close: ex.close, hoursPerDay: ex.hoursPerDay }
  }
  const span = c - o > 0 ? c - o : c - o + 24 * 60
  const so = shortClock(open ?? ''), sc = shortClock(close ?? '')
  return { hours: `${so} – ${sc}`, open: so, close: sc, hoursPerDay: String(Math.round(span / 60)) }
}

/** settings.reminder_minutes → {reminder}: 60 → «ساعة», 15 → «ربع ساعة», 120 → «ساعتين», 1440 → «يوم»; 0 (off) → ''. */
export function reminderLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return ''
  const m = Math.round(minutes)
  if (m === 15) return 'ربع ساعة'
  if (m === 30) return 'نص ساعة'
  if (m === 90) return 'ساعة ونص'
  if (m === 1440) return 'يوم'
  if (m % 60 === 0) {
    const h = m / 60
    return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? `${h} ساعات` : `${h} ساعة`
  }
  return m <= 10 ? `${m} دقائق` : `${m} دقيقة`
}

/** The settings fields the site placeholders read (PublicSettings fits). */
export interface TemplateSettings {
  centre_name: string; phone: string; address: string; instagram: string; open: string; close: string
  hold_minutes: number; reminder_minutes: number
}

/**
 * Every site placeholder (SITE_VARS + holdMinutes + reminder) from live data, each falling back to TEMPLATE_EXAMPLE
 * while its source is missing: settings (null = not loaded), the content's brand, and the rooms (null = not loaded).
 * The booking placeholders ({customer_name} {room} {when} {price} {code} {ref} {reason} {time}) come from the booking.
 */
export function siteTemplateVars(src: {
  settings?: Partial<TemplateSettings> | null
  brand?: Partial<Pick<SiteContent['brand'], 'slogan' | 'eyebrow'>> | null
  rooms?: readonly RoomFacts[] | null
} = {}): Record<string, string> {
  const s = src.settings ?? {}
  const ex = TEMPLATE_EXAMPLE
  return {
    name: s.centre_name || ex.name,
    phone: s.phone || ex.phone,
    address: s.address || ex.address,
    instagram: (s.instagram || ex.instagram).replace(/^@/, ''),
    ...hoursTemplateVars(s.open, s.close),
    ...roomTemplateVars(src.rooms),
    slogan: src.brand?.slogan || ex.slogan,
    eyebrow: src.brand?.eyebrow || ex.eyebrow,
    holdMinutes: typeof s.hold_minutes === 'number' && s.hold_minutes > 0 ? String(s.hold_minutes) : ex.holdMinutes,
    reminder: typeof s.reminder_minutes === 'number' ? reminderLabel(s.reminder_minutes) : ex.reminder,
  }
}

// ---------- phone, address, JSON-LD ----------

/** "0985258963" → "+963985258963" (Syria); keeps a number already written +… or 00…; '' when there are no digits. */
export function intlPhone(phone: string): string {
  const d = phone.replace(/[^\d+]/g, '')
  const digits = d.replace(/\+/g, '')
  if (!digits) return ''
  if (d.startsWith('+')) return `+${digits}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.startsWith('0')) return `+963${digits.slice(1)}`
  if (digits.startsWith('963')) return `+${digits}`
  return `+963${digits}`
}

/** wa.me link for a number: "0985258963" → "https://wa.me/963985258963". */
export const whatsappLink = (phone: string): string => `https://wa.me/${intlPhone(phone).slice(1)}`

/**
 * "درعا، شارع المجمع الحكومي – بناء العايش" (or "درعا – شارع …") → { locality: 'درعا', street: 'شارع المجمع الحكومي – بناء العايش' }:
 * the city is the part before the first «،», «,» or spaced dash. No separator → the whole address is the street.
 */
export function splitAddress(address: string): { locality: string; street: string } {
  const a = address.trim()
  const m = /^(.+?)\s*(?:[،,]|\s[–-]\s)\s*(.+)$/.exec(a)
  return m ? { locality: (m[1] ?? '').trim(), street: (m[2] ?? '').trim() } : { locality: '', street: a }
}

/** The settings fields the JSON-LD reads. */
export type JsonLdSettings = Pick<TemplateSettings, 'centre_name' | 'phone' | 'address' | 'instagram' | 'open' | 'close'>

/**
 * The LocalBusiness JSON-LD of index.html (origin like "https://focuspoint.raqeem.dev", no trailing slash). With the
 * default content and settings it is today's block field for field: name = seo.site_name, alternateName =
 * centre_name, telephone = intlPhone(phone), the address split by splitAddress(). Serialise it with safeJson().
 */
export function buildJsonLd(content: SiteContent, s: JsonLdSettings, origin: string): Record<string, unknown> {
  const vars = siteTemplateVars({ settings: s, brand: content.brand })
  const { locality, street } = splitAddress(s.address || TEMPLATE_EXAMPLE.address)
  const instagram = (s.instagram || '').replace(/^@/, '')
  const sameAs = [instagram ? `https://instagram.com/${instagram}` : '', content.brand.facebook_url, content.brand.tiktok_url].filter(Boolean)
  const plain = (t: string): string => fillTemplate(t, vars).replace(/\s+/g, ' ').trim()
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    additionalType: 'https://schema.org/CoworkingSpace',
    name: plain(content.seo.site_name),
    alternateName: vars.name,
    description: plain(content.seo.ld_description),
    slogan: plain(content.brand.slogan),
    url: origin,
    logo: `${origin}${content.brand.logo ? content.brand.logo.src : '/icons/icon-512.png'}`,
    image: `${origin}${content.seo.og_image.src}`,
    telephone: intlPhone(s.phone || TEMPLATE_EXAMPLE.phone),
    address: { '@type': 'PostalAddress', streetAddress: street, ...(locality ? { addressLocality: locality } : {}), addressCountry: 'SY' },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: s.open,
      closes: s.close,
    }],
    sameAs,
    currenciesAccepted: 'SYP',
  }
}

/** JSON safe inside <script> (window.__FP_BOOT__, JSON-LD): '<' and the JS line separators escaped. */
export function safeJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

// ---------- pictures and colour ----------

/** The picture for grids and cards: the ≤720 px variant when there is one, else src (uploads have no `small`). */
export const photoSmall = (p: Pick<Photo, 'src' | 'small'>): string => p.small || p.src

const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [h * 60, s, l]
}
function hslToHex(h: number, s: number, l: number): string {
  const S = Math.min(1, Math.max(0, s)), L = Math.min(1, Math.max(0, l))
  const k = (n: number): number => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number): number => Math.round(255 * (L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return `#${[f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The CSS variables that carry the brand colour (web/src/styles.css :root, site.css --fp-brand*, and --wine in
 * web/public/privacy.html). The default colour returns today's values exactly; another colour derives the same steps
 * (hover a little darker, two pale tints, a translucent line).
 */
export function brandPalette(hex: string): Record<string, string> {
  const c = COLOR_RE.test(hex.trim()) ? hex.trim().toLowerCase() : DEFAULT_BRAND_COLOR
  if (c === DEFAULT_BRAND_COLOR) {
    return { '--brand': '#7b1e2e', '--brand-hover': '#6a1927', '--brand-50': '#fdf2f4', '--brand-100': '#fbe4e8', '--wine': '#7b1e2e', '--wine-line': 'rgba(123, 30, 46, 0.32)' }
  }
  const rgb = rgbOf(c)
  const [h, s, l] = rgbToHsl(rgb)
  return {
    '--brand': c,
    '--brand-hover': hslToHex(h, s, l * 0.87),
    '--brand-50': hslToHex(h, s * 1.25, 0.97),
    '--brand-100': hslToHex(h, s * 1.18, 0.94),
    '--wine': c,
    '--wine-line': `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.32)`,
  }
}

/** The <style> body the Worker injects when the brand colour changed; '' for the default colour (nothing to add). */
export function brandStyle(hex: string): string {
  const p = brandPalette(hex)
  if (p['--brand'] === DEFAULT_BRAND_COLOR) return ''
  return `:root{${Object.entries(p).map(([k, v]) => `${k}:${v}`).join(';')}}`
}

/** WCAG contrast ratio of two #RRGGBB colours (1–21); the editor warns below 4.5 for white text on the brand colour. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const [r, g, bl] = rgbOf(COLOR_RE.test(hex) ? hex : '#000000').map((v) => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

// ---------- link / image rules ----------

/** https://… (incl. https://wa.me/…), a site path /…, tel:+963…, mailto:…; no spaces, quotes or angle brackets; ≤500. */
export function isSafeLink(s: string): boolean {
  if (!s || s.length > 500 || /[\s"'<>\\`]/.test(s)) return false
  if (s.startsWith('/')) return !s.startsWith('//')
  if (/^https:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:\d+)?([/?#]|$)/.test(s)) return true
  if (/^tel:\+?[0-9]{3,20}$/.test(s)) return true
  return /^mailto:[^@/?#]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\?.*)?$/.test(s)
}

/** Pictures come from the site itself: /img/<file> (shipped) or /media/<file> (uploaded). */
export function isSafeImageSrc(s: string): boolean {
  return /^\/(img|media)\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(s) && !s.includes('..')
}

const PHONE_RE = /^\+?[0-9][0-9 ]{5,19}$/
const EMAIL_RE = /^[^\s@]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/
const JPEG_PNG_RE = /\.(jpe?g|png)$/i

// ---------- the editor schema ----------

export type FieldKind = 'text' | 'longtext' | 'link' | 'image' | 'images' | 'list' | 'toggle' | 'number' | 'select' | 'icon' | 'color'

export interface FieldSpec {
  key: string                  // dot path inside the section (inside a list item: the item's property)
  label: string
  kind: FieldKind
  help?: string
  /** text/longtext/link: max length (defaults 200 / 2000 / 500); number: max value. */
  max?: number
  /** text/longtext/link: min length (1 = required); number: min value. */
  min?: number
  placeholders?: string[]      // the {vars} that make sense here (keys of TEMPLATE_VARS)
  options?: { value: string; label: string }[]   // select
  item?: FieldSpec[]           // list: the fields of one item
  maxItems?: number            // list (default 20) / images (default 12)
  minItems?: number
  preview?: string             // site path to open from the editor
  rich?: boolean               // text/longtext: **emphasis** and [label](link) allowed
  optional?: boolean           // image: may be null (no photo)
  decorative?: boolean         // image: alt may be empty (the picture says nothing a screen reader needs)
  jpegPng?: boolean            // image: src must be .jpg/.jpeg/.png (link previews); the editor uploads JPEG for it
  size?: { w: number; h: number }   // image: recommended pixel size (the editor warns on another ratio)
  fixed?: boolean              // list: the items are fixed (reorder and edit only, no add/remove)
  unique?: string              // list: this item property must not repeat
  readonly?: boolean           // shown, not editable (e.g. the section name in home.sections)
  format?: 'phone' | 'email'   // text: extra check when not empty
}
export interface FieldGroup { title: string; help?: string; preview?: string; fields: FieldSpec[] }
export interface SectionSpec {
  id: SectionId
  title: string
  help: string
  icon: SiteIconName
  preview?: string
  /** Settings fields edited next to (or linked from) this section in the editor. */
  settings?: string[]
  groups: FieldGroup[]
}

// field builders (keep the schema readable)
type Opt = Partial<Omit<FieldSpec, 'key' | 'label' | 'kind'>>
const text = (key: string, label: string, o: Opt = {}): FieldSpec => ({ key, label, kind: 'text', ...o })
const long = (key: string, label: string, o: Opt = {}): FieldSpec => ({ key, label, kind: 'longtext', ...o })
const link = (key: string, label: string, o: Opt = {}): FieldSpec => ({ key, label, kind: 'link', ...o })
const image = (key: string, label: string, o: Opt = {}): FieldSpec => ({ key, label, kind: 'image', ...o })
const images = (key: string, label: string, o: Opt = {}): FieldSpec => ({ key, label, kind: 'images', ...o })
const list = (key: string, label: string, item: FieldSpec[], o: Opt = {}): FieldSpec => ({ key, label, kind: 'list', item, ...o })
const toggle = (key: string, label: string, o: Opt = {}): FieldSpec => ({ key, label, kind: 'toggle', ...o })
const select = (key: string, label: string, options: { value: string; label: string }[], o: Opt = {}): FieldSpec => ({ key, label, kind: 'select', options, ...o })
const icon = (key: string, label = 'الأيقونة', o: Opt = {}): FieldSpec => ({ key, label, kind: 'icon', ...o })
const color = (key: string, label: string, o: Opt = {}): FieldSpec => ({ key, label, kind: 'color', ...o })
const helps = (...h: (string | undefined)[]): Opt => { const s = h.filter(Boolean).join('. '); return s ? { help: s } : {} }

const ph = (...keys: TemplateVar[]): Opt => ({ placeholders: [...keys] })
const P = ph(...SITE_VARS)
/** The announcement also shows on the booking pages, which do not load the rooms: no room placeholders. */
const ANNOUNCE_VARS = SITE_VARS.filter((k) => !ROOM_VARS.includes(k))
const SHAM_ONLY = 'لما «الدفع عند الوصول» يكون مطفي بالإعدادات. فاضي = نفس النص'
const CASH_ONLY = 'لما «شام كاش» يكون مطفي بالإعدادات (الدفع عند الوصول بس). فاضي = نفس النص'
const NO_CANCEL = 'لما الزبون ما بيقدر يلغي حجزه بنفسه (من الإعدادات). فاضي = نفس الجواب'
const NO_REMINDER = 'لما التذكير قبل الحجز يكون مطفي بالإعدادات'
const BOLD = (v: string): string => `${v} بيطلع عريض`

/** kicker / title / lead of a section heading: the kicker and the lead may be empty (hidden), the title may not. */
const head = (prefix: string, o: { lead?: boolean; titleRich?: boolean; leadRich?: boolean; titleHelp?: string } = {}): FieldSpec[] => [
  text(`${prefix}kicker`, 'السطر الصغير', { help: 'بيطلع فوق العنوان بخط صغير. فاضي = ما بيطلع', max: 60, ...P }),
  text(`${prefix}title`, 'العنوان', { min: 1, max: 120, ...P, ...(o.titleRich ? { rich: true } : {}), ...helps(o.titleRich ? 'الكلام بين **نجمتين** بيطلع بلون المركز' : undefined, o.titleHelp) }),
  ...(o.lead === false ? [] : [long(`${prefix}lead`, 'الوصف', { max: 400, ...P, ...(o.leadRich ? { rich: true } : {}), ...helps('فاضي = ما بيطلع', o.leadRich ? 'رابط: [النص](/contact)' : undefined) })]),
]
const iconCards = (key: string, label: string, maxItems: number, help?: string): FieldSpec =>
  list(key, label, [icon('icon'), text('title', 'العنوان', { min: 1, max: 80, ...P }), long('text', 'النص', { max: 300, ...P })], { maxItems, ...helps(help) })
const msg = (key: string, label: string, keys: TemplateVar[], help: string, extra: FieldSpec[] = []): FieldGroup => ({
  title: label,
  help,
  fields: [
    text(`${key}.title`, 'العنوان', { min: 1, max: 80, ...ph(...keys) }),
    long(`${key}.body`, 'النص', { min: 1, max: 500, ...ph(...keys) }),
    ...extra,
  ],
})
const BOOKING_MSG_VARS: TemplateVar[] = ['room', 'when', 'code']
const AMENITY_OPTIONS: { value: AmenityKey; label: string }[] = [
  { value: 'wifi', label: 'إنترنت' },
  { value: 'ac', label: 'تكييف' },
  { value: 'screen', label: 'شاشة' },
  { value: 'whiteboard', label: 'سبورة' },
  { value: 'projector', label: 'بروجكتر' },
  { value: 'coffee', label: 'قهوة' },
]
const groupFields = (id: SpaceGroupId): FieldSpec[] => [
  text(`groups.${id}.title`, 'الاسم', { min: 1, max: 60 }),
  long(`groups.${id}.blurb`, 'الوصف', { max: 300, ...P }),
  text(`groups.${id}.cap`, 'عدد الأشخاص (احتياطي)', { max: 40, help: 'بيطلع بس إذا ما تحمّلت الغرف أو ما في غرفة شغّالة من هالنوع. العدد الحقيقي بيتحسب من القاعات' }),
  text(`groups.${id}.badge`, 'الشارة على الصورة', { max: 30, ...P, help: 'على صورة الكرت بالصفحة الرئيسية. فاضي = ما بتطلع' }),
  icon(`groups.${id}.icon`),
  image(`groups.${id}.photo`, 'الصورة', { optional: true, help: 'بتطلع على كرت المساحة. بلا صورة = رسمة بسيطة. صور كل غرفة بتنحط من القاعات' }),
  list(`groups.${id}.amenities`, 'التجهيزات (احتياطي)', [select('key', 'التجهيز', AMENITY_OPTIONS)], {
    maxItems: AMENITY_KEYS.length, unique: 'key',
    help: 'بتطلع بس إذا ما تحمّلت الغرف أو ما في غرفة شغّالة من هالنوع. غير هيك بتطلع التجهيزات الموجودة بكل غرف النوع (من القاعات)',
  }),
]

const HOME_SECTION_OPTIONS: { value: HomeSectionId; label: string }[] = [
  { value: 'hero', label: 'الواجهة الرئيسية' },
  { value: 'facts', label: 'شريط الأرقام' },
  { value: 'features', label: 'المميزات' },
  { value: 'spaces', label: 'المساحات' },
  { value: 'how', label: 'كيف بتحجز' },
  { value: 'gallery', label: 'معرض الصور' },
  { value: 'visit', label: 'الدوام والعنوان' },
  { value: 'faq', label: 'الأسئلة المتكررة' },
  { value: 'cta', label: 'دعوة للحجز' },
]

function section(id: SectionId, title: string, help: string, ic: SiteIconName, preview: string | undefined, groups: FieldGroup[], settings?: string[]): SectionSpec {
  return {
    id, title, help, icon: ic,
    ...(preview ? { preview } : {}),
    ...(settings ? { settings } : {}),
    groups: groups.map((g) => {
      const gp = g.preview ?? preview
      return { ...g, fields: g.fields.map((f) => (f.preview || !gp ? f : { ...f, preview: gp })) }
    }),
  }
}

export const CONTENT_SECTIONS: SectionSpec[] = [
  section('brand', 'الهوية والتواصل', 'الاسم بالإنكليزي والشعار واللوغو وروابط التواصل. اسم المركز ورقمه وعنوانه وإنستغرام والدوام بيتعدّلوا من الإعدادات › المركز.', 'award', '/', [
    {
      title: 'الاسم والشعار',
      fields: [
        text('name_latin', 'الاسم بالإنكليزي', { min: 1, max: 40, help: 'بيطلع جنب اللوغو فوق وتحت بالموقع' }),
        text('subtitle', 'السطر تحت الاسم', { max: 60, help: 'تحت الاسم الإنكليزي بالهيدر والفوتر' }),
        text('eyebrow', 'الجملة المميّزة', { min: 1, max: 80, help: 'بأول الصفحة الرئيسية، وبصفحة من نحن والفوتر. بتقدر تحطها بأي نص كـ {eyebrow}' }),
        text('slogan', 'الشعار', { min: 1, max: 80, help: 'بصفحة من نحن والفوتر. بتقدر تحطه بأي نص كـ {slogan}' }),
        image('logo', 'اللوغو', {
          optional: true, decorative: true, size: { w: 512, h: 512 },
          help: 'مربّع، بخلفية شفافة إذا بتقدر. فاضي = اللوغو الحالي. أيقونة التبويب وأيقونة التطبيق ما بتتغيّر من هون',
        }),
      ],
    },
    {
      title: 'التواصل والروابط',
      help: 'الرابط الفاضي ما بيطلع بالموقع.',
      fields: [
        text('whatsapp', 'رقم الواتساب', { max: 20, format: 'phone', help: 'فاضي = نفس رقم المركز. بيطلع بالموقع بالشكل الدولي \u200e+963…' }),
        text('email', 'الإيميل', { max: 120, format: 'email' }),
        link('maps_url', 'رابط المكان على الخريطة', { help: 'فاضي = بحث عن العنوان بخرائط Google. الأحسن تحط رابط المكان الدقيق' }),
        link('facebook_url', 'رابط فيسبوك'),
        link('tiktok_url', 'رابط تيك توك'),
        link('play_url', 'رابط التطبيق على Google Play'),
      ],
    },
    {
      title: 'حالة الدوام',
      help: 'الشارة على كرت الدوام بالصفحة الرئيسية وصفحة التواصل، حسب الساعة هلأ.',
      preview: '/contact',
      fields: [
        text('status_open', 'وقت الدوام', { min: 1, max: 40, ...P }),
        text('status_closed', 'برّا الدوام', { min: 1, max: 80, ...P }),
      ],
    },
  ], ['centre_name', 'phone', 'address', 'instagram', 'open', 'close']),

  section('announcement', 'شريط الإعلان', 'شريط صغير فوق الموقع وصفحات الحجز، لخبر أو عرض أو عطلة.', 'bell', '/', [
    {
      title: 'الإعلان',
      fields: [
        toggle('enabled', 'إظهار الإعلان'),
        text('text', 'نص الإعلان', { max: 160, ...ph(...ANNOUNCE_VARS), help: 'لازم يكون في نص إذا الإعلان ظاهر' }),
        select('tone', 'اللون', [
          { value: 'info', label: 'معلومة (أزرق فاتح)' },
          { value: 'success', label: 'خبر حلو (أخضر فاتح)' },
          { value: 'warning', label: 'تنبيه (رمادي مع نقطة برتقالية)' },
        ]),
        text('link_label', 'نص الرابط', { max: 40, help: 'اختياري، مثل «احجز هلأ». إذا كتبته لازم تحط الرابط' }),
        link('link_url', 'الرابط', { help: 'اختياري. مثال: /book. إذا حطيته لازم تكتب نص الرابط' }),
      ],
    },
  ]),

  section('home', 'الصفحة الرئيسية', 'كل نصوص وصور الصفحة الرئيسية، وترتيب أقسامها.', 'home', '/', [
    {
      title: 'ترتيب الأقسام',
      help: 'رتّب الأقسام بالأسهم وخبّي اللي ما بدك ياه. الخلفية الرمادية بتفصل بين قسمين ورا بعض.',
      fields: [
        list('sections', 'الأقسام', [
          select('id', 'القسم', HOME_SECTION_OPTIONS, { readonly: true }),
          toggle('visible', 'ظاهر'),
          toggle('tint', 'خلفية رمادية', { help: 'ما إلها أثر على الواجهة وشريط الأرقام ودعوة الحجز' }),
        ], { fixed: true }),
      ],
    },
    {
      title: 'الواجهة الرئيسية',
      help: 'أول شي بيشوفه الزبون. الجملة الصغيرة فوق العنوان من «الهوية والتواصل».',
      fields: [
        text('hero.title', 'العنوان الكبير', { min: 1, max: 120, rich: true, help: 'الكلام بين **نجمتين** بيطلع بلون المركز' }),
        long('hero.lead', 'الوصف', { max: 400, ...P, help: 'فيه اسم الشارع مكتوب بالحرف: عدّله إذا تغيّر العنوان' }),
        list('hero.chips', 'المعلومات السريعة', [
          icon('icon'),
          text('text', 'النص', { min: 1, max: 60, ...P }),
          text('text_shamcash_only', 'النص بلا الدفع عند الوصول', { max: 60, ...P, help: SHAM_ONLY }),
          text('text_cash_only', 'النص بلا شام كاش', { max: 60, ...P, help: CASH_ONLY }),
        ], { maxItems: 4, help: 'سطور صغيرة تحت الأزرار' }),
        image('hero.photo', 'الصورة'),
        icon('hero.badge_icon', 'أيقونة الشارة'),
        text('hero.badge_title', 'الشارة: السطر الأول', { max: 60, ...P, help: 'الشارة فوق الصورة. فاضي = ما بتطلع. فيها عدد أشخاص القاعة مكتوب بالحرف («لعشرة»): عدّله إذا تغيّرت القاعة' }),
        text('hero.badge_text', 'الشارة: السطر الثاني', { max: 60, ...P }),
      ],
    },
    {
      title: 'شريط الأرقام',
      help: 'الشريط تحت الواجهة: رقم أو معلومة كبيرة وتحتها سطر صغير.',
      fields: [
        text('facts.label', 'اسم الشريط (لقارئ الشاشة)', { min: 1, max: 80, ...P }),
        list('facts.items', 'المعلومات', [
          icon('icon'),
          text('value', 'المعلومة', { min: 1, max: 60, ...P }),
          text('label', 'السطر الصغير', { max: 80, ...P }),
        ], { maxItems: 4, help: 'المعلومة التانية فيها العنوان مكتوب بالحرف: عدّلها إذا تغيّر العنوان' }),
      ],
    },
    {
      title: 'المميزات',
      preview: '/#why',
      fields: [...head('features.'), iconCards('features.items', 'المميزات', 12)],
    },
    {
      title: 'المساحات',
      preview: '/#spaces',
      help: 'كروت المساحات (الاسم والوصف والصورة) من قسم «صفحة المساحات»، والأسعار من القاعات.',
      fields: head('spaces.'),
    },
    {
      title: 'كيف بتحجز',
      preview: '/#how',
      fields: [
        ...head('how.', { lead: false, titleHelp: 'فيه عدد الخطوات («3 خطوات»): عدّله إذا زدت أو نقصت خطوة' }),
        list('how.steps', 'الخطوات', [
          icon('icon'),
          text('title', 'العنوان', { min: 1, max: 80, ...P }),
          text('title_shamcash_only', 'العنوان بلا الدفع عند الوصول', { max: 80, ...P, help: SHAM_ONLY }),
          text('title_cash_only', 'العنوان بلا شام كاش', { max: 80, ...P, help: CASH_ONLY }),
          long('text', 'النص', { max: 300, ...P }),
          long('text_shamcash_only', 'النص بلا الدفع عند الوصول', { max: 300, ...P, help: SHAM_ONLY }),
          long('text_cash_only', 'النص بلا شام كاش', { max: 300, ...P, help: CASH_ONLY }),
        ], { maxItems: 6, minItems: 1, help: 'الرقم جنب كل خطوة بيتحط لحاله' }),
      ],
    },
    {
      title: 'معرض الصور',
      preview: '/#gallery',
      help: 'نفس الصور بتطلع بصفحة من نحن.',
      fields: [
        ...head('gallery.'),
        images('gallery.photos', 'الصور', {
          minItems: 4, maxItems: 4,
          help: '4 صور بالضبط، بترتيب الشبكة: الأولى كبيرة، التانية طويلة، التالتة عريضة تحت، الرابعة صغيرة تحت المربع المكتوب. الوصف بيطلع تحت الصورة لما تتكبّر',
        }),
        long('gallery.quote', 'المربع المكتوب', { min: 1, max: 60, help: 'مربع بلون المركز بين الصور. كل سطر بسطر، عربي أو إنكليزي' }),
      ],
    },
    {
      title: 'الدوام والعنوان',
      preview: '/#visit',
      help: 'الشارة «مفتوح هلأ» من «الهوية والتواصل».',
      fields: [
        ...head('visit.'),
        text('visit.hours_title', 'عنوان كرت الدوام', { min: 1, max: 60 }),
        text('visit.hours_line', 'سطر الدوام', { max: 120, ...P }),
        text('visit.address_title', 'عنوان كرت العنوان', { min: 1, max: 60 }),
      ],
    },
    {
      title: 'الأسئلة المتكررة',
      preview: '/#faq',
      fields: [
        ...head('faq.', { leadRich: true }),
        list('faq.items', 'الأسئلة', [
          text('q', 'السؤال', { min: 1, max: 120, ...P }),
          long('a', 'الجواب', { min: 1, max: 600, rich: true, ...P, help: 'رابط: [النص](/spaces)' }),
          long('a_shamcash_only', 'الجواب بلا الدفع عند الوصول', { max: 600, rich: true, ...P, help: SHAM_ONLY }),
          long('a_cash_only', 'الجواب بلا شام كاش', { max: 600, rich: true, ...P, help: CASH_ONLY }),
          long('a_no_cancel', 'الجواب إذا الزبون ما بيقدر يلغي', { max: 600, rich: true, ...P, help: NO_CANCEL }),
        ]),
      ],
    },
    {
      title: 'دعوة للحجز',
      help: 'الشريط الملوّن آخر الصفحة. بيطلع كمان بصفحة من نحن.',
      fields: [
        text('cta.title', 'العنوان', { min: 1, max: 120, ...P }),
        long('cta.text', 'النص', { min: 1, max: 300, ...P }),
        long('cta.text_shamcash_only', 'النص بلا الدفع عند الوصول', { max: 300, ...P, help: SHAM_ONLY }),
        long('cta.text_cash_only', 'النص بلا شام كاش', { max: 300, ...P, help: CASH_ONLY }),
      ],
    },
  ]),

  section('spaces', 'صفحة المساحات', 'رأس صفحة المساحات، والاسم والوصف والصورة لكل نوع مساحة (بيطلعوا كمان بالصفحة الرئيسية). الغرف وأسعارها من القاعات.', 'grid', '/spaces', [
    { title: 'رأس الصفحة', fields: head('') },
    { title: 'غرف خاصة', preview: '/spaces#sp-private', fields: groupFields('private') },
    { title: 'قاعة الاجتماعات', preview: '/spaces#sp-meeting', fields: groupFields('meeting') },
    { title: 'المساحة المفتوحة', preview: '/spaces#sp-open', fields: groupFields('open') },
    {
      title: 'سطر السعر',
      help: 'تحت كل كرت: «تبدأ من 15,000 ل.س بالساعة». السعر نفسه من القاعات.',
      fields: [
        text('price_from', 'قبل السعر', { min: 1, max: 30 }),
        text('price_from_short', 'قبل السعر (مختصر)', { min: 1, max: 20 }),
        text('price_unit', 'بعد السعر', { max: 30 }),
        text('price_unknown', 'إذا ما تحمّلت الأسعار', { min: 1, max: 80 }),
      ],
    },
    {
      title: 'لما ما في مساحات',
      help: 'إذا ما في ولا غرفة شغّالة.',
      fields: [
        text('empty_title', 'العنوان', { min: 1, max: 80, ...P }),
        long('empty_text', 'النص', { max: 300, ...P }),
      ],
    },
    {
      title: 'دعوة للحجز',
      fields: [text('cta_title', 'العنوان', { min: 1, max: 120, ...P }), long('cta_text', 'النص', { max: 300, ...P })],
    },
  ]),

  section('about', 'صفحة من نحن', 'حكاية المركز، لمين هو، وقيمه.', 'people', '/about', [
    { title: 'رأس الصفحة', fields: head('', { titleRich: true }) },
    {
      title: 'حكايتنا',
      fields: [
        ...head('story.', { lead: false }),
        list('story.paragraphs', 'الفقرات', [long('text', 'الفقرة', { min: 1, max: 1000, ...P })], { maxItems: 6 }),
        image('story.photo', 'الصورة'),
      ],
    },
    { title: 'لمين المركز', fields: [...head('audience.', { lead: false }), iconCards('audience.items', 'الفئات', 8, '«فرق صغيرة» فيها «لعشرة» مكتوب بالحرف: عدّله إذا تغيّرت القاعة')] },
    { title: 'قيمنا', fields: [...head('values.', { lead: false }), iconCards('values.items', 'القيم', 6)] },
    { title: 'معرض الصور', help: 'الصور نفسها تبع معرض الصفحة الرئيسية.', fields: head('gallery.') },
  ]),

  section('contact', 'صفحة تواصل معنا', 'نصوص صفحة التواصل. الرقم والعنوان وإنستغرام من الإعدادات، والواتساب من «الهوية والتواصل».', 'phone', '/contact', [
    { title: 'رأس الصفحة', fields: head('') },
    {
      title: 'كروت التواصل',
      fields: [
        text('cards.phone_title', 'كرت الهاتف', { max: 40 }),
        text('cards.whatsapp_title', 'كرت الواتساب', { max: 40 }),
        text('cards.instagram_title', 'كرت إنستغرام', { max: 40 }),
        text('cards.address_title', 'كرت العنوان', { max: 40 }),
      ],
    },
    {
      title: 'أوقات الدوام',
      help: 'الشارة «مفتوح هلأ» من «الهوية والتواصل».',
      fields: [
        text('hours.title', 'العنوان', { min: 1, max: 60 }),
        text('hours.line', 'السطر الكبير', { max: 120, ...P }),
        text('hours.sub', 'السطر الصغير', { max: 160, ...P }),
      ],
    },
    {
      title: 'كيف توصلنا',
      fields: [
        ...head('find.', { lead: false }),
        list('find.steps', 'الخطوات', [text('text', 'الخطوة', { min: 1, max: 160, rich: true, ...P, help: 'الكلام بين **نجمتين** بيطلع عريض' })], { maxItems: 6 }),
      ],
    },
  ]),

  section('footer', 'أسفل الموقع', 'الفوتر تحت كل صفحات الموقع.', 'list', '/', [
    {
      title: 'الفوتر',
      fields: [
        long('tagline', 'نبذة', { max: 400, ...P }),
        text('hours_line', 'سطر الدوام', { max: 80, ...P, help: 'بيطلع كمان بقائمة الموبايل' }),
        text('copyright', 'سطر الحقوق', { max: 120 }),
      ],
    },
  ]),

  section('booking', 'الحجز والدفع', 'النصوص اللي بيشوفها الزبون وقت الحجز والدفع ومتابعة حجزه. خيارات الحجز والدفع نفسها من الإعدادات.', 'calendar', '/book', [
    {
      title: 'صفحة الحجز',
      fields: [
        text('intro_title', 'العنوان', { min: 1, max: 60, ...P }),
        text('intro_hours', 'سطر الدوام', { max: 120, ...P }),
        text('intro_fallback', 'السطر قبل ما تتحمّل البيانات', { max: 120, help: 'بيطلع لحظة قبل ما توصل الإعدادات، فما فيه بيانات حيّة' }),
        text('no_rooms', 'إذا ما في غرف', { min: 1, max: 120, ...P }),
      ],
    },
    {
      title: 'لما يكون الحجز متوقف',
      help: 'بيطلع بدل نموذج الحجز لما توقف الحجز من الإعدادات. إذا كتبت رسالة بالإعدادات، بتطلع هي بدل النص هون.',
      fields: [
        text('closed_title', 'العنوان', { min: 1, max: 80, ...P }),
        long('closed_text', 'النص', { max: 500, ...P }),
      ],
    },
    {
      title: 'طريقة الدفع',
      help: 'الاختيار بيطلع بس إذا «شام كاش» و«الدفع عند الوصول» مفعّلين سوا.',
      fields: [
        text('method_shamcash', 'اسم خيار شام كاش', { min: 1, max: 40 }),
        text('method_cash', 'اسم خيار الدفع عند الوصول', { min: 1, max: 40 }),
        text('method_hint_shamcash', 'شرح شام كاش', { max: 200, ...P }),
        text('method_hint_cash', 'شرح الدفع عند الوصول', { max: 200, ...P }),
        text('note_shamcash', 'ملاحظة تحت الزر (شام كاش)', { max: 200, ...ph(...SITE_VARS, 'holdMinutes') }),
        text('note_cash', 'ملاحظة تحت الزر (عند الوصول)', { max: 200, ...P }),
      ],
    },
    {
      title: 'الدفع بشام كاش',
      fields: [
        text('pay_title', 'العنوان', { min: 1, max: 80 }),
        text('pay_held_until', 'سطر المهلة', { max: 160, ...ph(...SITE_VARS, 'time', 'holdMinutes') }),
        list('pay_steps', 'الخطوات', [text('text', 'الخطوة', { min: 1, max: 200, ...ph(...SITE_VARS, 'code') })], { maxItems: 6, help: BOLD('{code}') }),
        text('pay_expired_title', 'عنوان انتهاء المهلة', { min: 1, max: 80 }),
        long('pay_expired_text', 'نص انتهاء المهلة', { max: 400, ...ph(...SITE_VARS, 'code'), help: BOLD('{code}') }),
      ],
    },
    {
      title: 'حالة الحجز',
      help: 'صفحة الحجز اللي بيتابع منها الزبون.',
      fields: [
        text('cash_awaiting_title', 'بانتظار الفريق (عند الوصول): العنوان', { min: 1, max: 80 }),
        long('cash_awaiting_text', 'بانتظار الفريق (عند الوصول): النص', { max: 400, ...P }),
        text('verifying_title', 'عم نتحقق من الدفع: العنوان', { min: 1, max: 80 }),
        long('verifying_text', 'عم نتحقق من الدفع: النص', { max: 400, ...ph(...SITE_VARS, 'ref'), help: BOLD('{ref}') }),
        text('confirmed_title', 'مؤكد: العنوان', { min: 1, max: 80 }),
        text('rejected_title', 'مرفوض: العنوان', { min: 1, max: 80 }),
        long('rejected_text', 'مرفوض: النص', { max: 400, ...P, help: 'الزبون بيشوف السبب اللي كتبه الفريق (الرفض بيطلب سبب). هالنص بيطلع بس لحجز مرفوض بلا سبب' }),
        text('expired_title', 'انتهت المهلة: العنوان', { min: 1, max: 80 }),
        long('expired_text', 'انتهت المهلة: النص', { max: 400, ...P, help: 'لما تخلص مهلة الدفع وما وصل رقم العملية' }),
        long('expired_text_unverified', 'انتهت وهي بانتظار الفريق: النص', { max: 400, ...P, help: 'لحجز بعت رقم العملية أو اختار الدفع عند الوصول، وخلص وقته وما حدا من الفريق أكّده' }),
        text('cancelled_title', 'ملغى: العنوان', { min: 1, max: 80 }),
        long('cancelled_text', 'ملغى: النص', { max: 400, ...P }),
        text('completed_title', 'انتهى: العنوان', { min: 1, max: 80 }),
        long('completed_text', 'انتهى: النص', { max: 400, ...P }),
      ],
    },
    {
      title: 'إلغاء الحجز',
      help: 'النافذة اللي بتطلع لما الزبون يضغط «إلغاء الحجز».',
      fields: [
        text('cancel_title', 'السؤال', { min: 1, max: 80, ...P }),
        text('cancel_note', 'نص التأكيد', { max: 200, ...P }),
        text('cancel_note_paid', 'إضافة إذا كان محوّل المبلغ', { max: 200, ...P }),
      ],
    },
    {
      title: 'الإشعارات والتطبيق',
      fields: [
        text('notify_title', 'دعوة الإشعارات: العنوان', { min: 1, max: 60, ...P }),
        text('notify_prompt', 'دعوة الإشعارات (بعد الحجز)', { min: 1, max: 200, ...ph(...SITE_VARS, 'reminder') }),
        text('notify_prompt_no_reminder', 'دعوة الإشعارات (بعد الحجز) بلا تذكير', { min: 1, max: 200, ...P, help: NO_REMINDER }),
        text('notify_prompt_mine', 'دعوة الإشعارات (حجوزاتي)', { min: 1, max: 200, ...ph(...SITE_VARS, 'reminder') }),
        text('notify_prompt_mine_no_reminder', 'دعوة الإشعارات (حجوزاتي) بلا تذكير', { min: 1, max: 200, ...P, help: NO_REMINDER }),
        text('install_title', 'تثبيت التطبيق: العنوان', { min: 1, max: 80, ...P }),
        text('install_text', 'تثبيت التطبيق: النص', { max: 200, ...P }),
        text('install_text_ios', 'تثبيت التطبيق: النص على iPhone', { max: 200, ...P }),
      ],
    },
    {
      title: 'الصفحات الفاضية',
      fields: [
        text('mine_empty_title', 'حجوزاتي بلا حجوزات: العنوان', { min: 1, max: 80, ...P }),
        text('mine_empty_text', 'حجوزاتي بلا حجوزات: النص', { max: 200, ...P, help: 'فيه عدد خطوات الحجز مكتوب بالحرف («بثلاث خطوات»)' }),
        text('inbox_empty_title', 'الإشعارات فاضية: العنوان', { min: 1, max: 80, ...P }),
        text('inbox_empty_text', 'الإشعارات فاضية: النص', { max: 200, ...P }),
      ],
    },
  ], ['booking_enabled', 'booking_closed_message', 'shamcash_enabled', 'allow_pay_on_arrival', 'booking_horizon_days', 'hold_minutes', 'reminder_minutes', 'max_open_holds_per_phone', 'customer_can_cancel', 'payment_instructions']),

  section('messages', 'رسائل الإشعارات', 'الإشعارات اللي بتوصل للزبون وللفريق بشكل تلقائي، ورسالة الواتساب من لوحة الفريق.', 'send', undefined, [
    msg('booking_created', 'حجز جديد (للفريق)', ['customer_name', ...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للفريق لما زبون يحجز.'),
    msg('payment_submitted', 'دفعة بانتظار التحقق (للفريق)', ['customer_name', ...BOOKING_MSG_VARS, 'price', 'ref', 'phone', 'name'], 'بيوصل للفريق لما الزبون يبعت رقم العملية، أو يحجز بالدفع عند الوصول.', [
      long('payment_submitted.body_cash', 'النص للدفع عند الوصول', { min: 1, max: 500, ...ph('customer_name', ...BOOKING_MSG_VARS, 'price', 'phone', 'name') }),
    ]),
    msg('booking_confirmed', 'تأكيد الحجز (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للزبون لما الفريق يأكّد.'),
    msg('booking_rejected', 'رفض الدفع (للزبون)', [...BOOKING_MSG_VARS, 'reason', 'price', 'phone', 'name'], 'بيوصل للزبون لما الفريق يرفض الدفع.'),
    msg('booking_expired', 'انتهاء المهلة (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للزبون لما تخلص مهلة الدفع.', [
      long('booking_expired.body_unverified', 'النص إذا انتهى وهو بانتظار الفريق', {
        min: 1, max: 500, ...ph(...BOOKING_MSG_VARS, 'price', 'phone', 'name'),
        help: 'لحجز بعت رقم العملية أو اختار الدفع عند الوصول، وخلص وقته وما حدا من الفريق أكّده',
      }),
    ]),
    msg('booking_cancelled', 'إلغاء من الفريق (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للزبون لما الفريق يلغي حجزه.'),
    msg('booking_reminder', 'التذكير قبل الحجز (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name', 'reminder'], 'بيوصل للزبون قبل موعده بـ {reminder} (المدة من الإعدادات). ما بيوصل إذا التذكير مطفي.'),
    {
      title: 'رسالة الواتساب من الفريق',
      help: 'النص اللي بينكتب لحاله لما حدا من الفريق يضغط «واتساب» بصفحة الحجز.',
      fields: [long('team_whatsapp', 'الرسالة', { min: 1, max: 500, ...ph('customer_name', 'code', 'room', 'name') })],
    },
  ]),

  section('seo', 'محركات البحث والمشاركة', 'شو بيطلع بـ Google، وبالمعاينة لما حدا يشارك رابط الموقع على واتساب أو فيسبوك، واسم التطبيق.', 'search', '/', [
    {
      title: 'نتائج البحث',
      fields: [
        text('title', 'عنوان الموقع', { min: 1, max: 120, ...ph('name', 'slogan', 'eyebrow'), help: 'اسم التبويب ونتيجة Google' }),
        text('description', 'الوصف', {
          max: 300, ...ph('name', 'address', 'phone', ...HOURS_VARS, 'slogan', 'eyebrow'),
          help: 'تحت العنوان بنتائج Google. الأحسن بين 120 و160 حرف. فيه الدوام مكتوب بالحرف («من 9 الصبح لـ 11 بالليل»): عدّله إذا تغيّر الدوام، أو حط {hours}',
        }),
        text('ld_description', 'الوصف لـ Google (بيانات المركز)', { max: 300, ...ph('name', 'address', 'slogan', 'eyebrow') }),
      ],
    },
    {
      title: 'المشاركة على واتساب وفيسبوك',
      fields: [
        text('site_name', 'اسم الموقع', { min: 1, max: 80, ...ph('name'), help: 'كمان اسم المركز ببيانات Google' }),
        text('og_title', 'العنوان', { min: 1, max: 120, ...ph('name', 'slogan', 'eyebrow') }),
        text('og_description', 'الوصف', { max: 300, ...ph('name', 'address', ...HOURS_VARS, 'slogan', 'eyebrow') }),
        image('og_image', 'الصورة', { jpegPng: true, size: { w: 1200, h: 630 }, help: 'JPG أو PNG (واتساب ما بيعرض WebP منيح)، والأحسن 1200×630' }),
      ],
    },
    {
      title: 'عناوين الصفحات',
      help: 'اسم التبويب لكل صفحة. فاضي = عنوان الموقع.',
      fields: [
        text('pages.home', 'الصفحة الرئيسية', { max: 120, ...ph('name', 'slogan', 'eyebrow'), preview: '/' }),
        text('pages.spaces', 'المساحات', { max: 120, ...ph('name', 'slogan', 'eyebrow'), preview: '/spaces' }),
        text('pages.about', 'من نحن', { max: 120, ...ph('name', 'slogan', 'eyebrow'), preview: '/about' }),
        text('pages.contact', 'تواصل معنا', { max: 120, ...ph('name', 'slogan', 'eyebrow'), preview: '/contact' }),
        text('pages.book', 'الحجز', { max: 120, ...ph('name', 'slogan', 'eyebrow'), preview: '/book' }),
      ],
    },
    {
      title: 'التطبيق',
      help: 'اسم الموقع لما ينضاف للشاشة الرئيسية. تطبيق Android اسمه ثابت بالمتجر.',
      fields: [
        text('app_name', 'اسم التطبيق', { min: 1, max: 45 }),
        text('app_short_name', 'الاسم القصير', { min: 1, max: 12, help: 'تحت الأيقونة (كمان على iPhone). 12 حرف أو أقل' }),
        text('app_description', 'الوصف', { max: 200 }),
      ],
    },
  ]),

  section('theme', 'اللون', 'لون المركز بالموقع وصفحات الحجز.', 'sparkle', '/', [
    {
      title: 'اللون',
      fields: [color('brand', 'لون المركز', { help: 'الأزرار والعناوين الملوّنة وشريط الحجز. الدرجات الأفتح والأغمق بتنحسب لحالها. الأحسن لون غامق ليقرا الأبيض فوقه.' })],
    },
  ]),
]

const SPEC_BY_ID = Object.fromEntries(CONTENT_SECTIONS.map((s) => [s.id, s])) as Record<SectionId, SectionSpec>

/** All fields of a section, in editor order. */
export const sectionFields = (spec: SectionSpec): FieldSpec[] => spec.groups.flatMap((g) => g.fields)

// ---------- validation and merge ----------

export type ContentErrorCode =
  | 'unknown_section' | 'not_object' | 'bad_type' | 'required' | 'too_long' | 'bad_link' | 'bad_image' | 'bad_format' | 'bad_size'
  | 'too_many' | 'too_few' | 'duplicate' | 'bad_option' | 'bad_icon' | 'bad_color' | 'out_of_range' | 'bad_phone' | 'bad_email'

const ERROR_TEXT: Record<ContentErrorCode, string> = {
  unknown_section: 'قسم غير معروف',
  not_object: 'بيانات القسم غير صحيحة',
  bad_type: 'نوع القيمة غير صحيح',
  required: 'هالحقل مطلوب',
  too_long: 'النص أطول من المسموح',
  bad_link: 'الرابط لازم يبدأ بـ https:// أو / أو tel: أو mailto:',
  bad_image: 'الصورة لازم تكون من صور الموقع (/img/ أو /media/)',
  bad_format: 'الصورة لازم تكون JPG أو PNG',
  bad_size: 'أبعاد الصورة غير صحيحة',
  too_many: 'العدد أكتر من المسموح',
  too_few: 'العدد أقل من المطلوب',
  duplicate: 'في عنصر مكرر',
  bad_option: 'اختيار غير معروف',
  bad_icon: 'أيقونة غير معروفة',
  bad_color: 'اللون لازم يكون بالشكل \u200e#RRGGBB',
  out_of_range: 'الرقم خارج الحدود',
  bad_phone: 'رقم غير صحيح',
  bad_email: 'إيميل غير صحيح',
}

export interface ContentFailure { ok: false; error: ContentErrorCode; path: string; message: string }
export type ContentResult<T> = { ok: true; value: T } | ContentFailure

const fail = (error: ContentErrorCode, path: string, limit?: number): ContentFailure =>
  ({ ok: false, error, path, message: limit === undefined ? ERROR_TEXT[error] : `${ERROR_TEXT[error]} (${limit})` })
const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value })

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function getPath(o: unknown, path: string): unknown {
  let cur = o
  for (const k of path.split('.')) {
    if (!isObj(cur) || !hasOwn(cur, k)) return undefined
    cur = cur[k]
  }
  return cur
}
function setPath(o: Record<string, unknown>, path: string, v: unknown): void {
  const keys = path.split('.')
  let cur = o
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i] as string
    const next = cur[k]
    if (isObj(next)) cur = next
    else { const fresh: Record<string, unknown> = {}; cur[k] = fresh; cur = fresh }
  }
  cur[keys[keys.length - 1] as string] = v
}

// control characters (except tab and newline) never belong in content
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
function cleanText(s: string, multiline: boolean): string {
  const t = s.replace(/\r\n?/g, '\n').replace(CONTROL_RE, '')
  return (multiline ? t : t.replace(/\s*\n\s*/g, ' ')).trim()
}
const isDim = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 20000

/** The value a list item gets for a property it does not have (fixed lists use their default item instead). */
function emptyValue(f: FieldSpec): unknown {
  switch (f.kind) {
    case 'toggle': return false
    case 'number': return f.min ?? 0
    case 'select': return f.options?.[0]?.value ?? ''
    case 'icon': return 'check' satisfies SiteIconName
    case 'image': return null
    case 'images': case 'list': return []
    default: return ''
  }
}

function checkImage(f: FieldSpec, v: unknown, path: string): ContentResult<Photo | null> {
  if (v === null && f.optional) return ok(null)
  if (!isObj(v)) return fail(v === null || v === undefined ? 'required' : 'bad_type', path)
  if (typeof v.src !== 'string' || !isSafeImageSrc(v.src.trim())) return fail('bad_image', `${path}.src`)
  const src = v.src.trim()
  if (f.jpegPng && !JPEG_PNG_RE.test(src)) return fail('bad_format', `${path}.src`)
  if (!isDim(v.w) || !isDim(v.h)) return fail('bad_size', path)
  if (v.alt !== undefined && typeof v.alt !== 'string') return fail('bad_type', `${path}.alt`)
  const alt = cleanText(typeof v.alt === 'string' ? v.alt : '', false)
  if (alt.length > 200) return fail('too_long', `${path}.alt`, 200)
  if (!alt && !f.decorative) return fail('required', `${path}.alt`)
  const p: Photo = { src, alt, w: v.w, h: v.h }
  if (v.small !== undefined && v.small !== null && v.small !== '') {
    if (typeof v.small !== 'string' || !isSafeImageSrc(v.small.trim())) return fail('bad_image', `${path}.small`)
    p.small = v.small.trim()
  }
  return ok(p)
}

/** One field: type check + normalisation (trim, lower-case colours, list defaults). `def` = the default value. */
function checkField(f: FieldSpec, v: unknown, path: string, def: unknown): ContentResult<unknown> {
  switch (f.kind) {
    case 'text':
    case 'longtext': {
      if (typeof v !== 'string') return fail('bad_type', path)
      const s = cleanText(v, f.kind === 'longtext')
      const max = f.max ?? (f.kind === 'text' ? 200 : 2000)
      if (s.length > max) return fail('too_long', path, max)
      if (f.min && s.length < f.min) return fail('required', path)
      if (s && f.format === 'phone' && !PHONE_RE.test(s)) return fail('bad_phone', path)
      if (s && f.format === 'email' && !EMAIL_RE.test(s)) return fail('bad_email', path)
      if (f.rich && parseRich(s).some((p) => p.kind === 'link' && !isSafeLink(p.href))) return fail('bad_link', path)
      return ok(s)
    }
    case 'link': {
      if (typeof v !== 'string') return fail('bad_type', path)
      const s = v.trim()
      const max = f.max ?? 500
      if (s.length > max) return fail('too_long', path, max)
      if (!s) return f.min ? fail('required', path) : ok('')
      return isSafeLink(s) ? ok(s) : fail('bad_link', path)
    }
    case 'image':
      return checkImage(f, v, path)
    case 'images': {
      if (!Array.isArray(v)) return fail('bad_type', path)
      const maxItems = f.maxItems ?? 12
      if (v.length > maxItems) return fail('too_many', path, maxItems)
      if (f.minItems && v.length < f.minItems) return fail('too_few', path, f.minItems)
      const out: Photo[] = []
      for (let i = 0; i < v.length; i++) {
        const r = checkImage({ ...f, optional: false }, v[i], `${path}.${i}`)
        if (!r.ok) return r
        if (r.value) out.push(r.value)
      }
      return ok(out)
    }
    case 'list': {
      if (!Array.isArray(v)) return fail('bad_type', path)
      const defItems = (Array.isArray(def) ? def : []).filter(isObj)
      const idKey = f.item?.[0]?.key ?? 'id'
      const maxItems = f.fixed ? defItems.length : f.maxItems ?? 20
      if (v.length > maxItems) return fail('too_many', path, maxItems)
      if (f.minItems && v.length < f.minItems) return fail('too_few', path, f.minItems)
      const out: Record<string, unknown>[] = []
      for (let i = 0; i < v.length; i++) {
        const raw: unknown = v[i]
        if (!isObj(raw)) return fail('bad_type', `${path}.${i}`)
        // a property the item lacks: in a fixed list from the default item with the same id, otherwise an empty value
        const base = f.fixed ? defItems.find((d) => d[idKey] === raw[idKey]) : undefined
        const item: Record<string, unknown> = {}
        for (const sf of f.item ?? []) {
          const sv = hasOwn(raw, sf.key) ? raw[sf.key] : base && hasOwn(base, sf.key) ? clone(base[sf.key]) : emptyValue(sf)
          const r = checkField(sf, sv, `${path}.${i}.${sf.key}`, undefined)
          if (!r.ok) return r
          item[sf.key] = r.value
        }
        out.push(item)
      }
      const uniqueKey = f.fixed ? idKey : f.unique
      if (uniqueKey) {
        const seen = new Set<unknown>()
        for (let i = 0; i < out.length; i++) {
          const k = out[i]?.[uniqueKey]
          if (seen.has(k)) return fail('duplicate', `${path}.${i}.${uniqueKey}`)
          seen.add(k)
        }
        // fixed lists (home.sections): items missing from the stored list come back with their defaults, at the end
        if (f.fixed) for (const d of defItems) if (!seen.has(d[idKey])) out.push(clone(d))
      }
      return ok(out)
    }
    case 'toggle':
      return typeof v === 'boolean' ? ok(v) : fail('bad_type', path)
    case 'number': {
      if (typeof v !== 'number' || !Number.isFinite(v)) return fail('bad_type', path)
      if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) return fail('out_of_range', path)
      return ok(v)
    }
    case 'select':
      return typeof v === 'string' && (f.options ?? []).some((o) => o.value === v) ? ok(v) : fail('bad_option', path)
    case 'icon':
      return typeof v === 'string' && (SITE_ICONS as readonly string[]).includes(v) ? ok(v) : fail('bad_icon', path)
    case 'color':
      return typeof v === 'string' && COLOR_RE.test(v.trim()) ? ok(v.trim().toLowerCase()) : fail('bad_color', path)
    default:
      return fail('bad_type', path)
  }
}

/** Rules across fields of one section. */
function sectionRule(id: SectionId, v: Record<string, unknown>): ContentFailure | null {
  if (id === 'announcement') {
    if (v.enabled === true && !v.text) return fail('required', 'text')
    // a link needs both its label and its address
    if (v.link_label && !v.link_url) return fail('required', 'link_url')
    if (v.link_url && !v.link_label) return fail('required', 'link_label')
  }
  return null
}

/**
 * Validates the full value of one section (the body of PUT /v1/admin/content/:section) against the schema: types,
 * trimming, max lengths, list/image limits, link and image-src rules, colours, icons. Unknown keys are dropped; a
 * missing key takes its default. On error, `path` is the dot path inside the section (list items by index).
 */
export function validateSection<K extends SectionId>(id: K, value: unknown): ContentResult<SiteContent[K]> {
  const spec: SectionSpec | undefined = SPEC_BY_ID[id]
  if (!spec) return fail('unknown_section', '')
  if (!isObj(value)) return fail('not_object', '')
  const def: unknown = DEFAULT_CONTENT[id]
  const out = clone(def) as Record<string, unknown>
  for (const f of sectionFields(spec)) {
    const raw = getPath(value, f.key)
    if (raw === undefined) continue
    const r = checkField(f, raw, f.key, getPath(def, f.key))
    if (!r.ok) return r
    setPath(out, f.key, r.value)
  }
  const bad = sectionRule(id, out)
  if (bad) return bad
  return ok(out as unknown as SiteContent[K])
}

/**
 * Defaults ⊕ stored overrides ({ [section]: value }), checked field by field: objects merge per key, lists and photo
 * lists replace as a whole, a stored value of the wrong type falls back to the default, unknown keys are dropped.
 * Never throws; mergeContent(undefined) is a fresh copy of DEFAULT_CONTENT.
 */
export function mergeContent(stored: unknown): SiteContent {
  const out = clone(DEFAULT_CONTENT)
  if (!isObj(stored)) return out
  for (const spec of CONTENT_SECTIONS) {
    const s = stored[spec.id]
    if (!isObj(s)) continue
    const def: unknown = DEFAULT_CONTENT[spec.id]
    const sec = out[spec.id] as unknown as Record<string, unknown>
    for (const f of sectionFields(spec)) {
      const raw = getPath(s, f.key)
      if (raw === undefined) continue
      const r = checkField(f, raw, f.key, getPath(def, f.key))
      if (r.ok) setPath(sec, f.key, r.value)
    }
    if (sectionRule(spec.id, sec)) (out as unknown as Record<string, unknown>)[spec.id] = clone(def)
  }
  return out
}

/** Every uploaded picture (/media/…) the content uses — a media row in this list must not be deleted. */
export function contentMediaSrcs(content: unknown): string[] {
  const found = new Set<string>()
  const walk = (v: unknown): void => {
    if (typeof v === 'string') { if (v.startsWith('/media/')) found.add(v); return }
    if (Array.isArray(v)) { v.forEach(walk); return }
    if (isObj(v)) for (const k of Object.keys(v)) walk(v[k])
  }
  walk(content)
  return [...found]
}
