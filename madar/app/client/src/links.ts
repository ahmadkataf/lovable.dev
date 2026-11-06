/* Notification deep links. The server names the *thing* a notice is about
   («/homework/5», «/timetable?date=…», «/absences/3»); this maps each one to the
   screen the signed-in role actually has, so a tap never lands on «الصفحة غير
   موجودة». Links the server emits (see server/src):
     /homework/:id[?student_id=]        teacher.ts   homework for students and guardians
     /attendance?date=&student_id=      teacher.ts   a guardian's absence notice
     /absences/:id                      substitute.ts the school account: periods needing cover
     /substitutions/:id                 school.ts    the substitute teacher's assignment
     /timetable?date=&section_id=       school.ts    students and guardians: changed teacher / self-study
     /announcements/:id                 school.ts    guardians (announcement) and school accounts (circular)
     /messages/:userId                  parent.ts    a new message
     /directorate?date=                 directorate.ts  the directorate: a school did not upload / periods without cover
     /directorate/school/:id?date=      directorate.ts  the directorate: one school's page (also «/schools/:id») */

import type { Role } from './types';

const HOME: Record<Role, string> = { teacher: '/teacher', student: '/student', parent: '/parent', school: '/school', directorate: '/directorate' };

export function roleHomePath(role: Role | null | undefined): string {
  return role ? HOME[role] : '/';
}

/** The client route for a server notification link, for the given role; null when there is nothing to open. */
export function resolveLink(link: string | null | undefined, role: Role | null | undefined): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  const home = roleHomePath(role);
  let url: URL;
  try { url = new URL(link, 'http://app.local'); } catch { return null; }
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const q = url.searchParams;
  const date = q.get('date');
  const withDate = (to: string) => (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${to}?date=${date}` : to);
  const seg = path.split('/').filter(Boolean);
  const head = seg[0] ?? '';
  const id = seg[1] && /^\d+$/.test(seg[1]) ? seg[1] : null;

  // Routes the client already has, as emitted.
  if (path === '/notifications' || path === '/messages' || path === '/messages/new') return path;
  if (head === 'messages' && id) return role === 'student' || role === 'directorate' ? home : `/messages/${id}`;
  if (head === 'announcements' && !id) return role === 'school' ? '/school/announcements' : role === 'directorate' ? '/directorate/circulars' : '/announcements';
  if (['teacher', 'student', 'parent', 'school', 'directorate'].includes(head)) {
    const owner = head as Role;
    if (owner !== role) return home;
    // The directorate's own routes: the dashboard, a school page, the weekly report, the circulars.
    if (owner === 'directorate') {
      if (seg.length === 1) return withDate('/directorate');
      if (seg[1] === 'school' && seg[2] && /^\d+$/.test(seg[2])) return withDate(`/directorate/school/${seg[2]}`);
      if (seg[1] === 'report') return `/directorate/report${q.get('week') && /^\d{4}-\d{2}-\d{2}$/.test(q.get('week')!) ? `?week=${q.get('week')}` : ''}`;
      if (seg[1] === 'circulars') return '/directorate/circulars';
      return withDate('/directorate');
    }
    return path + url.search;
  }
  // The directorate reads every other notice on its dashboard or on the school page it concerns.
  if (role === 'directorate') {
    if (head === 'schools' && id) return withDate(`/directorate/school/${id}`);
    if (['attendance', 'absences', 'substitutions', 'timetable', 'students', 'alerts'].includes(head)) {
      const school = q.get('school_id');
      return school && /^\d+$/.test(school) ? withDate(`/directorate/school/${school}`) : withDate('/directorate');
    }
  }

  switch (head) {
    case 'homework':
      if (role === 'teacher') return id ? `/teacher/homework/${id}` : '/teacher/homework';
      return home;
    case 'attendance':
      if (role === 'teacher') return withDate('/teacher/attendance');
      if (role === 'school') return withDate('/school/attendance');
      return home;
    case 'absences':
      if (role === 'school') return withDate('/school/absences');
      if (role === 'teacher') return '/teacher/absence';
      return home;
    case 'substitutions':
      if (role === 'school') return withDate('/school/absences');
      return home;
    case 'timetable':
      if (role === 'student') return withDate('/student/timetable');
      if (role === 'school') return withDate('/school/absences');
      if (role === 'directorate') return withDate('/directorate');
      return home;
    case 'announcements':
      if (role === 'school') return '/school/announcements';
      if (role === 'directorate') return '/directorate/circulars';
      return '/announcements';
    default:
      return home;
  }
}
