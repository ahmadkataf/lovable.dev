// The other software the comparison page names (compare-content.ts and its translations in i18n/), each linked to
// its vendor's site, and the vendors' own pages every statement about them comes from. One list for every language.
export interface Example { name: string; url: string }
export interface Source { label: string; url: string }

export const CURVE: Example = { name: 'Curve Dental', url: 'https://www.curvedental.com/' }
export const DENTALLY: Example = { name: 'Dentally', url: 'https://www.dentally.com/en-gb/' }
export const OPEN_DENTAL: Example = { name: 'Open Dental', url: 'https://www.opendental.com/' }
export const DENTRIX: Example = { name: 'Dentrix', url: 'https://www.dentrix.com/' }
export const EAGLESOFT: Example = { name: 'Eaglesoft', url: 'https://www.pattersondental.com/cp/software/dental-practice-management-software/eaglesoft' }

/**
 * The pages behind every statement about other software, read on COMPARE_DATE; the same list in every language
 * (titles in English, as on the vendors' sites). What each says, briefly:
 *  Curve: cloud-based, needs a browser and the internet; data in AWS data centres; a monthly subscription by quote;
 *    browser on Windows, Mac or Chromebook, plus a companion mobile app; serves the US and Canada; no install.
 *  Dentally: runs in a browser, mobile data as a backup when the line drops; AWS servers in the EU; monthly plans by
 *    number of surgeries (treatment rooms); Windows, Mac and iPad; English sites only; nothing to install, vendor onboarding.
 *  Open Dental: a MySQL/MariaDB server in the office, high-speed internet "a requirement" for service and updates;
 *    a monthly licence-and-support fee per location; Windows client; only Spanish and French translation files.
 *  Dentrix: practice-managed local servers; internet recommended (US) for updates and services; a licence plus an
 *    annual support plan; Windows server and workstations; regional settings supported in English.
 *  Eaglesoft: an on-site physical server; internet not required to function; Service Club memberships (24 months);
 *    Windows server and Windows 11 workstations; no other interface language mentioned.
 */
export const SOURCES: Source[] = [
  { label: 'Curve Dental: FAQ', url: 'https://www.curvedental.com/faq' },
  { label: 'Curve Dental: system requirements', url: 'https://www.curvedental.com/system-requirements' },
  { label: 'Curve Dental: why Curve', url: 'https://www.curvedental.com/why-curve-rocks' },
  { label: 'Curve Dental: about', url: 'https://www.curvedental.com/about' },
  { label: 'Dentally: cloud-based dental software', url: 'https://www.dentally.com/en-gb/cloud-based-dental-software' },
  { label: 'Dentally: security policy', url: 'https://www.dentally.com/en-gb/security-policy' },
  { label: 'Dentally: pricing', url: 'https://www.dentally.com/en-gb/pricing' },
  { label: 'Open Dental: computer requirements', url: 'https://www.opendental.com/site/computerrequirements.html' },
  { label: 'Open Dental: fees for support and services', url: 'https://www.opendental.com/site/fees.html' },
  { label: 'Open Dental: languages', url: 'https://www.opendental.com/manual/languages.html' },
  { label: 'Dentrix: Dentrix or Dentrix Ascend', url: 'https://www.dentrix.com/about-us/dentrix-or-dentrix-ascend/' },
  { label: 'Dentrix: system requirements 2026 (PDF)', url: 'https://ddhp1v396jr5m.cloudfront.net/pdfs/Dentrix/Documentation/Dentrix_2025_System_Requirements.pdf' },
  { label: 'Dentrix: Connected Care Essentials', url: 'https://www.dentrix.com/dental-solutions/dentrix-connected-care-essentials/' },
  { label: 'Patterson Dental: Eaglesoft', url: 'https://www.pattersondental.com/cp/software/dental-practice-management-software/eaglesoft' },
  { label: 'Patterson Dental: Eaglesoft hardware requirements (PDF)', url: 'https://pattersonsupport.custhelp.com/euf/assets/Answers/5001-6000/5073/Eaglesoft_and_CAESY_Hardware_Requirements_08_11_2026.pdf' },
]

