// The seller's control panel, served at /admin. It holds no secrets: it asks for the admin key and keeps it
// in this browser only, then talks to /api/admin/*. Built for the phone first (bottom tab bar, code cards,
// bottom sheets for every action) and widens into a sidebar layout on a computer.
// The page is a plain HTML file that wrangler bundles as text (its default rule for *.html), so the script
// inside is written as ordinary JavaScript: no template-literal escaping to get wrong.
import page from './admin.html'

export const ADMIN_PAGE: string = page
