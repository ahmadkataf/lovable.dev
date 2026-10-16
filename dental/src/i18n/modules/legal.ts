import type { ModuleDict } from '../types'

// Strings of the "legal" module (privacy policy, terms of use, open-source notices). Keys are used as t('legal.<key>').
// Keep ar and en in step. The documents themselves (legal.privacy.body, legal.terms.body) live in
// features/legal/docs.ts and are added to this module when a document is opened (loadLegalDocs).
const legal: ModuleDict = {
  ar: {
    privacy: 'سياسة الخصوصية',
    terms: 'شروط الاستخدام',
    notices: 'تراخيص المصادر المفتوحة',
    legalTitle: 'الخصوصية والشروط',
    legalSub: 'كيف تُحفظ بيانات مرضاك، وشروط استخدام البرنامج، والبرمجيات المفتوحة المصدر التي يتضمنها',
    updated: 'آخر تحديث: {date}',
    readIn: 'English',
    acceptLabel: 'قرأت شروط الاستخدام وسياسة الخصوصية وأوافق عليهما',
    acceptNeeded: 'يجب الموافقة على شروط الاستخدام للمتابعة',
    acceptedOn: 'وافقت العيادة على شروط الاستخدام في {date}',
    'notices.intro': 'يتضمن Dentora برمجيات وخطوطاً مفتوحة المصدر، نشكر مطوّريها. فيما يلي كل منها مع إصداره وحقوق نشره ونص ترخيصه كاملاً.',
    'notices.software': 'البرمجيات',
    'notices.fonts': 'الخطوط',
    'notices.showText': 'عرض نص الترخيص',
    'notices.hideText': 'إخفاء نص الترخيص',
    'notices.noticeFile': 'ملف NOTICE',
    'notices.count': '{n, plural, one {مكوّن واحد} two {مكوّنان} few {# مكوّنات} many {# مكوّناً} other {# مكوّن}}',
    // short names for the switch at the top of the dialog (three fit side by side on a phone)
    'tab.privacy': 'الخصوصية',
    'tab.terms': 'الشروط',
    'tab.notices': 'التراخيص',
  },
  en: {
    privacy: 'Privacy policy',
    terms: 'Terms of use',
    notices: 'Open-source licences',
    legalTitle: 'Privacy & terms',
    legalSub: 'How your patients’ data is kept, the terms of use, and the open-source software inside the app',
    updated: 'Last updated: {date}',
    readIn: 'العربية',
    acceptLabel: 'I have read and accept the terms of use and the privacy policy',
    acceptNeeded: 'Please accept the terms of use to continue',
    acceptedOn: 'The clinic accepted the terms of use on {date}',
    'notices.intro': 'Dentora includes open-source software and fonts, and we thank their authors. Each one is listed below with its version, copyright and the full text of its licence.',
    'notices.software': 'Software',
    'notices.fonts': 'Fonts',
    'notices.showText': 'Show licence text',
    'notices.hideText': 'Hide licence text',
    'notices.noticeFile': 'NOTICE file',
    'notices.count': '{n, plural, one {1 component} other {# components}}',
    'tab.privacy': 'Privacy',
    'tab.terms': 'Terms',
    'tab.notices': 'Licences',
  },
}
export default legal
