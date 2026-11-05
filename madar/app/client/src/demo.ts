/* The one-tap demo accounts shown on the login screen. The same codes exist on
   the real server and in the in-memory mock, so this list must not pull the mock
   module into the production bundle. */

import type { Role } from './types';

export const DEMO_ACCOUNTS: { code: string; name: string; role: Role; hint: string }[] = [
  { code: 'DIR-DARAA', name: 'مديرية التربية · درعا', role: 'directorate', hint: 'لوحة المديرية والتعاميم' },
  { code: 'SCH-1', name: 'إدارة مدرسة درعا النموذجية', role: 'school', hint: 'لوحة المدرسة والغياب والحضور' },
  { code: 'T-SAMER', name: 'أ. سامر حسن', role: 'teacher', hint: 'رياضيات · الخامس والسادس' },
  { code: 'T-RANA', name: 'أ. رنا سعيد', role: 'teacher', hint: 'علوم · غائبة اليوم' },
  { code: 'T-MAHER', name: 'أ. ماهر عادل', role: 'teacher', hint: 'علوم · البديل المقترح' },
  { code: 'S-LAYAN', name: 'ليان أحمد', role: 'student', hint: 'الخامس (ب)' },
  { code: 'P-KHALED', name: 'خالد', role: 'parent', hint: 'وليّ أمر محمد خالد' },
];
