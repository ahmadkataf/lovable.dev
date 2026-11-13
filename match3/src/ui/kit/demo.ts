/**
 * Dev-only showcase of the UI kit (kit-demo.html): every component and state, in English (LTR)
 * and Arabic (RTL). Screenshotted and exercised by tools/kit-shots.cjs. Not imported by the game.
 *
 * It uses the real art, i18n and platform modules; audio is a recording stub (the kit depends on
 * the AudioApi interface only), so the checks can assert which sounds were requested.
 */
import { createArt } from '../../art/index.ts';
import type { AudioApi, SfxName } from '../../audio/types.ts';
import { createI18n } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/types.ts';
import { createPlatform } from '../../platform/index.ts';
import type { HapticKind, PlatformApi } from '../../platform/types.ts';
import type { Child, DialogHandle, Kit } from './index.ts';
import { createKit, fontsReady, setSafeInsets } from './index.ts';

// ───────────────────────────── services ─────────────────────────────

const params = new URLSearchParams(location.search);
const lang: Lang = params.get('lang') === 'ar' ? 'ar' : 'en';

const log = { sfx: [] as string[], haptics: [] as string[], clicks: {} as Record<string, number>, events: [] as string[] };

const audio: AudioApi = {
  unlock: () => undefined,
  setSfxEnabled: () => undefined,
  setMusicEnabled: () => undefined,
  sfx: (name: SfxName) => {
    log.sfx.push(name);
  },
  music: () => undefined,
  suspend: () => undefined,
  resume: () => undefined,
};

const realPlatform = createPlatform();
const platform: PlatformApi = {
  info: () => realPlatform.info(),
  loadSave: () => null,
  storeSave: () => undefined,
  haptic: (kind: HapticKind) => {
    log.haptics.push(kind);
  },
  setBackHandler: (handler) => realPlatform.setBackHandler(handler),
  setAtRoot: (atRoot) => realPlatform.setAtRoot(atRoot),
  rateApp: () => undefined,
  onPause: (listener) => realPlatform.onPause(listener),
  onResume: (listener) => realPlatform.onResume(listener),
};

const art = createArt();
const i18n = createI18n(lang);
const kit: Kit = createKit({ art, audio, i18n, platform });
const { el } = kit;

platform.setBackHandler(() => {
  const consumed = kit.closeTop();
  log.events.push('back:' + consumed);
  return consumed;
});

// ───────────────────────────── demo strings ─────────────────────────────

const STR: Record<string, [string, string]> = {
  play: ['Play', 'العب'],
  continue: ['Continue', 'متابعة'],
  retry: ['Try again', 'إعادة المحاولة'],
  cancel: ['Cancel', 'إلغاء'],
  quit: ['Quit', 'خروج'],
  resume: ['Resume', 'استئناف'],
  later: ['Maybe later', 'ربما لاحقًا'],
  delete: ['Delete', 'حذف'],
  claim: ['Claim', 'استلام'],
  buy: ['Buy', 'شراء'],
  ok: ['OK', 'موافق'],
  next: ['Next level', 'المرحلة التالية'],
  map: ['Back to map', 'العودة إلى الخريطة'],
  shop: ['Shop', 'المتجر'],
  settings: ['Settings', 'الإعدادات'],
  close: ['Close', 'إغلاق'],
  longLabel: ['Continue to the next chapter', 'المتابعة إلى الفصل التالي من الرحلة'],
  longLabel2: ['Restore my purchases', 'استعادة المشتريات السابقة'],
  loading: ['Loading…', 'جارٍ التحميل…'],
  watch: ['Watch a video', 'شاهد مقطعًا'],
  plusMoves: ['+5 moves', '‎+5 حركات'],
  plusLife: ['+1 life', '‎+1 قلب'],
  doubleReward: ['Double the reward', 'ضاعف المكافأة'],
  freeCoins: ['+25 coins', '‎+25 عملة'],
  popular: ['Popular', 'الأكثر طلبًا'],
  best: ['Best value', 'أفضل قيمة'],
  isNew: ['New', 'جديد'],
  owned: ['Owned', 'بحوزتك'],
  coins500: ['500 coins', '500 عملة'],
  coins1200: ['1,200 coins', '1,200 عملة'],
  coins3200: ['3,200 coins', '3,200 عملة'],
  coins15000: ['15,000 coins', '15,000 عملة'],
  starter: ['Starter pack', 'حزمة البداية'],
  starterSub: ['1,000 coins, 8 boosters and no ads between levels', '1,000 عملة و8 معزّزات وبلا إعلانات بين المراحل'],
  noAds: ['Remove ads', 'إزالة الإعلانات'],
  noAdsSub: ['No ads between levels', 'بلا إعلانات بين المراحل'],
  hammer: ['Hammer', 'المطرقة'],
  hammerSub: ['Breaks any one piece', 'تحطّم أي قطعة تختارها'],
  shuffleB: ['Shuffle', 'الخلط'],
  paused: ['Paused', 'إيقاف مؤقت'],
  pausedBody: ['Take a breath. Your level is waiting for you.', 'خذ نفسًا. مرحلتك في انتظارك.'],
  resetTitle: ['Reset progress?', 'إعادة ضبط التقدّم؟'],
  resetBody: [
    'All levels, stars and coins on this device will be erased. This cannot be undone.',
    'ستُمحى كل المراحل والنجوم والعملات على هذا الجهاز. لا يمكن التراجع عن ذلك.',
  ],
  reset: ['Reset', 'إعادة الضبط'],
  daily: ['Daily reward', 'المكافأة اليومية'],
  dailyBody: ['Day 3 — come back tomorrow for more!', 'اليوم الثالث — عُد غدًا للمزيد!'],
  howTo: ['How to play', 'طريقة اللعب'],
  levelDone: ['Level 12 complete!', 'اكتملت المرحلة 12!'],
  score: ['Score', 'النقاط'],
  outOfMoves: ['Out of moves', 'انتهت الحركات'],
  outBody: ['Only 2 lamps left. Keep going?', 'بقي فانوسان فقط. هل تتابع؟'],
  giveUp: ['Give up', 'انسحاب'],
  locked: ['Saving…', 'جارٍ الحفظ…'],
  lockedBody: ['Please wait a moment. This window cannot be closed with Back.', 'انتظر لحظة من فضلك. لا يمكن إغلاق هذه النافذة بزر الرجوع.'],
  nextLife: ['Next life in', 'القلب التالي بعد'],
  music: ['Music', 'الموسيقى'],
  sound: ['Sound effects', 'المؤثرات الصوتية'],
  haptics: ['Vibration', 'الاهتزاز'],
  longToggle: ['Show hints after a few seconds without a move', 'إظهار التلميحات بعد بضع ثوانٍ من دون حركة'],
  toast1: ['Not enough coins', 'العملات غير كافية'],
  toast2: ['+50 coins added', 'أُضيفت 50 عملة'],
  toast3: ['Purchases restored. Thank you for playing — enjoy the journey!', 'تمّت استعادة المشتريات. شكرًا للعبك — استمتع بالرحلة!'],
  panelTitle: ['Chapter 2 · Dunes', 'الفصل 2 · الكثبان'],
  panelBody: ['Rolling dunes under a violet sunset. 20 levels, 60 stars.', 'كثبان متموّجة تحت غروب بنفسجي. 20 مرحلة و60 نجمة.'],
  easy: ['Easy', 'سهل'],
  normal: ['Normal', 'عادي'],
  hard: ['Hard', 'صعب'],
};

function t(key: keyof typeof STR | string): string {
  const pair = STR[key];
  return pair ? pair[lang === 'ar' ? 1 : 0] : key;
}

const HOW_TO: [string, string][] = [
  ['Swap two neighbouring gems to line up three or more of the same kind.', 'بدّل جوهرتين متجاورتين لتصطفّ ثلاث جواهر أو أكثر من النوع نفسه.'],
  ['Four in a line make a Beam: it clears a whole row or column.', 'أربع جواهر في خط تصنع الشعاع: يزيل صفًّا أو عمودًا كاملًا.'],
  ['An L or T shape makes a Nova: it blasts everything around it.', 'شكل L أو T يصنع النوفا: تفجّر كل ما حولها.'],
  ['Five in a line make a Prism: swap it with a gem to clear that colour everywhere.', 'خمس جواهر في خط تصنع المنشور: بدّله مع جوهرة ليزيل لونها من اللوحة كلها.'],
  ['Swap two special pieces together for an even bigger effect.', 'بدّل قطعتين خاصتين معًا لتأثير أكبر.'],
  ['Sand disappears when you clear the gems on top of it. Thick sand needs two hits.', 'تختفي الرمال عندما تزيل الجواهر التي فوقها. الرمال السميكة تحتاج إلى ضربتين.'],
  ['Stones crack when you match next to them. Chains break when the chained gem is matched.', 'تتشقق الحجارة عندما تطابق بجوارها. وتنكسر السلاسل عندما تطابق الجوهرة المقيّدة.'],
  ['Vines spread if you leave them alone — clear at least one every turn.', 'ينتشر النبات المتسلّق إذا تركته — أزل واحدًا على الأقل في كل دور.'],
  ['Bring the lamps down to the bottom row to collect them.', 'أنزل الفوانيس إلى الصف السفلي لتجمعها.'],
  ['Every level has a number of moves. Finish the goals before they run out to win stars.', 'لكل مرحلة عدد من الحركات. أكمل الأهداف قبل أن تنتهي لتفوز بالنجوم.'],
];

// ───────────────────────────── page scaffolding ─────────────────────────────

const app = document.getElementById('app') as HTMLElement;
const page = el('div', { class: 'demo' });
app.appendChild(page);

function section(shot: string, title: string, ...children: Child[]): HTMLElement {
  const s = el('section', { class: 'demo-section', dataset: { shot } }, el('h2', { text: title }), children);
  page.appendChild(s);
  return s;
}

const cap = (text: string): HTMLElement => el('div', { class: 'demo-cap', text });
const flow = (...children: Child[]): HTMLElement => el('div', { class: 'demo-flow' }, children);

function counted(name: string): () => void {
  return () => {
    log.clicks[name] = (log.clicks[name] || 0) + 1;
  };
}

function pressed<T extends HTMLElement>(node: T): T {
  node.classList.add('k-pressed');
  return node;
}

// ───────────────────────────── 1. buttons ─────────────────────────────

const guardBtn = kit.button({ label: t('play'), icon: 'play', variant: 'primary', size: 'lg', onClick: counted('guard') });
guardBtn.id = 'demo-guard';
const asyncBtn = kit.button({
  label: t('buy'),
  variant: 'success',
  size: 'md',
  onClick: () => {
    counted('async')();
    return new Promise((resolve) => setTimeout(resolve, 600));
  },
});
asyncBtn.id = 'demo-async';

section(
  'buttons',
  'Buttons — variants',
  flow(guardBtn, kit.button({ label: t('continue'), variant: 'primary', size: 'md', onClick: counted('primary') }), kit.button({ label: t('ok'), variant: 'primary', size: 'sm' })),
  flow(
    kit.button({ label: t('retry'), icon: 'retry', variant: 'secondary', size: 'lg' }),
    kit.button({ label: t('cancel'), variant: 'secondary', size: 'md' }),
    kit.button({ label: t('quit'), variant: 'secondary', size: 'sm' }),
  ),
  flow(asyncBtn, kit.button({ label: t('claim'), icon: 'gift', variant: 'success', size: 'md' }), kit.button({ label: t('ok'), variant: 'success', size: 'sm' })),
  flow(
    kit.button({ label: t('delete'), icon: 'trash', variant: 'danger', size: 'md' }),
    kit.button({ label: t('reset'), variant: 'danger', size: 'sm' }),
    kit.button({ label: t('later'), variant: 'ghost', size: 'md' }),
    kit.button({ label: t('close'), variant: 'ghost', size: 'sm' }),
  ),
  cap('pressed (held)'),
  flow(
    pressed(kit.button({ label: t('play'), variant: 'primary', size: 'md' })),
    pressed(kit.button({ label: t('cancel'), variant: 'secondary', size: 'md' })),
    pressed(kit.button({ label: t('later'), variant: 'ghost', size: 'md' })),
  ),
  cap('disabled · loading · badge'),
  flow(
    kit.button({ label: t('play'), variant: 'primary', size: 'md', disabled: true }),
    kit.button({ label: t('cancel'), variant: 'secondary', size: 'md', disabled: true }),
    kit.button({ label: t('delete'), variant: 'danger', size: 'sm', disabled: true }),
  ),
  flow(
    (() => {
      const b = kit.button({ label: t('continue'), variant: 'primary', size: 'md' });
      b.update({ loading: true });
      return b;
    })(),
    (() => {
      const b = kit.button({ label: t('cancel'), variant: 'secondary', size: 'md' });
      b.update({ loading: true });
      return b;
    })(),
    kit.button({ label: t('shop'), icon: 'shop', variant: 'secondary', size: 'md', badge: 3 }),
    kit.button({ label: t('claim'), icon: 'calendar', variant: 'primary', size: 'sm', badge: '!' }),
  ),
  cap('block · caption · long labels (300 px column)'),
  el(
    'div',
    { class: 'demo-stack demo-narrow' },
    kit.button({ label: t('next'), icon: 'next', variant: 'primary', size: 'lg', block: true }),
    kit.button({ label: t('longLabel'), variant: 'primary', size: 'md', block: true }),
    kit.button({ label: t('longLabel2'), icon: 'restore', variant: 'secondary', size: 'md', block: true }),
    kit.button({ label: t('hammer'), caption: t('hammerSub'), icon: 'hammer', variant: 'secondary', size: 'md', block: true }),
  ),
);

// ───────────────────────────── 2. icon buttons ─────────────────────────────

section(
  'icon-buttons',
  'Icon buttons (round)',
  flow(
    kit.iconButton({ icon: 'settings', ariaLabel: t('settings'), size: 'lg' }),
    kit.iconButton({ icon: 'pause', ariaLabel: 'pause', size: 'md' }),
    kit.iconButton({ icon: 'close', ariaLabel: t('close'), size: 'sm' }),
    kit.iconButton({ icon: 'shop', ariaLabel: t('shop'), size: 'md', variant: 'primary', badge: 2 }),
    kit.iconButton({ icon: 'play', ariaLabel: t('play'), size: 'lg', variant: 'primary' }),
    kit.iconButton({ icon: 'check', ariaLabel: t('ok'), size: 'md', variant: 'success' }),
    kit.iconButton({ icon: 'trash', ariaLabel: t('delete'), size: 'md', variant: 'danger' }),
    kit.iconButton({ icon: 'back', ariaLabel: 'back', size: 'md', variant: 'ghost' }),
    kit.iconButton({ icon: 'home', ariaLabel: 'home', size: 'md', disabled: true }),
    pressed(kit.iconButton({ icon: 'map', ariaLabel: 'map', size: 'md' })),
  ),
  cap('booster bar'),
  flow(
    kit.iconButton({ icon: 'hammer', ariaLabel: t('hammer'), size: 'lg', badge: 3 }),
    kit.iconButton({ icon: 'freeSwap', ariaLabel: 'swap', size: 'lg', badge: 12 }),
    kit.iconButton({ icon: 'shuffle', ariaLabel: t('shuffleB'), size: 'lg', badge: '+' }),
  ),
);

// ───────────────────────────── 3. shop ─────────────────────────────

const offers = el(
  'div',
  { class: 'k-grid2' },
  kit.offerCard({ art: 'coin', title: t('coins500'), price: 'US$0.99', quantity: '500', onBuy: counted('offer') }).el,
  kit.offerCard({ art: 'coinPile', title: t('coins3200'), price: 'US$4.99', ribbon: { text: t('popular'), tone: 'popular' }, quantity: '3,200', onBuy: counted('offer') }).el,
  kit.offerCard({
    art: 'coinChest',
    title: t('coins15000'),
    price: lang === 'ar' ? '٧٤٫٩٩ ر.س' : 'US$19.99',
    priceLabel: t('buy'),
    ribbon: { text: t('best'), tone: 'best' },
    featured: true,
    onBuy: counted('offer'),
  }).el,
  kit.offerCard({ art: 'hammer', title: t('hammer'), subtitle: t('hammerSub'), price: '90', priceIcon: 'coin', variant: 'primary', quantity: '×3', onBuy: counted('offer') }).el,
  kit.offerCard({ art: 'noAds', title: t('noAds'), subtitle: t('noAdsSub'), price: 'US$2.99', owned: true, ownedText: t('owned'), onBuy: counted('offer') }).el,
  kit.offerCard({ art: 'coinPile', title: t('coins1200'), price: 'US$1.99', loading: true, ribbon: { text: t('isNew'), tone: 'new' }, onBuy: counted('offer') }).el,
);

section(
  'shop',
  'Shop — price & ad buttons, offer cards',
  flow(
    kit.priceButton({ price: 'US$0.99', label: t('buy'), size: 'md', onClick: counted('price') }),
    kit.priceButton({ price: lang === 'ar' ? '٣٫٩٩ ر.س' : '€3.99', size: 'md' }),
    kit.priceButton({ price: '90', icon: 'coin', variant: 'primary', size: 'md' }),
    kit.priceButton({ price: 'US$4.99', label: t('buy'), size: 'sm' }),
  ),
  flow(kit.priceButton({ price: 'US$0.99', label: t('buy'), size: 'md', loading: true }), kit.priceButton({ price: 'US$0.99', label: t('buy'), size: 'md', disabled: true }), kit.priceButton({ price: '240', icon: 'coin', variant: 'primary', size: 'lg', label: t('plusMoves') })),
  cap('watch a video (opt-in, reward on the button)'),
  flow(
    kit.adButton({ label: t('plusMoves'), caption: t('watch'), size: 'md', onClick: counted('ad') }),
    kit.adButton({ label: t('freeCoins'), size: 'md', badge: 5 }),
    kit.adButton({ label: '+25', rewardIcon: 'coin', size: 'sm' }),
  ),
  flow(kit.adButton({ label: t('plusLife'), caption: t('watch'), size: 'md', disabled: true }), kit.adButton({ label: t('doubleReward'), size: 'md', loading: true })),
  cap('offer cards (tile)'),
  offers,
  cap('offer cards (row)'),
  el(
    'div',
    { class: 'demo-stack' },
    kit.offerCard({
      layout: 'row',
      art: 'gift',
      title: t('starter'),
      subtitle: t('starterSub'),
      price: 'US$2.99',
      ribbon: { text: t('best'), tone: 'best' },
      featured: true,
      onBuy: counted('offer'),
    }).el,
    kit.offerCard({ layout: 'row', art: 'noAds', title: t('noAds'), subtitle: t('noAdsSub'), price: 'US$2.99', owned: true, ownedText: t('owned'), onBuy: counted('offer') }).el,
    kit.offerCard({ layout: 'row', art: 'shuffle', title: t('shuffleB'), price: '60', priceIcon: 'coin', variant: 'primary', quantity: '×1', onBuy: counted('offer') }).el,
  ),
  cap('quantity badges · owned tick · ribbon · countdown'),
  flow(
    kit.qty('×3').el,
    kit.qty('+500', { tone: 'gold' }).el,
    kit.qty('12').el,
    kit.ownedTick(t('owned')),
    kit.ownedTick(),
    kit.countdown({ until: Date.now() + 19 * 60000 + 42000, icon: 'heart', label: t('nextLife') }).el,
    kit.countdown({ until: Date.now() + 5 * 3600000 + 125000 }).el,
  ),
);

// ───────────────────────────── 4. HUD pieces ─────────────────────────────

const coins = kit.chip({ icon: 'coin', text: i18n.num(1250), plus: true, onClick: counted('coins'), ariaLabel: 'coins' });
coins.el.id = 'demo-coins';
const lives = kit.chip({ icon: 'heart', text: '5' });
const starsChip = kit.chip({ icon: 'star', text: '37/60' });
const progressLive = kit.progress({ value: 5200, max: 9000, notches: [3000, 6000, 9000] });

section(
  'hud',
  'Chips · progress · stars',
  el('div', { class: 'demo-hud' }, lives.el, starsChip.el, coins.el),
  flow(
    kit.chip({ icon: 'moves', text: '24' }).el,
    kit.chip({ icon: 'heart', text: '19:42' }).el,
    kit.chip({ icon: 'coin', text: i18n.num(1234567), plus: true, onClick: counted('coins2') }).el,
    pressed(kit.chip({ icon: 'coin', text: '90', plus: true, onClick: counted('coins3') }).el),
  ),
  cap('progress — plain, tones'),
  el(
    'div',
    { class: 'demo-stack' },
    kit.progress({ value: 0, max: 10 }).el,
    kit.progress({ value: 3, max: 10 }).el,
    kit.progress({ value: 7, max: 10, tone: 'success' }).el,
    kit.progress({ value: 10, max: 10, tone: 'info' }).el,
  ),
  cap('progress — star notches at 3,000 / 6,000 / 9,000'),
  el('div', { class: 'demo-stack' }, kit.progress({ value: 1200, max: 9000, notches: [3000, 6000, 9000] }).el, progressLive.el, kit.progress({ value: 9000, max: 9000, notches: [3000, 6000, 9000] }).el),
  cap('star rows'),
  flow(kit.starRow(0).el, kit.starRow(1).el, kit.starRow(2).el, kit.starRow(3).el),
  flow(kit.starRow(3, { size: 56 }).el, kit.starRow(2, { size: 20 }).el, kit.starRow(1, { size: 20 }).el, kit.starRow(4, { size: 26, max: 5 }).el),
);

// ───────────────────────────── 5. controls ─────────────────────────────

const musicToggle = kit.toggle({ checked: true, label: t('music'), icon: 'music', onChange: (v) => log.events.push('music:' + v) });
musicToggle.el.id = 'demo-toggle';
const langSeg = kit.segmented(
  [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية' },
  ],
  {
    value: lang,
    ariaLabel: 'language',
    onChange: (v) => {
      log.events.push('lang:' + v);
      const next = new URLSearchParams(location.search);
      next.set('lang', v);
      location.search = next.toString();
    },
  },
);
const levelSeg = kit.segmented(
  [
    { value: 'easy', label: t('easy') },
    { value: 'normal', label: t('normal') },
    { value: 'hard', label: t('hard') },
  ],
  { value: 'normal', onChange: (v) => log.events.push('seg:' + v) },
);
levelSeg.el.id = 'demo-seg';

section(
  'controls',
  'Toggle · segmented · panel',
  kit.panel(
    null,
    kit.title(t('settings')),
    kit.rule(),
    el(
      'div',
      { style: { marginTop: 'calc(var(--k-u) * 8)' } },
      musicToggle.el,
      kit.toggle({ checked: false, label: t('sound'), icon: 'soundOff', onChange: () => undefined }).el,
      kit.toggle({ checked: true, label: t('haptics'), icon: 'haptics', disabled: true, onChange: () => undefined }).el,
      kit.toggle({ checked: false, label: t('longToggle'), onChange: () => undefined }).el,
    ),
    el('div', { class: 'k-col k-gap-12', style: { marginTop: 'calc(var(--k-u) * 10)' } }, langSeg.el, levelSeg.el, kit.segmented([{ value: 'a', icon: 'sound', ariaLabel: 'on' }, { value: 'b', icon: 'soundOff', ariaLabel: 'off' }], { value: 'a', onChange: () => undefined }).el),
  ),
  cap('panel · title sizes · text · spinner'),
  kit.panel(
    null,
    kit.title(t('panelTitle'), 'lg'),
    kit.title(t('panelTitle')),
    kit.title(t('panelTitle'), 'sm'),
    kit.rule(),
    el('div', { class: 'k-col', style: { marginTop: 'calc(var(--k-u) * 8)' } }, kit.text(t('panelBody')), kit.text(t('panelBody'), 'k-text--muted k-text--sm'), el('div', { class: 'k-row k-center' }, kit.spinner(), el('span', { class: 'k-text k-text--muted', text: t('loading') }))),
  ),
  cap('icons on gold'),
  el('div', { class: 'demo-gold k-row' }, kit.icon('coin', 32), kit.icon('heart', 32), kit.icon('star', 32), kit.icon('gem0', 40), kit.icon('prism', 40), kit.icon('lamp', 40)),
);

// ───────────────────────────── 6. dialogs ─────────────────────────────

type Scenario = 'basic' | 'confirm' | 'medal' | 'tall' | 'stack' | 'result' | 'lose' | 'shop' | 'long' | 'locked' | 'toasts';

const results: Record<string, unknown> = {};

function track<T>(name: string, dialog: DialogHandle<T>): DialogHandle<T> {
  results[name] = 'open';
  void dialog.closed.then((value) => {
    results[name] = value === undefined ? 'undefined' : value;
    log.events.push('closed:' + name + ':' + String(value));
  });
  return dialog;
}

function shopBody(): HTMLElement {
  return el(
    'div',
    { class: 'k-col k-gap-12' },
    el('div', { class: 'k-row k-center' }, kit.chip({ icon: 'coin', text: i18n.num(1250) }).el),
    el(
      'div',
      { class: 'k-grid2', style: { marginTop: 'calc(var(--k-u) * 14)' } },
      kit.offerCard({ art: 'coin', title: t('coins500'), price: 'US$0.99', onBuy: counted('buy') }).el,
      kit.offerCard({ art: 'coinPile', title: t('coins3200'), price: 'US$4.99', ribbon: { text: t('popular') }, onBuy: counted('buy') }).el,
      kit.offerCard({ art: 'coinChest', title: t('coins15000'), price: 'US$19.99', ribbon: { text: t('best'), tone: 'best' }, featured: true, onBuy: counted('buy') }).el,
      kit.offerCard({ art: 'hammer', title: t('hammer'), price: '90', priceIcon: 'coin', variant: 'primary', quantity: '×3', onBuy: () => openScenario('confirm') }).el,
    ),
    kit.offerCard({ layout: 'row', art: 'gift', title: t('starter'), subtitle: t('starterSub'), price: 'US$2.99', featured: true, onBuy: counted('buy') }).el,
    kit.adButton({ label: t('freeCoins'), caption: t('watch'), block: true, badge: 5, onClick: () => kit.toast(t('toast2'), { icon: 'coin' }) }),
  );
}

function openScenario(name: Scenario): DialogHandle<unknown> | null {
  switch (name) {
    case 'basic':
      return track(
        name,
        kit.openDialog<string>({
          title: t('paused'),
          body: t('pausedBody'),
          buttons: [
            { label: t('quit'), variant: 'secondary', result: 'quit' },
            { label: t('resume'), variant: 'primary', result: 'resume' },
          ],
        }),
      );
    case 'confirm': {
      results[name] = 'open';
      void kit.confirm({ title: t('resetTitle'), message: t('resetBody'), yes: t('reset'), no: t('cancel'), danger: true }).then((value) => {
        results[name] = value;
        log.events.push('closed:confirm:' + value);
      });
      return null;
    }
    case 'medal':
      return track(
        name,
        kit.openDialog<string>({
          title: t('daily'),
          icon: 'gift',
          body: el(
            'div',
            { class: 'k-col k-gap-12' },
            el('div', { class: 'k-row k-center k-gap-16' }, el('div', { style: { position: 'relative' } }, kit.icon('coinPile', 64), kit.qty('+80', { corner: true, tone: 'gold' }).el), el('div', { style: { position: 'relative' } }, kit.icon('hammer', 64), kit.qty('×1', { corner: true }).el)),
            kit.text(t('dailyBody'), 'k-text--center k-text--muted'),
          ),
          buttons: [{ label: t('claim'), variant: 'primary', size: 'lg', result: 'claimed' }],
        }),
      );
    case 'tall':
      return track(
        name,
        kit.openDialog<string>({
          title: t('howTo'),
          body: el(
            'div',
            { class: 'k-col k-gap-12' },
            HOW_TO.map((pair, i) =>
              el('div', { class: 'k-row k-gap-12', style: { alignItems: 'flex-start' } }, kit.icon((['gem0', 'beamH1', 'nova2', 'prism', 'nova4', 'sand1', 'stone3', 'vine', 'lamp', 'moves'] as const)[i % 10], 36), kit.text(pair[lang === 'ar' ? 1 : 0], 'k-grow')),
            ),
          ),
          buttons: [{ label: t('ok'), variant: 'primary', result: 'ok' }],
        }),
      );
    case 'stack': {
      const first = openScenario('shop');
      openScenario('confirm');
      return first;
    }
    case 'shop':
      return track(name, kit.openDialog<string>({ title: t('shop'), wide: true, body: shopBody() }));
    case 'result': {
      const stars = kit.starRow(0, { size: 54 });
      const scoreEl = el('span', { class: 'k-title k-title--lg k-num', text: '0' });
      const coinsEl = kit.chip({ icon: 'coin', text: '+0' });
      const dialog = track(
        name,
        kit.openDialog<string>({
          title: t('levelDone'),
          dismissible: false,
          body: el('div', { class: 'k-col k-gap-12', style: { alignItems: 'center' } }, stars.el, el('div', { class: 'k-col k-gap-4', style: { alignItems: 'center' } }, kit.text(t('score'), 'k-text--muted k-text--sm'), scoreEl), coinsEl.el),
          buttonLayout: 'column',
          buttons: [
            kit.adButton({ label: t('doubleReward'), caption: t('watch'), block: true, onClick: () => kit.toast(t('toast2'), { icon: 'coin' }) }),
            { label: t('next'), icon: 'next', variant: 'primary', size: 'lg', result: 'next' },
            { label: t('map'), variant: 'ghost', size: 'sm', result: 'map' },
          ],
        }),
      );
      stars.set(3, true);
      void kit.tweenNumber(scoreEl, 0, 12480, 900);
      window.setTimeout(() => coinsEl.set('+50'), 950);
      return dialog;
    }
    case 'lose':
      return track(
        name,
        kit.openDialog<string>({
          title: t('outOfMoves'),
          icon: 'moves',
          body: t('outBody'),
          dismissible: false,
          buttonLayout: 'column',
          buttons: [
            kit.priceButton({ price: '90', icon: 'coin', label: t('plusMoves'), variant: 'primary', size: 'lg', block: true, onClick: counted('continue') }),
            kit.adButton({ label: t('plusMoves'), caption: t('watch'), block: true, onClick: counted('adMoves') }),
            { label: t('giveUp'), variant: 'ghost', size: 'sm', result: 'giveUp' },
          ],
        }),
      );
    case 'long':
      return track(
        name,
        kit.openDialog<string>({
          title: t('longLabel'),
          body: t('resetBody') + '\n\n' + t('starterSub'),
          buttons: [
            { label: t('longLabel2'), variant: 'secondary', result: 'a' },
            { label: t('longLabel'), variant: 'primary', result: 'b' },
          ],
        }),
      );
    case 'locked':
      return track(name, kit.openDialog<string>({ title: t('locked'), body: el('div', { class: 'k-col k-gap-12', style: { alignItems: 'center' } }, kit.spinner(), kit.text(t('lockedBody'), 'k-text--center')), dismissible: false }));
    case 'toasts':
      kit.toast(t('toast1'), { icon: 'coin', duration: 60000 });
      kit.toast(t('toast2'), { duration: 60000 });
      kit.toast(t('toast3'), { icon: 'restore', duration: 60000 });
      return null;
  }
}

const SCENARIOS: Scenario[] = ['basic', 'confirm', 'medal', 'tall', 'stack', 'result', 'lose', 'shop', 'long', 'locked', 'toasts'];

section(
  'dialogs',
  'Dialogs & toasts',
  flow(
    SCENARIOS.map((name) => {
      const b = kit.button({ label: name, variant: 'secondary', size: 'sm', onClick: () => void openScenario(name) });
      b.id = 'demo-open-' + name;
      return b;
    }),
  ),
  flow(
    kit.button({ label: 'toast', variant: 'ghost', size: 'sm', onClick: () => kit.toast(t('toast1'), { icon: 'coin' }) }),
    kit.button({ label: 'bump', variant: 'ghost', size: 'sm', onClick: () => coins.set(i18n.num(1250 + Math.floor(Math.random() * 900))) }),
    kit.button({ label: 'progress', variant: 'ghost', size: 'sm', onClick: () => progressLive.set(Math.random() * 9000) }),
  ),
);

// ───────────────────────────── backdrop & hooks ─────────────────────────────

function paintBackdrop(): void {
  const canvas = document.getElementById('backdrop') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  const ctx = canvas.getContext('2d');
  if (ctx) art.paintBackdrop(ctx, 'oasis', canvas.width, canvas.height);
}
paintBackdrop();
window.addEventListener('resize', paintBackdrop);

declare global {
  interface Window {
    __kitDemo?: {
      kit: Kit;
      log: typeof log;
      results: Record<string, unknown>;
      open: (name: Scenario) => void;
      setSafeInsets: typeof setSafeInsets;
      ready: boolean;
    };
  }
}

window.__kitDemo = { kit, log, results, open: (name) => void openScenario(name), setSafeInsets, ready: false };

void fontsReady().then(() => {
  const open = params.get('open');
  if (open && SCENARIOS.indexOf(open as Scenario) >= 0) openScenario(open as Scenario);
  if (window.__kitDemo) window.__kitDemo.ready = true;
});
