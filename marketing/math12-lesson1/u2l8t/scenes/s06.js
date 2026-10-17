solution('s06', {
  tag: 'تدرَّبْ ❺', progress: '5 / 7', ring: 'card',
  q: 'ليكن $f$ التابع المعرّف على $\\mathbb R$ وفق $f(x)=4x^3-3x-\\dfrac12$.   ① احسب $f(-1)$ و $f(-\\tfrac12)$ و $f(0)$ و $f(1)$.   ② استنتج أنّ المعادلة $f(x)=0$ تقبل ثلاثة حلول في المجال $[-1,1]$.',
  beats: {
    1: { rows: [{ t: 'f(-1)=-\\tfrac32,\\quad f\\left(-\\tfrac12\\right)=\\tfrac12,\\quad f(0)=-\\tfrac12,\\quad f(1)=\\tfrac12', tex: true }],
         side: [{ type: 'graph', xmin: -1.2, xmax: 1.2, ymin: -1.8, ymax: 1.2, h: 360, xt: [-1, [-0.5, '-\\tfrac12'], 1], fns: [{ f: '4*x*x*x-3*x-0.5', from: -1, to: 1 }], pts: [[-1, -1.5, 'c', 'yel'], [-0.5, 0.5, 'c', 'yel'], [0, -0.5, 'c', 'yel'], [1, 0.5, 'c', 'yel']] }] },
    2: { rows: ['ثلاثة تغيّرات للإشارة + الاستمرار ⟸ حلّ في كلّ من:', { t: '\\left]-1,-\\tfrac12\\right[,\\quad\\left]-\\tfrac12,0\\right[,\\quad]0,1[', tex: true }, 'معادلة من الدرجة الثالثة: ثلاثة حلول على الأكثر'], box: { t: 'ثلاثة حلول بالضبط في $[-1,1]$', c: 'grn' } },
  },
})
