scene('s25', {
  build(root, S) {
    this.h = heading(root, 'الخلاصة')
    const left = card(root, 'def', 1800, 260, 800, { anchor: 'tr', tag: 'الحسابيّة والهندسيّة' })
    this.L = ['لإثبات أنّها هندسيّة: $u_{n+1}=q\\times u_n$ أيّاً كان $n$', 'حسابيّة: $u_{n+1}=u_n+r$ أيّاً كان $n$ <span class="mute">(لا حالات خاصّة)</span>',
      '$u_m=u_p+(m-p)\\,r$ ، $u_m=u_p\\,q^{m-p}$', '$S=\\dfrac{n(a+\\ell)}{2}$ ، $S=a\\,\\dfrac{1-q^n}{1-q}\\ (q\\ne1)$', 'عدد الحدود $=$ الدليل الأخير $-$ الدليل الأوّل $+\\,1$']
      .map(t => { const e = rich(t, 'p'); e.style.fontSize = '30px'; e.style.margin = '8px 0'; left.body.appendChild(e); return e })
    this.left = left.el
    const right = card(root, 'exam', 920, 260, 800, { anchor: 'tr', tag: 'الاطّراد' })
    this.R0 = rich('<span class="yel b">أوّلاً: $n_0$؟</span> مجموعة التعريف: $n_0=1$ في ④❶ ، $n_0=3$ في ④❺ — بداية الاطّراد: $n_0=1$ في ④❻', 'p')
    this.R = ['إشارة الفرق: ④❸ ④❹ ④❻ ④❼', 'اطّراد التابع: ④❶ ④❷ ④❺', 'مقارنة النسبة بالواحد (حدود موجبة تماماً): ④❽ ④❾', '🎯 جملة الجواب: فالمتتالية $(u_n)_{n\\ge n_0}$ متزايدة تماماً / متناقصة تماماً']
    ;[this.R0, ...this.R.map(t => rich(t, 'p'))].forEach((e, i) => { e.style.fontSize = '30px'; e.style.margin = '8px 0'; right.body.appendChild(e); if (i) this.R[i - 1] = e })
    this.right = right.el
    this.snap = chip(root, '📸 صوّر الشاشة', 960, 950, { anchor: 'c', color: C.blu })
    // finale: dominoes + odd squares + next lesson
    this.dom = tex('v_0>0\\to v_1>0\\to v_2>0\\to\\cdots', 'ml'); root.appendChild(this.dom); place(this.dom, 960, 420, { anchor: 'c' }); this.dom.style.color = C.grn
    this.odd = tex('1+3+5+\\cdots+(2n-1)=n^2\\ \\textcolor{#ffd23f}{?}', 'ml'); root.appendChild(this.odd); place(this.odd, 960, 560, { anchor: 'c' })
    this.next = rich('<span class="pur b">2 البرهان بالتدريج أو بالاستقراء الرياضي</span> — الكتاب ص 12', 'h2'); root.appendChild(this.next); place(this.next, 960, 720, { anchor: 'c' })
    this.end = chip(root, 'الدرس التالي: البرهان بالتدريج', 960, 860, { anchor: 'c', color: C.yel }); this.end.style.fontSize = '40px'
  },
  render(lt, S) {
    const out = S.p(lt, 4, 0, .6)
    this.h.set(Math.min(S.p(lt, 0, 0, .7), 1 - out))
    rise(this.left, Math.min(S.p(lt, 0, .2, .6), 1 - out))
    const d0 = S.end(0) - S.at(0)
    this.L.forEach((e, i) => op(e, S.p(lt, 0, .4 + i * d0 * .17, .5)))
    rise(this.right, Math.min(S.p(lt, 1, .1, .6), 1 - out))
    op(this.R0, S.p(lt, 1, .4, .5))
    const d2 = S.end(2) - S.at(2)
    this.R.slice(0, 3).forEach((e, i) => op(e, S.p(lt, 2, .3 + i * d2 * .3, .5)))
    op(this.R[3], S.p(lt, 3, .3, .5))
    pop(this.snap, Math.min(S.p(lt, 3, 1, .6), 1 - out))
    const glow = S.p(lt, 3, .8, .6) * (1 - S.p(lt, 3, 1.6, .8))
    ;[this.left, this.right].forEach(c => { c.style.boxShadow = `0 30px 80px rgba(0,0,0,.35), 0 0 ${60 * glow}px rgba(255,210,63,${.5 * glow})` })
    pop(this.dom, S.p(lt, 4, .5, .7))
    pop(this.odd, S.p(lt, 5, .3, .7))
    rise(this.next, S.p(lt, 5, 1.2, .7))
    pop(this.end, S.p(lt, 5, 2.2, .7))
  },
})
