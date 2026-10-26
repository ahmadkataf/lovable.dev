// Focus Point — the site content contract, shared by api/ and web/ (pure TypeScript: no imports, no DOM, no Node).
//
// The admin edits every customer-visible text, image and link of the website (and the Android app, which shows the
// same site) from the team panel › «الموقع». The API stores only the sections the admin saved; everything else comes
// from DEFAULT_CONTENT, which is today's site, word for word. See docs/cms/DESIGN.md.
//
// Text conventions
// - {placeholders} are filled with live data by fillTemplate() (names and meanings: TEMPLATE_VARS). Unknown ones stay
//   as typed, so a typo is visible instead of silently vanishing.
// - Fields marked `rich` may contain **emphasis** (brand colour in headings, bold in body text) and [label](link).
//   Render with parseRich() first, then fillTemplate() each part, so live data can never inject a link.
// - Wording that depends on settings.allow_pay_on_arrival comes in pairs: the plain field (text, a, title, …) shows
//   while pay-on-arrival is ON; the `…_shamcash_only` field shows while it is OFF ('' = use the plain field).
// - Empty optional texts and links ('') hide the element they feed.

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

// ---------- the content model ----------

/** A picture on the site. */
export interface Photo {
  src: string          // '/img/…' (shipped with the site) or '/media/<id>.webp' (uploaded from the editor)
  alt: string          // what the photo shows (screen readers; also the gallery caption)
  w: number; h: number // pixel size of src (the page reserves the space; `small` keeps the same ratio)
  small?: string       // optional ≤720 px variant for grids and cards (same rules as src)
}

export type HomeSectionId = 'hero' | 'facts' | 'features' | 'spaces' | 'how' | 'gallery' | 'visit' | 'faq' | 'cta'
export const HOME_SECTION_IDS: readonly HomeSectionId[] = ['hero', 'facts', 'features', 'spaces', 'how', 'gallery', 'visit', 'faq', 'cta']
export type SpaceGroupId = 'private' | 'meeting' | 'open'
export type AnnouncementTone = 'info' | 'success' | 'warning'

/** One landing section in display order; tint = grey band behind it (ignored by hero, facts and cta). */
export interface HomeSectionRef { id: HomeSectionId; visible: boolean; tint: boolean }
export interface IconCard { icon: SiteIconName; title: string; text: string }
export interface HeroChip { icon: SiteIconName; text: string; text_shamcash_only: string }
export interface FactItem { icon: SiteIconName; value: string; label: string }
export interface HowStep { icon: SiteIconName; title: string; title_shamcash_only: string; text: string; text_shamcash_only: string }
export interface FaqItem { q: string; a: string; a_shamcash_only: string }
export interface TextItem { text: string }
/** A public space group (rooms are grouped by type: private → private, meeting/hall → meeting, desk → open). */
export interface SpaceGroupText {
  title: string; blurb: string
  cap: string                // capacity line shown only while the rooms are not loaded (live rooms win)
  icon: SiteIconName
  photo: Photo | null        // null → the drawn placeholder; a room's own photos win on the room cards
}
export interface MessageText { title: string; body: string }

export interface SiteContent {
  brand: {
    name_latin: string       // wordmark next to the logo (header, menu, footer)
    subtitle: string         // small line under the wordmark
    eyebrow: string          // «المشروع الأول من نوعه بدرعا» — hero pill; {eyebrow} in other texts
    slogan: string           // {slogan} in other texts
    whatsapp: string         // WhatsApp number; '' = the centre phone (settings.phone)
    email: string            // '' = hidden
    maps_url: string         // exact map link; '' = a Google Maps search for settings.address
    facebook_url: string     // '' = hidden
    tiktok_url: string       // '' = hidden
    play_url: string         // Google Play link of the Android app; '' = hidden
  }
  announcement: { enabled: boolean; text: string; link_label: string; link_url: string; tone: AnnouncementTone }
  home: {
    sections: HomeSectionRef[]
    hero: { title: string; lead: string; chips: HeroChip[]; photo: Photo; badge_icon: SiteIconName; badge_title: string; badge_text: string }
    facts: { items: FactItem[] }
    features: { kicker: string; title: string; lead: string; items: IconCard[] }
    spaces: { kicker: string; title: string; lead: string }
    how: { kicker: string; title: string; steps: HowStep[] }
    gallery: { kicker: string; title: string; lead: string; photos: Photo[]; quote: string }
    visit: { kicker: string; title: string; lead: string; hours_title: string; hours_line: string; address_title: string }
    faq: { kicker: string; title: string; lead: string; items: FaqItem[] }
    cta: { title: string; text: string; text_shamcash_only: string }   // also the CTA band of /about
  }
  spaces: {
    kicker: string; title: string; lead: string
    groups: Record<SpaceGroupId, SpaceGroupText>
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
    intro_title: string; intro_hours: string; intro_fallback: string
    closed_title: string; closed_text: string
    method_shamcash: string; method_cash: string; method_hint_shamcash: string; method_hint_cash: string
    note_shamcash: string; note_cash: string
    pay_title: string; pay_held_until: string; pay_steps: TextItem[]; pay_expired_title: string; pay_expired_text: string
    cash_awaiting_title: string; cash_awaiting_text: string
    verifying_title: string; verifying_text: string
    confirmed_title: string
    rejected_title: string; rejected_text: string
    expired_title: string; expired_text: string
    cancelled_title: string; cancelled_text: string
    completed_title: string; completed_text: string
    cancel_note: string; cancel_note_paid: string
    notify_prompt: string; notify_prompt_mine: string
    install_title: string; install_text: string
  }
  messages: {
    booking_created: MessageText                                // → team
    payment_submitted: MessageText & { body_cash: string }      // → team; body_cash for pay-on-arrival bookings
    booking_confirmed: MessageText                              // → customer
    booking_rejected: MessageText                               // → customer
    booking_expired: MessageText                                // → customer
    booking_cancelled: MessageText                              // → customer (team cancel)
    booking_reminder: MessageText                               // → customer, before the start
    team_whatsapp: string                                       // pre-filled WhatsApp text the team sends a customer
  }
  seo: {
    title: string; description: string; ld_description: string
    site_name: string; og_title: string; og_description: string; og_image: Photo
    pages: { home: string; spaces: string; about: string; contact: string; book: string }   // '' = seo.title
    app_name: string; app_short_name: string; app_description: string
  }
  theme: { brand: string }
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

export const DEFAULT_CONTENT: SiteContent = {
  brand: {
    name_latin: 'Focus Point',
    subtitle: 'فوكس بوينت · درعا',
    eyebrow: 'المشروع الأول من نوعه بدرعا',
    slogan: 'مساحتك وركنك الهادئ للإبداع',
    whatsapp: '',
    email: '',
    maps_url: '',
    facebook_url: '',
    tiktok_url: '',
    play_url: '',
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
        { icon: 'clock', text: 'يومياً {hours}', text_shamcash_only: '' },
        { icon: 'wifi', text: 'إنترنت سريع', text_shamcash_only: '' },
        { icon: 'wallet', text: 'الدفع بشام كاش أو عند الوصول', text_shamcash_only: 'الدفع بشام كاش' },
      ],
      photo: photo(IMG.meeting),
      badge_icon: 'present',
      badge_title: 'قاعة اجتماعات لعشرة أشخاص',
      badge_text: 'شاشة + سبورة',
    },
    facts: {
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
        { icon: 'calendar', title: 'اختار المساحة والوقت', title_shamcash_only: '', text: 'شوف المخطط والغرف الفاضية، واختار اليوم والساعة والمدة اللي بدك ياها.', text_shamcash_only: '' },
        { icon: 'user', title: 'اكتب اسمك ورقمك', title_shamcash_only: '', text: 'بدون حساب وبدون كلمة سر. اسمك ورقم موبايلك بيكفّوا.', text_shamcash_only: '' },
        {
          icon: 'check',
          title: 'ادفع بشام كاش أو عند الوصول',
          title_shamcash_only: 'ادفع بشام كاش',
          text: 'حوّل بشام كاش واكتب رقم العملية، أو اختار الدفع عند الوصول. ويوصلك التأكيد بإشعار.',
          text_shamcash_only: 'حوّل بشام كاش (رمز QR أو الرقم) واكتب رقم العملية، ويوصلك التأكيد بإشعار.',
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
        { q: 'هل لازم أعمل حساب لأحجز؟', a: 'لا. بتختار المساحة والوقت، وبتكتب اسمك ورقم موبايلك، وبس. التطبيق بيتذكّر حجوزاتك على جهازك، وفيك تلاقي أي حجز برمزه ورقمك من صفحة «حجوزاتي».', a_shamcash_only: '' },
        {
          q: 'كيف بدفع؟',
          a: 'بتحويل شام كاش: بتمسح الرمز أو بتحوّل عالرقم، وبتكتب رقم العملية بالتطبيق، والفريق بيأكّد حجزك. أو بتختار «الدفع عند الوصول» وبتدفع بالمركز لما توصل.',
          a_shamcash_only: 'بتحويل شام كاش: بتمسح الرمز أو بتحوّل عالرقم، وبتكتب رقم العملية بالتطبيق، والفريق بيأكّد حجزك ويوصلك إشعار.',
        },
        { q: 'فيني ألغي الحجز؟', a: 'قبل ما يتأكد الحجز، فيك تلغيه بنفسك من التطبيق (صفحة [حجوزاتي](/mine)). بعد التأكيد، تواصل معنا على {phone} أو عالواتساب ومنساعدك.', a_shamcash_only: '' },
        { q: 'شو الدوام؟', a: 'مفتوحين كل يوم، من {open} لـ{close}.', a_shamcash_only: '' },
        { q: 'فيني أحجز لفريق كامل؟', a: 'أكيد. قاعة الاجتماعات بتساع لـ{meetingCapacity} أشخاص وفيها شاشة وسبورة، وفي كمان غرف خاصة من {privateMin} لـ{privateMax} أشخاص. [شوف المساحات](/spaces).', a_shamcash_only: '' },
        { q: 'وين المكان؟', a: '{address}. إذا ضعت، اتصل فينا أو ابعتلنا عالواتساب ومنوصفلك الطريق.', a_shamcash_only: '' },
      ],
    },
    cta: {
      title: 'جاهز تبدأ؟ احجز مكانك هلأ',
      text: 'اختار المساحة والوقت، اكتب اسمك ورقمك، وادفع بشام كاش أو عند وصولك. بدون حساب وبدون تعقيد.',
      text_shamcash_only: '',
    },
  },
  spaces: {
    kicker: 'المساحات',
    title: 'مساحة لكل نوع شغل',
    lead: 'غرف خاصة من {privateMin} لـ{privateMax} أشخاص، قاعة اجتماعات لـ{meetingCapacity} مع شاشة وسبورة، ومساحة مفتوحة مشتركة لـ{openCapacity}. الأسعار هون هي نفسها اللي بتشوفها وقت الحجز.',
    groups: {
      private: { title: 'غرف خاصة', blurb: 'غرفة إلك لحالك أو مع فريقك الصغير، بابها بيتسكّر وبتشتغل فيها على راحتك.', cap: '2–4 أشخاص', icon: 'door', photo: null },
      meeting: { title: 'قاعة الاجتماعات', blurb: 'قاعة لـ{meetingCapacity} أشخاص فيها شاشة وسبورة، للاجتماعات والدورات والعروض.', cap: 'حتى 10 أشخاص', icon: 'present', photo: photo(IMG.meeting) },
      open: { title: 'المساحة المفتوحة', blurb: 'مكان مشترك لـ{openCapacity} أشخاص، ضوء طبيعي وجو بيشجّع عالشغل.', cap: 'حتى 8 أشخاص', icon: 'grid', photo: photo(IMG.bigWide) },
    },
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
    // new: shown while settings.booking_enabled is false (no such page today)
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
    cancelled_title: 'الحجز ملغى',
    cancelled_text: 'تم إلغاء هذا الحجز.',
    completed_title: 'شكراً لزيارتك',
    completed_text: 'نتمنى أن تكون قد أنجزت ما خططت له.',
    cancel_note: 'سيعود المكان متاحاً للآخرين.',
    cancel_note_paid: 'إذا كنت قد حوّلت المبلغ، تواصل معنا لاسترجاعه.',
    notify_prompt: 'خبّرك أول ما يتأكد حجزك، ونذكّرك قبله بساعة.',
    notify_prompt_mine: 'نخبرك بتأكيد الحجز ونذكّرك قبله بساعة.',
    install_title: 'ثبّت فوكس بوينت على جهازك',
    install_text: 'يفتح كتطبيق، أسرع، ويشتغل حتى بدون إنترنت.',
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
    booking_expired: { title: 'انتهت مهلة الحجز', body: 'لم يصلنا رقم عملية الدفع لحجز {room} · {when}. يمكنك الحجز من جديد.' },
    booking_cancelled: { title: 'تم إلغاء حجزك', body: '{room} · {when}. تواصل معنا على {phone} لأي استفسار.' },
    booking_reminder: { title: 'حجزك بعد ساعة', body: '{room} · {when} · الرمز {code}. ننتظرك!' },
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
  theme: { brand: '#7b1e2e' },
}

// ---------- placeholders ----------

/** Every {placeholder} a text may use → what it becomes (Arabic, for the editor's chips). */
export const TEMPLATE_VARS: Record<string, string> = {
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
  meetingCapacity: 'كم شخص بتساع قاعة الاجتماعات',
  openCapacity: 'كم شخص بتساع المساحة المفتوحة',
  slogan: 'الشعار (من «الهوية والتواصل»)',
  eyebrow: 'الجملة المميّزة (من «الهوية والتواصل»)',
  holdMinutes: 'مهلة الدفع بالدقايق',
  customer_name: 'اسم الزبون',
  room: 'اسم الغرفة',
  when: 'اليوم والوقت، مثل «الجمعة 24/10 · 10:00–12:00»',
  price: 'المبلغ مع العملة، مثل «15,000 ل.س»',
  code: 'رمز الحجز',
  ref: 'رقم عملية شام كاش',
  reason: 'سبب الرفض اللي كتبه الفريق',
  time: 'آخر وقت للدفع، مثل «10:30 م»',
}

/** Sample values (today's defaults) for the editor preview, and fallbacks while live data is loading. */
export const TEMPLATE_EXAMPLE: Record<string, string> = {
  name: 'فوكس بوينت', phone: '0985258963', address: 'درعا، شارع المجمع الحكومي – بناء العايش', instagram: 'its_focus_point',
  hours: '9 ص – 11 م', open: '9 ص', close: '11 م', hoursPerDay: '14',
  privateCount: '4', privateMin: '2', privateMax: '4', meetingCapacity: '10', openCapacity: '8',
  slogan: 'مساحتك وركنك الهادئ للإبداع', eyebrow: 'المشروع الأول من نوعه بدرعا', holdMinutes: '30',
  customer_name: 'أحمد', room: 'قاعة الاجتماعات', when: 'الجمعة 24/10 · 10:00–12:00', price: '40,000 ل.س',
  code: 'A7K2QZ', ref: '123456789', reason: 'لم يصل المبلغ', time: '10:30 م',
}

/** "{name}" → vars.name. Unknown placeholders are kept as typed. */
export function fillTemplate(t: string, vars: Record<string, string | number>): string {
  return t.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)
}

/** The {placeholders} a text uses, in order, without duplicates. */
export function templateKeys(t: string): string[] {
  const out: string[] = []
  for (const m of t.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) if (m[1] && !out.includes(m[1])) out.push(m[1])
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
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

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
  fixed?: boolean              // list: the items are fixed (reorder and edit only, no add/remove)
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

const HOURS_VARS = ['hours', 'open', 'close', 'hoursPerDay']
const ROOM_VARS = ['privateCount', 'privateMin', 'privateMax', 'meetingCapacity', 'openCapacity']
/** Live data any site text may show. */
const SITE_VARS = ['name', 'phone', 'address', 'instagram', ...HOURS_VARS, ...ROOM_VARS, 'slogan', 'eyebrow']
const P = { placeholders: SITE_VARS }
const SHAM_ONLY = 'لما «الدفع عند الوصول» يكون مطفي بالإعدادات. فاضي = نفس النص'

/** kicker / title / lead of a section heading. */
const head = (prefix: string, o: { lead?: boolean; titleRich?: boolean; leadRich?: boolean } = {}): FieldSpec[] => [
  text(`${prefix}kicker`, 'السطر الصغير', { help: 'بيطلع فوق العنوان بخط صغير. فاضي = ما بيطلع', max: 60, ...P }),
  text(`${prefix}title`, 'العنوان', { max: 120, ...P, ...(o.titleRich ? { rich: true, help: 'الكلام بين **نجمتين** بيطلع بلون المركز' } : {}) }),
  ...(o.lead === false ? [] : [long(`${prefix}lead`, 'الوصف', { max: 400, ...P, ...(o.leadRich ? { rich: true, help: 'رابط: [النص](/contact)' } : {}) })]),
]
const iconCards = (key: string, label: string, maxItems: number): FieldSpec =>
  list(key, label, [icon('icon'), text('title', 'العنوان', { min: 1, max: 80, ...P }), long('text', 'النص', { max: 300, ...P })], { maxItems })
const msg = (key: string, label: string, vars: string[], help: string, extra: FieldSpec[] = []): FieldGroup => ({
  title: label,
  help,
  fields: [
    text(`${key}.title`, 'العنوان', { min: 1, max: 80, placeholders: vars }),
    long(`${key}.body`, 'النص', { min: 1, max: 500, placeholders: vars }),
    ...extra,
  ],
})
const BOOKING_MSG_VARS = ['room', 'when', 'code']
const groupFields = (id: SpaceGroupId): FieldSpec[] => [
  text(`groups.${id}.title`, 'الاسم', { min: 1, max: 60 }),
  long(`groups.${id}.blurb`, 'الوصف', { max: 300, ...P }),
  text(`groups.${id}.cap`, 'عدد الأشخاص (احتياطي)', { max: 40, help: 'بيطلع بس إذا ما تحمّلت الغرف. العدد الحقيقي بيتحسب من القاعات' }),
  icon(`groups.${id}.icon`),
  image(`groups.${id}.photo`, 'الصورة', { optional: true, help: 'بتطلع على كرت المساحة. بلا صورة = رسمة بسيطة. صور كل غرفة بتنحط من القاعات' }),
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
  section('brand', 'الهوية والتواصل', 'الاسم بالإنكليزي والشعار وروابط التواصل. اسم المركز ورقمه وعنوانه وإنستغرام والدوام بيتعدّلوا من الإعدادات › المركز.', 'award', '/', [
    {
      title: 'الاسم والشعار',
      fields: [
        text('name_latin', 'الاسم بالإنكليزي', { min: 1, max: 40, help: 'بيطلع جنب اللوغو فوق وتحت بالموقع' }),
        text('subtitle', 'السطر تحت الاسم', { max: 60, help: 'تحت الاسم الإنكليزي بالهيدر والفوتر' }),
        text('eyebrow', 'الجملة المميّزة', { max: 80, help: 'بأول الصفحة الرئيسية. بتقدر تحطها بأي نص كـ {eyebrow}' }),
        text('slogan', 'الشعار', { max: 80, help: 'بصفحة من نحن والفوتر. بتقدر تحطه بأي نص كـ {slogan}' }),
      ],
    },
    {
      title: 'التواصل والروابط',
      help: 'الرابط الفاضي ما بيطلع بالموقع.',
      fields: [
        text('whatsapp', 'رقم الواتساب', { max: 20, format: 'phone', help: 'فاضي = نفس رقم المركز. مثال: \u200e+963985258963' }),
        text('email', 'الإيميل', { max: 120, format: 'email' }),
        link('maps_url', 'رابط المكان على الخريطة', { help: 'فاضي = بحث عن العنوان بخرائط Google. الأحسن تحط رابط المكان الدقيق' }),
        link('facebook_url', 'رابط فيسبوك'),
        link('tiktok_url', 'رابط تيك توك'),
        link('play_url', 'رابط التطبيق على Google Play'),
      ],
    },
  ], ['centre_name', 'phone', 'address', 'instagram', 'open', 'close']),

  section('announcement', 'شريط الإعلان', 'شريط صغير فوق الموقع وصفحات الحجز، لخبر أو عرض أو عطلة.', 'bell', '/', [
    {
      title: 'الإعلان',
      fields: [
        toggle('enabled', 'إظهار الإعلان'),
        text('text', 'نص الإعلان', { max: 160, ...P, help: 'لازم يكون في نص إذا الإعلان ظاهر' }),
        select('tone', 'اللون', [
          { value: 'info', label: 'معلومة (أزرق)' },
          { value: 'success', label: 'خبر حلو (أخضر)' },
          { value: 'warning', label: 'تنبيه (برتقالي)' },
        ]),
        text('link_label', 'نص الرابط', { max: 40, help: 'اختياري، مثل «احجز هلأ»' }),
        link('link_url', 'الرابط', { help: 'اختياري. مثال: /book' }),
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
        long('hero.lead', 'الوصف', { max: 400, ...P }),
        list('hero.chips', 'المعلومات السريعة', [
          icon('icon'),
          text('text', 'النص', { min: 1, max: 60, ...P }),
          text('text_shamcash_only', 'النص بلا الدفع عند الوصول', { max: 60, ...P, help: SHAM_ONLY }),
        ], { maxItems: 4, help: 'سطور صغيرة تحت الأزرار' }),
        image('hero.photo', 'الصورة'),
        icon('hero.badge_icon', 'أيقونة الشارة'),
        text('hero.badge_title', 'الشارة: السطر الأول', { max: 60, ...P, help: 'الشارة فوق الصورة. فاضي = ما بتطلع' }),
        text('hero.badge_text', 'الشارة: السطر الثاني', { max: 60, ...P }),
      ],
    },
    {
      title: 'شريط الأرقام',
      help: 'الشريط تحت الواجهة: رقم أو معلومة كبيرة وتحتها سطر صغير.',
      fields: [
        list('facts.items', 'المعلومات', [
          icon('icon'),
          text('value', 'المعلومة', { min: 1, max: 60, ...P }),
          text('label', 'السطر الصغير', { max: 80, ...P }),
        ], { maxItems: 4 }),
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
        ...head('how.', { lead: false }),
        list('how.steps', 'الخطوات', [
          icon('icon'),
          text('title', 'العنوان', { min: 1, max: 80, ...P }),
          text('title_shamcash_only', 'العنوان بلا الدفع عند الوصول', { max: 80, ...P, help: SHAM_ONLY }),
          long('text', 'النص', { max: 300, ...P }),
          long('text_shamcash_only', 'النص بلا الدفع عند الوصول', { max: 300, ...P, help: SHAM_ONLY }),
        ], { maxItems: 6, minItems: 1, help: 'الرقم جنب كل خطوة بيتحط لحاله' }),
      ],
    },
    {
      title: 'معرض الصور',
      preview: '/#gallery',
      help: 'نفس الصور بتطلع بصفحة من نحن.',
      fields: [
        ...head('gallery.'),
        images('gallery.photos', 'الصور', { maxItems: 12 }),
        long('gallery.quote', 'المربع المكتوب', { max: 60, help: 'مربع بلون المركز بين الصور. كل سطر بسطر. فاضي = ما بيطلع' }),
      ],
    },
    {
      title: 'الدوام والعنوان',
      preview: '/#visit',
      fields: [
        ...head('visit.'),
        text('visit.hours_title', 'عنوان كرت الدوام', { max: 60 }),
        text('visit.hours_line', 'سطر الدوام', { max: 120, ...P }),
        text('visit.address_title', 'عنوان كرت العنوان', { max: 60 }),
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
        ]),
      ],
    },
    {
      title: 'دعوة للحجز',
      help: 'الشريط الملوّن آخر الصفحة. بيطلع كمان بصفحة من نحن.',
      fields: [
        text('cta.title', 'العنوان', { min: 1, max: 120, ...P }),
        long('cta.text', 'النص', { max: 300, ...P }),
        long('cta.text_shamcash_only', 'النص بلا الدفع عند الوصول', { max: 300, ...P, help: SHAM_ONLY }),
      ],
    },
  ]),

  section('spaces', 'صفحة المساحات', 'رأس صفحة المساحات، والاسم والوصف والصورة لكل نوع مساحة (بيطلعوا كمان بالصفحة الرئيسية). الغرف وأسعارها من القاعات.', 'grid', '/spaces', [
    { title: 'رأس الصفحة', fields: head('') },
    { title: 'غرف خاصة', preview: '/spaces#sp-private', fields: groupFields('private') },
    { title: 'قاعة الاجتماعات', preview: '/spaces#sp-meeting', fields: groupFields('meeting') },
    { title: 'المساحة المفتوحة', preview: '/spaces#sp-open', fields: groupFields('open') },
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
    { title: 'لمين المركز', fields: [...head('audience.', { lead: false }), iconCards('audience.items', 'الفئات', 8)] },
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
      fields: [
        text('hours.title', 'العنوان', { max: 60 }),
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
        text('intro_fallback', 'السطر قبل ما تتحمّل البيانات', { max: 120, ...P }),
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
      help: 'الاختيار بيطلع بس إذا «الدفع عند الوصول» مفعّل.',
      fields: [
        text('method_shamcash', 'اسم خيار شام كاش', { min: 1, max: 40 }),
        text('method_cash', 'اسم خيار الدفع عند الوصول', { min: 1, max: 40 }),
        text('method_hint_shamcash', 'شرح شام كاش', { max: 200, ...P }),
        text('method_hint_cash', 'شرح الدفع عند الوصول', { max: 200, ...P }),
        text('note_shamcash', 'ملاحظة تحت الزر (شام كاش)', { max: 200, placeholders: [...SITE_VARS, 'holdMinutes'] }),
        text('note_cash', 'ملاحظة تحت الزر (عند الوصول)', { max: 200, ...P }),
      ],
    },
    {
      title: 'الدفع بشام كاش',
      fields: [
        text('pay_title', 'العنوان', { min: 1, max: 80 }),
        text('pay_held_until', 'سطر المهلة', { max: 160, placeholders: [...SITE_VARS, 'time', 'holdMinutes'] }),
        list('pay_steps', 'الخطوات', [text('text', 'الخطوة', { min: 1, max: 200, placeholders: [...SITE_VARS, 'code'] })], { maxItems: 6, help: '{code} بيطلع عريض' }),
        text('pay_expired_title', 'عنوان انتهاء المهلة', { max: 80 }),
        long('pay_expired_text', 'نص انتهاء المهلة', { max: 400, placeholders: [...SITE_VARS, 'code'] }),
      ],
    },
    {
      title: 'حالة الحجز',
      help: 'صفحة الحجز اللي بيتابع منها الزبون.',
      fields: [
        text('cash_awaiting_title', 'بانتظار الفريق (عند الوصول): العنوان', { max: 80 }),
        long('cash_awaiting_text', 'بانتظار الفريق (عند الوصول): النص', { max: 400, ...P }),
        text('verifying_title', 'عم نتحقق من الدفع: العنوان', { max: 80 }),
        long('verifying_text', 'عم نتحقق من الدفع: النص', { max: 400, placeholders: [...SITE_VARS, 'ref'] }),
        text('confirmed_title', 'مؤكد: العنوان', { max: 80 }),
        text('rejected_title', 'مرفوض: العنوان', { max: 80 }),
        long('rejected_text', 'مرفوض: النص', { max: 400, ...P, help: 'بيطلع إذا الفريق ما كتب سبب' }),
        text('expired_title', 'انتهت المهلة: العنوان', { max: 80 }),
        long('expired_text', 'انتهت المهلة: النص', { max: 400, ...P }),
        text('cancelled_title', 'ملغى: العنوان', { max: 80 }),
        long('cancelled_text', 'ملغى: النص', { max: 400, ...P }),
        text('completed_title', 'انتهى: العنوان', { max: 80 }),
        long('completed_text', 'انتهى: النص', { max: 400, ...P }),
      ],
    },
    {
      title: 'إلغاء الحجز',
      fields: [
        text('cancel_note', 'سؤال التأكيد', { max: 200, ...P }),
        text('cancel_note_paid', 'إضافة إذا كان محوّل المبلغ', { max: 200, ...P }),
      ],
    },
    {
      title: 'الإشعارات والتطبيق',
      fields: [
        text('notify_prompt', 'دعوة الإشعارات (بعد الحجز)', { max: 200, ...P }),
        text('notify_prompt_mine', 'دعوة الإشعارات (حجوزاتي)', { max: 200, ...P }),
        text('install_title', 'تثبيت التطبيق: العنوان', { max: 80, ...P }),
        text('install_text', 'تثبيت التطبيق: النص', { max: 200, ...P }),
      ],
    },
  ], ['booking_enabled', 'booking_closed_message', 'shamcash_enabled', 'allow_pay_on_arrival', 'booking_horizon_days', 'hold_minutes', 'reminder_minutes', 'max_open_holds_per_phone', 'customer_can_cancel', 'payment_instructions']),

  section('messages', 'رسائل الإشعارات', 'الإشعارات اللي بتوصل للزبون وللفريق بشكل تلقائي، ورسالة الواتساب من لوحة الفريق.', 'send', undefined, [
    msg('booking_created', 'حجز جديد (للفريق)', ['customer_name', ...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للفريق لما زبون يحجز.'),
    msg('payment_submitted', 'دفعة بانتظار التحقق (للفريق)', ['customer_name', ...BOOKING_MSG_VARS, 'price', 'ref', 'phone', 'name'], 'بيوصل للفريق لما الزبون يبعت رقم العملية، أو يحجز بالدفع عند الوصول.', [
      long('payment_submitted.body_cash', 'النص للدفع عند الوصول', { min: 1, max: 500, placeholders: ['customer_name', ...BOOKING_MSG_VARS, 'price', 'phone', 'name'] }),
    ]),
    msg('booking_confirmed', 'تأكيد الحجز (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للزبون لما الفريق يأكّد.'),
    msg('booking_rejected', 'رفض الدفع (للزبون)', [...BOOKING_MSG_VARS, 'reason', 'price', 'phone', 'name'], 'بيوصل للزبون لما الفريق يرفض الدفع.'),
    msg('booking_expired', 'انتهاء المهلة (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للزبون لما تخلص مهلة الدفع.'),
    msg('booking_cancelled', 'إلغاء من الفريق (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للزبون لما الفريق يلغي حجزه.'),
    msg('booking_reminder', 'التذكير قبل الحجز (للزبون)', [...BOOKING_MSG_VARS, 'price', 'phone', 'name'], 'بيوصل للزبون قبل موعده (المدة من الإعدادات).'),
    {
      title: 'رسالة الواتساب من الفريق',
      help: 'النص اللي بينكتب لحاله لما حدا من الفريق يضغط «واتساب» بصفحة الحجز.',
      fields: [long('team_whatsapp', 'الرسالة', { min: 1, max: 500, placeholders: ['customer_name', ...BOOKING_MSG_VARS, 'name'] })],
    },
  ]),

  section('seo', 'محركات البحث والمشاركة', 'شو بيطلع بـ Google، وبالمعاينة لما حدا يشارك رابط الموقع على واتساب أو فيسبوك، واسم التطبيق.', 'search', '/', [
    {
      title: 'نتائج البحث',
      fields: [
        text('title', 'عنوان الموقع', { min: 1, max: 120, placeholders: ['name', 'slogan', 'eyebrow'], help: 'اسم التبويب ونتيجة Google' }),
        long('description', 'الوصف', { max: 300, placeholders: ['name', 'address', 'phone', ...HOURS_VARS, 'slogan', 'eyebrow'], help: 'تحت العنوان بنتائج Google. الأحسن بين 120 و160 حرف' }),
        long('ld_description', 'الوصف لـ Google (بيانات المركز)', { max: 300, placeholders: ['name', 'address', 'slogan', 'eyebrow'] }),
      ],
    },
    {
      title: 'المشاركة على واتساب وفيسبوك',
      fields: [
        text('site_name', 'اسم الموقع', { min: 1, max: 80, placeholders: ['name'] }),
        text('og_title', 'العنوان', { min: 1, max: 120, placeholders: ['name', 'slogan', 'eyebrow'] }),
        long('og_description', 'الوصف', { max: 300, placeholders: ['name', 'address', ...HOURS_VARS, 'slogan', 'eyebrow'] }),
        image('og_image', 'الصورة', { help: 'الأحسن 1200×630' }),
      ],
    },
    {
      title: 'عناوين الصفحات',
      help: 'اسم التبويب لكل صفحة. فاضي = عنوان الموقع.',
      fields: [
        text('pages.home', 'الصفحة الرئيسية', { max: 120, placeholders: ['name', 'slogan', 'eyebrow'], preview: '/' }),
        text('pages.spaces', 'المساحات', { max: 120, placeholders: ['name', 'slogan', 'eyebrow'], preview: '/spaces' }),
        text('pages.about', 'من نحن', { max: 120, placeholders: ['name', 'slogan', 'eyebrow'], preview: '/about' }),
        text('pages.contact', 'تواصل معنا', { max: 120, placeholders: ['name', 'slogan', 'eyebrow'], preview: '/contact' }),
        text('pages.book', 'الحجز', { max: 120, placeholders: ['name', 'slogan', 'eyebrow'], preview: '/book' }),
      ],
    },
    {
      title: 'التطبيق',
      help: 'اسم الموقع لما ينضاف للشاشة الرئيسية. تطبيق Android اسمه ثابت بالمتجر.',
      fields: [
        text('app_name', 'اسم التطبيق', { min: 1, max: 45 }),
        text('app_short_name', 'الاسم القصير', { min: 1, max: 12, help: 'تحت الأيقونة. 12 حرف أو أقل' }),
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
  | 'unknown_section' | 'not_object' | 'bad_type' | 'required' | 'too_long' | 'bad_link' | 'bad_image' | 'bad_size'
  | 'too_many' | 'too_few' | 'duplicate' | 'bad_option' | 'bad_icon' | 'bad_color' | 'out_of_range' | 'bad_phone' | 'bad_email'

const ERROR_TEXT: Record<ContentErrorCode, string> = {
  unknown_section: 'قسم غير معروف',
  not_object: 'بيانات القسم غير صحيحة',
  bad_type: 'نوع القيمة غير صحيح',
  required: 'هالحقل مطلوب',
  too_long: 'النص أطول من المسموح',
  bad_link: 'الرابط لازم يبدأ بـ https:// أو / أو tel: أو mailto:',
  bad_image: 'الصورة لازم تكون من صور الموقع (/img/ أو /media/)',
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
    if (!isObj(cur) || !Object.prototype.hasOwnProperty.call(cur, k)) return undefined
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

function emptyValue(f: FieldSpec): unknown {
  switch (f.kind) {
    case 'toggle': return false
    case 'number': return f.min ?? 0
    case 'select': return f.options?.[0]?.value ?? ''
    case 'image': return null
    case 'images': case 'list': return []
    default: return ''
  }
}

function checkImage(f: FieldSpec, v: unknown, path: string): ContentResult<Photo | null> {
  if (v === null && f.optional) return ok(null)
  if (!isObj(v)) return fail(v === null || v === undefined ? 'required' : 'bad_type', path)
  if (typeof v.src !== 'string' || !isSafeImageSrc(v.src.trim())) return fail('bad_image', `${path}.src`)
  if (v.alt !== undefined && typeof v.alt !== 'string') return fail('bad_type', `${path}.alt`)
  const alt = cleanText(typeof v.alt === 'string' ? v.alt : '', false)
  if (alt.length > 200) return fail('too_long', `${path}.alt`, 200)
  if (!isDim(v.w) || !isDim(v.h)) return fail('bad_size', path)
  const p: Photo = { src: v.src.trim(), alt, w: v.w, h: v.h }
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
      const defItems = Array.isArray(def) ? def : []
      const maxItems = f.fixed ? defItems.length : f.maxItems ?? 20
      if (v.length > maxItems) return fail('too_many', path, maxItems)
      if (f.minItems && v.length < f.minItems) return fail('too_few', path, f.minItems)
      const out: Record<string, unknown>[] = []
      for (let i = 0; i < v.length; i++) {
        const raw: unknown = v[i]
        if (!isObj(raw)) return fail('bad_type', `${path}.${i}`)
        const item: Record<string, unknown> = {}
        for (const sf of f.item ?? []) {
          const sv = Object.prototype.hasOwnProperty.call(raw, sf.key) ? raw[sf.key] : emptyValue(sf)
          const r = checkField(sf, sv, `${path}.${i}.${sf.key}`, undefined)
          if (!r.ok) return r
          item[sf.key] = r.value
        }
        out.push(item)
      }
      if (f.fixed) {
        // fixed lists (home.sections): each item at most once; items missing from the stored list come back with their defaults
        const idKey = f.item?.[0]?.key ?? 'id'
        const seen = new Set<unknown>()
        for (let i = 0; i < out.length; i++) {
          const id = out[i]?.[idKey]
          if (seen.has(id)) return fail('duplicate', `${path}.${i}.${idKey}`)
          seen.add(id)
        }
        for (const d of defItems) if (isObj(d) && !seen.has(d[idKey])) out.push(clone(d))
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
  if (id === 'announcement' && v.enabled === true && !v.text) return fail('required', 'text')
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
