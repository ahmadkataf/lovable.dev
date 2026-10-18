// The mobile menu is a <details> that works without JS; this only closes it after a link in it is used (the page
// scrolls to a section and the open panel would cover it), on Escape, and when the screen grows past the menu.
(() => {
  const menu = document.querySelector('.menu')
  if (!menu) return
  const close = () => { menu.open = false }
  menu.addEventListener('click', e => { if (e.target instanceof Element && e.target.closest('.menu-panel a')) close() })
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.open) { close(); menu.querySelector('summary')?.focus() }
  })
  // the inline navigation replaces the menu from 1100 px (Arabic, English) or 1440 px (the languages with longer words)
  const wide = /^(ar|en)\b/.test(document.documentElement.lang) ? 1100 : 1440
  window.matchMedia(`(min-width: ${wide}px)`).addEventListener('change', e => { if (e.matches) close() })
})()
