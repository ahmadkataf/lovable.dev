import { useEffect, type ReactNode } from 'react';
import { Shell } from './components/Shell';
import { Empty, Tile } from './components/Ui';
import { matchPath, navigate, useRoute } from './router';
import { Login } from './screens/Login';
import { Notifications } from './screens/Notifications';
import { MessageNew, MessageThread, MessagesList } from './screens/Messages';
import { TeacherHome } from './screens/TeacherHome';
import { TeacherAttendance } from './screens/TeacherAttendance';
import { TeacherHomework, TeacherHomeworkDetail, TeacherHomeworkNew } from './screens/TeacherHomework';
import { TeacherAbsence } from './screens/TeacherAbsence';
import { StudentHome, StudentTimetable } from './screens/Student';
import { ParentHome } from './screens/Parent';
import { SchoolDashboard } from './screens/SchoolDashboard';
import { SchoolAbsenceNew, SchoolAbsences } from './screens/SchoolAbsences';
import { SchoolAttendance } from './screens/SchoolAttendance';
import { SchoolAnnouncements } from './screens/SchoolAnnouncements';
import { DirectorateCirculars, DirectorateDashboard } from './screens/Directorate';
import { DirectorateSchool } from './screens/DirectorateSchool';
import { DirectorateReport } from './screens/DirectorateReport';
import { AnnouncementsList } from './screens/Announcements';
import { boot, roleHome, useStore } from './store';
import type { Role } from './types';

function Sky() {
  return (
    <div className="sky" aria-hidden="true">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
    </div>
  );
}

function NotFound() {
  return (
    <Tile className="full">
      <Empty icon="info" title="الصفحة غير موجودة" text="العودة إلى الرئيسية من الشريط في الأسفل." />
    </Tile>
  );
}

/** Which role may open a path. */
function allowed(path: string, role: Role): boolean {
  if (path.startsWith('/teacher')) return role === 'teacher';
  if (path.startsWith('/student')) return role === 'student';
  if (path.startsWith('/parent')) return role === 'parent';
  if (path.startsWith('/school')) return role === 'school';
  if (path.startsWith('/directorate')) return role === 'directorate';
  return true;
}

function resolve(path: string): ReactNode {
  let p: Record<string, string> | null;
  if (path === '/notifications') return <Notifications />;
  if (path === '/announcements') return <AnnouncementsList />;
  if (path === '/messages') return <MessagesList />;
  if (path === '/messages/new') return <MessageNew />;
  if ((p = matchPath('/messages/:id', path))) return <MessageThread userId={Number(p.id)} />;

  if (path === '/teacher') return <TeacherHome />;
  if (path === '/teacher/attendance') return <TeacherAttendance />;
  if (path === '/teacher/homework') return <TeacherHomework />;
  if (path === '/teacher/homework/new') return <TeacherHomeworkNew />;
  if ((p = matchPath('/teacher/homework/:id', path))) return <TeacherHomeworkDetail id={Number(p.id)} />;
  if (path === '/teacher/absence') return <TeacherAbsence />;

  if (path === '/student') return <StudentHome />;
  if (path === '/student/timetable') return <StudentTimetable />;

  if (path === '/parent') return <ParentHome />;

  if (path === '/school') return <SchoolDashboard />;
  if (path === '/school/absences') return <SchoolAbsences />;
  if (path === '/school/absences/new') return <SchoolAbsenceNew />;
  if (path === '/school/attendance') return <SchoolAttendance />;
  if (path === '/school/announcements') return <SchoolAnnouncements />;

  if (path === '/directorate') return <DirectorateDashboard />;
  if (path === '/directorate/circulars') return <DirectorateCirculars />;
  if (path === '/directorate/report') return <DirectorateReport />;
  if ((p = matchPath('/directorate/school/:id', path))) return <DirectorateSchool id={Number(p.id)} />;
  return <NotFound />;
}

export function App() {
  const s = useStore();
  const route = useRoute();
  const signedIn = !!s.token && !!s.user;
  const role = s.user?.role;

  useEffect(() => { void boot(); }, []);

  useEffect(() => {
    if (!s.booted) return;
    if (!signedIn) {
      if (route.path !== '/') navigate('/', { replace: true });
      return;
    }
    if (route.path === '/' || (role && !allowed(route.path, role))) navigate(roleHome(role), { replace: true });
  }, [s.booted, signedIn, role, route.path]);

  if (!s.booted) {
    return (
      <>
        <Sky />
        <div className="login" aria-busy="true"><div className="login-card glass"><div className="skel"><i /><i /><i /></div></div></div>
      </>
    );
  }
  if (!signedIn || route.path === '/') {
    return (
      <>
        <Sky />
        <Login />
      </>
    );
  }
  if (role && !allowed(route.path, role)) return <Sky />;
  return (
    <>
      <Sky />
      <Shell>{resolve(route.path)}</Shell>
    </>
  );
}
