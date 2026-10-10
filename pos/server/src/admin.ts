// The seller's control panel, served at /admin. One self-contained page: it holds no secrets, asks for the admin
// key, keeps it in this browser only (localStorage, or sessionStorage when "remember" is off) and talks to
// /admin/api/*. Sidebar + top bar on a computer (>= 1024px), bottom tabs + sheets on a phone; system dark/light
// with a toggle; printing shows only the code cards.
//
// The page is assembled from String.raw parts so its own JavaScript keeps its backslashes: no part may contain a
// backtick or "${". Every string that comes from the server or the user goes through esc() before it is put in HTML.
import { ADMIN_CSS } from './admin-css'
import { ADMIN_BODY } from './admin-body'
import { ADMIN_JS } from './admin-js'

const HEAD = String.raw`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f9f6e" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0b1220" media="(prefers-color-scheme: dark)">
<meta name="robots" content="noindex"><link rel="icon" href="data:,">
<title>لوحة كاسب</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>try{var t=localStorage.getItem('kaseb.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<style>`

export const ADMIN_PAGE = HEAD + ADMIN_CSS + '</style></head><body>' + ADMIN_BODY + '<script>' + ADMIN_JS + '</script></body></html>'
