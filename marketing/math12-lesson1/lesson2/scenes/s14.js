solution('s14', {
  tag: 'تدرَّبْ ②', head: 'الكتاب ص 14',
  q: 'ليكن $x>-1$. في حالة عدد طبيعي $n$ نرمز $E(n)$ إلى المتراجحة $(1+x)^n\\ge1+nx$. أثبت أنّ $E(n)$ محقّقة أيّاً كان العدد الطبيعي $n$.',
  beats: {
    1: { rows: [{ t: '\\underbrace{(1+x)^n}_{\\text{ربح مركّب}}\\ \\ge\\ \\underbrace{1+nx}_{\\text{ربح بسيط}}', tex: true, cls2: 'ml' }], side: [{ type: 'card', kind: 'tip', tag: '🏦 قانون الأرباح', t: ['$x$ = نسبة الربح السنويّ', 'المركّب لا يقلّ أبداً عن البسيط'] }] },
    2: { page: true, rows: [{ t: '2<3\\ \\xrightarrow{\\ \\times2\\ }\\ 4<6', tex: true }, { t: '2<3\\ \\xrightarrow{\\times(-1)}\\ -2>-3', tex: true }, '$x>-1$ ← $1+x>0$ ← الضرب بـ $1+x$ لا يقلب الجهة'], side: [{ type: 'card', kind: 'warn', tag: '⚠️ انتبه', t: ['الضرب بعدد سالب', 'يقلب جهة المتراجحة'] }], clear: true },
    3: { page: true, rows: ['⓪ $n_0=0$ ، ① $(1+x)^0=1\\ge1+0\\times x=1$ ✓'] },
    4: { rows: ['② نفترض $(1+x)^n\\ge1+nx$، ونضرب الطرفين بالعدد الموجب $1+x$:'] },
    5: { rows: [{ t: '(1+x)^{n+1}\\ge(1+nx)(1+x)=1+(n+1)x+\\textcolor{#ffd23f}{nx^2}', tex: true }] },
    6: { rows: [{ t: '\\textcolor{#ffd23f}{nx^2}\\ge0\\ \\Rightarrow\\ (1+x)^{n+1}\\ge1+(n+1)x', tex: true }], box: { t: 'وهذه $E(n+1)$، إذن $E(n)$ محقّقة أيّاً كان العدد الطبيعي $n$', c: 'grn' }, side: [{ type: 'chip', t: 'المربّع لا يكون سالباً', c: 'yel' }], clear: true },
  },
})
