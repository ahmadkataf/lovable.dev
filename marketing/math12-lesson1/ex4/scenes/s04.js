solution('s04', {
  title: 'تذكير: المشتقّ والاطّراد', paper: '🧰 مهارة سابقة', paperType: 'def', skip: true,
  beats: {
    0: { rows: ['$f\'(x)>0$ على مجال ⟸ $f$ متزايد تماماً عليه', { t: 'a<b\\ \\Rightarrow\\ f(a)<f(b)', tex: true }], box: { t: 'التابع المتزايد يحفظ الترتيب', c: 'yel' } },
    1: { page: true, rows: [{ t: '\\left(\\dfrac{N}{D}\\right)\'=\\dfrac{N\'D-N\\,D\'}{D^2}', tex: true, cls2: 'ml' }], side: [{ type: 'card', kind: 'tip', tag: 'بالكلمات', t: ['$N$: البسط ، $D$: المقام', '$D^2>0$ دائماً'] }] },
  },
})
