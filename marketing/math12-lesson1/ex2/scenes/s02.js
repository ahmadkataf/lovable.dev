solution('s02', {
  tag: '❼ صُغ افتراضاً ثمّ تحقّق من صحّته', progress: '1 / 2',
  q: 'نتأمّل المتتالية $(u_n)_{n\\ge0}$ المعرّفة تدريجيّاً وفق $u_0=7$ و $u_{n+1}=10u_n-18$ عند كلّ عدد طبيعي $n$. نهدف في هذا التمرين إلى التعبير عن $u_n$ بدلالة $n$.',
  beats: {
    1: { hint: 'احسب $u_1,\\,u_2,\\,u_3,\\,u_4,\\,u_5$', side: [{ type: 'card', kind: 'think', tag: 'نحو الحلّ', t: ['نحسب حدوداً أوّلاً', 'ثمّ نبحث عن الرابط', 'بين قيمة الحدّ ودليله'] }] },
    2: { rows: [{ t: 'u_1=10\\times7-18=52', tex: true }, { t: '\\begin{aligned}u_2&=502\\\\u_3&=5\\,002\\\\u_4&=50\\,002\\\\u_5&=500\\,002\\end{aligned}', tex: true }] },
    3: { page: true, rows: [{ t: '\\begin{array}{r|l}n&u_n\\\\\\hline1&\\textcolor{#ffd23f}{5}\\textcolor{#38bdf8}{}\\textcolor{#6ee05a}{2}\\\\2&\\textcolor{#ffd23f}{5}\\textcolor{#38bdf8}{0}\\textcolor{#6ee05a}{2}\\\\3&\\textcolor{#ffd23f}{5}\\textcolor{#38bdf8}{00}\\textcolor{#6ee05a}{2}\\\\4&\\textcolor{#ffd23f}{5}\\textcolor{#38bdf8}{000}\\textcolor{#6ee05a}{2}\\\\5&\\textcolor{#ffd23f}{5}\\textcolor{#38bdf8}{0000}\\textcolor{#6ee05a}{2}\\end{array}', tex: true, cls2: 'ml' }],
         box: { t: '$5$ في البداية · أصفار · $2$ في النهاية', c: 'yel' } },
  },
})
