// The topics of the user guide (/guide, /guide/<slug>, /en/guide, /en/guide/<slug>): one file per topic in topics/,
// imported here statically so the Worker's bundle carries them. The list is sorted by each topic's own `order`, so
// the place of a name in it does not matter. Nothing else knows the list: the pages, the home's cards, the side menu,
// previous/next and the links between topics all follow it, and links to a topic not listed yet show as plain text.
// Adding a topic: import its file below and add its name to TOPICS.
import type { GuideTopic } from './types'

import gettingStarted from './topics/getting-started'
import interfaceTopic from './topics/interface'
import dashboard from './topics/dashboard'
import patients from './topics/patients'
import chart from './topics/chart'
import appointments from './topics/appointments'
import treatments from './topics/treatments'
import billing from './topics/billing'
import prescriptions from './topics/prescriptions'
import lab from './topics/lab'
import inventory from './topics/inventory'
import expenses from './topics/expenses'
import reports from './topics/reports'
import settings from './topics/settings'
import staff from './topics/staff'
import backup from './topics/backup'
import licence from './topics/licence'
import faq from './topics/faq'

/** Every published topic, in the guide's order. */
export const TOPICS: readonly GuideTopic[] = [
  gettingStarted, interfaceTopic, dashboard, patients, chart, appointments, treatments, billing, prescriptions, lab,
  inventory, expenses, reports, settings, staff, backup, licence, faq,
].sort((a, b) => a.order - b.order)

/** The topic of a URL slug, or undefined. */
export const topicBySlug = (slug: string): GuideTopic | undefined => TOPICS.find(t => t.slug === slug)

/**
 * The day the guide's text last changed (the <lastmod> of its pages in the sitemap, src/index.ts): move it when a
 * topic's text changes (not for a new picture alone).
 */
export const GUIDE_DATE = '2026-10-18'
