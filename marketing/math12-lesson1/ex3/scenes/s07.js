solution('s07', {
  tag: '⓫ متراجحة تدريجيّة', progress: '3 / 6',
  q: '① أثبت، أيّاً كان العدد الطبيعي $n$ ، $n\\ge2$ ، أنّ: $3\\times n^2\\ge(n+1)^2$.<br>② نرمز بالرمز $E(n)$ إلى القضيّة «$3^n\\ge2^n+5\\times n^2$».   ❶ ما أصغر عدد طبيعي غير معدوم $n$ ، تكون $E(n)$ صحيحة عنده؟',
  beats: {
    0: { hint: 'ادرس إشارة الفرق' },
    1: { rows: [{ t: '3n^2-(n+1)^2=3n^2-n^2-2n-1=2n^2-2n-1', tex: true }, { t: '=2n\\,(n-1)-1', tex: true }] },
    2: { rows: [{ t: 'n\\ge2:\\quad 2n\\ge4,\\ \\ n-1\\ge1\\ \\Rightarrow\\ 2n(n-1)-1\\ge3>0', tex: true }], box: { t: '$3n^2\\ge(n+1)^2$ ✓ عند $n\\ge2$', c: 'grn' } },
    3: { page: true, hint: 'جرّب $n=1,2,3,\\dots$' },
    4: { rows: [{ t: '\\begin{array}{c|c|c|c}n&3^n&2^n+5n^2&\\\\\\hline1&3&7&✗\\\\2&9&24&✗\\\\3&27&53&✗\\\\4&81&96&✗\\\\5&243&157&\\textcolor{#6ee05a}{✓}\\end{array}', tex: true }], box: { t: 'أصغر عدد: $n=5$', c: 'grn' } },
  },
})
