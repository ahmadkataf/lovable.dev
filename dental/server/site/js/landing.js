// The mobile menu and the language menus are <details> elements that work without JS; this only closes them when a
// person expects it: the mobile menu after a link in it is used (the page scrolls to a section and the open panel would
// cover it), when the screen grows past the menu, and on Escape; a language menu on Escape (focus back on its button),
// on a click or focus outside it, and when the other menu opens (on a phone both could be open at once).
(() => {
  const menu = document.querySelector('.menu')
  const langs = [...document.querySelectorAll('.lang-menu')]
  const closeMenu = () => { if (menu) menu.open = false }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return
    const lang = langs.find(m => m.open)
    if (lang) { lang.open = false; lang.querySelector('summary')?.focus(); return }
    if (menu?.open) { closeMenu(); menu.querySelector('summary')?.focus() }
  })
  const outside = e => { for (const m of langs) if (m.open && !(e.target instanceof Node && m.contains(e.target))) m.open = false }
  document.addEventListener('click', outside)
  document.addEventListener('focusin', outside)
  // the header's language menu and the mobile menu never stay open together
  for (const m of langs) {
    m.addEventListener('toggle', () => { if (m.open && !m.closest('.menu')) closeMenu() })
  }
  if (!menu) return
  menu.addEventListener('toggle', () => { if (menu.open) for (const m of langs) if (!m.closest('.menu')) m.open = false })
  menu.addEventListener('click', e => { if (e.target instanceof Element && e.target.closest('.menu-panel a')) closeMenu() })
  // the inline navigation replaces the menu from 1100 px (Arabic, English) or 1440 px (the languages with longer words)
  const wide = /^(ar|en)\b/.test(document.documentElement.lang) ? 1100 : 1440
  window.matchMedia(`(min-width: ${wide}px)`).addEventListener('change', e => { if (e.matches) closeMenu() })
})()
