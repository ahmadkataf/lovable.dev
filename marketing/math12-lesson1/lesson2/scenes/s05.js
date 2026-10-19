solution('s05', {
  title: '2.2 مبدأ الإثبات بالتدريج', paper: '📖 الكتاب ص 12', paperType: 'def',
  beats: {
    0: { rows: ['كي تصل إلى أيّ درجة من السُّلّم، يكفيك أمران:'], side: [{ type: 'ladder', rungs: 7, from: 0, to: 0, labels: [[0, 'n₀'], [3, 'p'], [4, 'p+1', 'grn']] }] },
    1: { rows: ['① أن تصعد إلى الدرجة القاعديّة $n_0$'] },
    2: { rows: ['② أن تصعد من أيّ درجة $p$ إلى التي تعلوها $p+1$'], side: [{ type: 'ladder', rungs: 7, from: 3, to: 4, follow: true, fa: .3, fb: .9, labels: [[0, 'n₀'], [3, 'p'], [4, 'p+1', 'grn']] }], clear: true },
    3: { rows: ['عندها تصل إلى كلّ الدرجات $n\\ge n_0$ — كالدومينو'], side: [{ type: 'ladder', rungs: 7, from: 0, to: 6, follow: true, fa: .05, fb: .85, labels: [[0, 'n₀'], [6, '…', 'grn']] }], clear: true },
    4: { page: true, rows: ['لإثبات صحّة $E(n)$ في حالة $n\\ge n_0$:', '① نثبت صحّة $E(n_0)$ — الحالة القاعديّة', '② نثبت أنّ صحّة $E(p)$ تقتضي صحّة $E(p+1)$ في حالة $p\\ge n_0$'],
         box: { t: 'عندها: $E(n)$ صحيحة أيّاً كانت قيمة $n\\ge n_0$', c: 'grn' }, side: [{ type: 'dominoes', n: 9, follow: true, fa: .2, fb: .95 }], clear: true },
    5: { warn: ['«تقتضي»: إذا كانت $E(p)$ صحيحة كانت $E(p+1)$ صحيحة', 'لا نثبت $E(p)$… بل <b>نفترضها</b>'] },
  },
})
