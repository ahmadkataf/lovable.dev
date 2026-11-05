-- Madar MVP — D1 (SQLite) schema. Mirrors docs/mvp-spec.md §3 (plus homework.client_id for offline dedupe).
-- Apply: npx wrangler d1 execute madar --local --file=schema.sql   (or --remote on deploy)
CREATE TABLE IF NOT EXISTS schools (id INTEGER PRIMARY KEY, name TEXT NOT NULL, complex TEXT NOT NULL, shifts INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('directorate','school','teacher','student','parent')),
  name TEXT NOT NULL, school_id INTEGER REFERENCES schools(id), phone TEXT, code TEXT NOT NULL UNIQUE, subject_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sections (id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id), grade INTEGER NOT NULL, label TEXT NOT NULL, shift INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), section_id INTEGER NOT NULL REFERENCES sections(id), guardian_user_id INTEGER REFERENCES users(id), registry_no TEXT);
CREATE TABLE IF NOT EXISTS timetable (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES sections(id), day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 4), period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
  subject_id INTEGER NOT NULL REFERENCES subjects(id), teacher_id INTEGER NOT NULL REFERENCES users(id), UNIQUE(section_id, day, period));
CREATE TABLE IF NOT EXISTS homework (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL, title TEXT NOT NULL, details TEXT, book_page TEXT, due_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), client_id TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY, homework_id INTEGER NOT NULL, student_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'done', submitted_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(homework_id, student_id));
CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, date TEXT NOT NULL, period INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('present','absent','late')),
  recorded_by INTEGER NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(student_id, date, period));
CREATE TABLE IF NOT EXISTS absences (id INTEGER PRIMARY KEY, teacher_id INTEGER NOT NULL, date TEXT NOT NULL, reason TEXT, reported_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(teacher_id, date));
CREATE TABLE IF NOT EXISTS substitutions (id INTEGER PRIMARY KEY, absence_id INTEGER NOT NULL REFERENCES absences(id), timetable_id INTEGER NOT NULL REFERENCES timetable(id),
  substitute_teacher_id INTEGER, status TEXT NOT NULL CHECK(status IN ('suggested','approved','self_study','uncovered')) DEFAULT 'suggested',
  candidates TEXT NOT NULL DEFAULT '[]', lesson_note TEXT, approved_by INTEGER, approved_at TEXT, UNIQUE(absence_id, timetable_id));
CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY, school_id INTEGER, title TEXT NOT NULL, body TEXT NOT NULL, urgent INTEGER NOT NULL DEFAULT 0, created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, from_user INTEGER NOT NULL, to_user INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), read_at TEXT);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, link TEXT, sms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), read_at TEXT);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_tt_teacher ON timetable(teacher_id, day);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
