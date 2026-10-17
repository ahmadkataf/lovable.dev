solution('s04', {
  tag: '❼ (4)', progress: '1 / 2',
  q: '4. اقترح صيغة للحدّ $u_n$ بدلالة $n$. ثُمّ أثبت صحّة اقتراحك أيّاً كان $n$.<br>✍️ أنجزِ الحلّ واكتبه بلغةٍ سليمة.',
  beats: {
    0: { hint: 'البرهان بالتدريج: البداية، ثمّ الانتقال من $n$ إلى $n+1$', side: [{ type: 'dominoes', n: 8, fall: 0 }] },
    1: { rows: ['نضع $E(n)$: «$u_n=5\\times10^n+2$»', 'عند $n=0$: $\\ 5\\times10^0+2=5+2=7=u_0$ ، فـ $E(0)$ صحيحة.'],
         side: [{ type: 'chip', t: '$10^0=1$', c: 'yel' }], clear: true },
    2: { rows: ['نفترض أنّ $E(n)$ صحيحة، أي $u_n=5\\times10^n+2$ ، عندئذٍ:', { t: 'u_{n+1}=10\\,u_n-18=10\\,(5\\times10^n+2)-18', tex: true }, { t: '=5\\times10^{n+1}+20-18', tex: true }] },
    3: { rows: [{ t: '=5\\times10^{n+1}+2', tex: true }, 'فـ $E(n+1)$ صحيحة.'], box: { t: '$u_n=5\\times10^n+2$ أيّاً كان $n\\in\\mathbb{N}$', c: 'grn' },
         side: [{ type: 'dominoes', n: 8, follow: true, fa: .05, fb: .7 }], clear: true },
  },
})
