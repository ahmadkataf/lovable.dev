/* The contract has no «teachers of my school» endpoint; derive the list from
   the timetables of the school's sections (cached per session). */

import { useEffect, useState } from 'react';
import * as api from './api';
import type { SectionWithStudents, TimetableRow } from './types';

export interface TeacherOpt { id: number; name: string; subject: string; subject_id: number; sections: number[] }

let cache: TeacherOpt[] | null = null;
let inflight: Promise<TeacherOpt[]> | null = null;

export async function loadSchoolTeachers(force = false): Promise<TeacherOpt[]> {
  if (cache && !force) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const sections = await api.get<SectionWithStudents[]>('/api/school/sections');
    const map = new Map<number, TeacherOpt>();
    for (const sec of sections) {
      const rows = await api.get<TimetableRow[]>(`/api/timetable?section_id=${sec.id}`);
      for (const r of rows) {
        const t = map.get(r.teacher_id) ?? { id: r.teacher_id, name: r.teacher, subject: r.subject, subject_id: r.subject_id, sections: [] };
        if (!t.sections.includes(sec.id)) t.sections.push(sec.id);
        map.set(r.teacher_id, t);
      }
    }
    cache = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    inflight = null;
    return cache;
  })();
  return inflight;
}

export function clearTeachersCache() {
  cache = null;
}

export function useSchoolTeachers(): { teachers: TeacherOpt[] | null; error: string | null } {
  const [teachers, setTeachers] = useState<TeacherOpt[] | null>(cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadSchoolTeachers()
      .then((t) => { if (alive) setTeachers(t); })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : 'تعذّر تحميل قائمة المعلّمين'); });
    return () => { alive = false; };
  }, []);
  return { teachers, error };
}
