# Madar MVP (pilot build) — technical specification

This is the contract that the server, client and Android builders implement in parallel. Where this file and the pitch disagree, this file wins for the MVP. Everything user-visible is Arabic (RTL); identifiers, code and this file are English.

## 1. Scope of the MVP

Roles: `directorate`, `school`, `teacher`, `student`, `parent`.
Features: login with a printed access code; timetable; attendance per period; homework per section with submissions; teacher absence → ranked substitute suggestions → principal approves or marks self-study; announcements (school and directorate, urgent flag); notifications in-app; a three-day consecutive-absence alert; dashboards for the school and the directorate; CSV export; offline reading of the timetable and homework and an outbox for attendance and homework written while offline.
Out of scope: SMS gateway (log only), grades/report cards, digital textbooks (homework carries a book page number only), iOS.

## 2. Repository layout

```
madar/app/
  server/        Cloudflare Worker (TypeScript, Hono) + SQLite-backed Durable Object (D1-shaped shim) — owner: server builder
    package.json  wrangler.toml  tsconfig.json
    src/index.ts  src/auth.ts  src/routes/*.ts  src/substitute.ts  src/seed.ts (seed as TS data) 
    schema.sql    seed.sql (generated or hand-written)  test/*.test.ts (vitest)
  client/        Vite + React 18 + TypeScript PWA — owner: client builder
    package.json  vite.config.ts  index.html  public/manifest.webmanifest  public/icon-*.png  public/sw.js
    src/main.tsx  src/api.ts  src/store.ts  src/screens/*.tsx  src/components/*.tsx  src/styles.css
  android/       WebView wrapper + build script — owner: android builder
    AndroidManifest.xml  src/dev/raqeem/madar/MainActivity.java  res/  build-apk.sh  README.md
```
The server serves the built client from `../client/dist` as static assets (wrangler `[assets]`, `run_worker_first = true`, API under `/api/*`). One Worker, name `madar-app`, custom domain `app.madar.raqeem.dev`.

## 3. Data model (SQLite inside a Durable Object, D1-shaped API) — `schema.sql`

```sql
CREATE TABLE schools (id INTEGER PRIMARY KEY, name TEXT NOT NULL, complex TEXT NOT NULL, shifts INTEGER NOT NULL DEFAULT 1);
CREATE TABLE users (id INTEGER PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('directorate','school','teacher','student','parent')),
  name TEXT NOT NULL, school_id INTEGER REFERENCES schools(id), phone TEXT, code TEXT NOT NULL UNIQUE, subject_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE subjects (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE sections (id INTEGER PRIMARY KEY, school_id INTEGER NOT NULL REFERENCES schools(id), grade INTEGER NOT NULL, label TEXT NOT NULL, shift INTEGER NOT NULL DEFAULT 1);
CREATE TABLE students (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id), section_id INTEGER NOT NULL REFERENCES sections(id), guardian_user_id INTEGER REFERENCES users(id), registry_no TEXT);
CREATE TABLE timetable (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES sections(id), day INTEGER NOT NULL CHECK(day BETWEEN 0 AND 4), period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
  subject_id INTEGER NOT NULL REFERENCES subjects(id), teacher_id INTEGER NOT NULL REFERENCES users(id), UNIQUE(section_id, day, period));
CREATE TABLE homework (id INTEGER PRIMARY KEY, section_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, teacher_id INTEGER NOT NULL, title TEXT NOT NULL, details TEXT, book_page TEXT, due_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE submissions (id INTEGER PRIMARY KEY, homework_id INTEGER NOT NULL, student_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'done', submitted_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(homework_id, student_id));
CREATE TABLE attendance (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, date TEXT NOT NULL, period INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('present','absent','late')),
  recorded_by INTEGER NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(student_id, date, period));
CREATE TABLE absences (id INTEGER PRIMARY KEY, teacher_id INTEGER NOT NULL, date TEXT NOT NULL, reason TEXT, reported_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(teacher_id, date));
CREATE TABLE substitutions (id INTEGER PRIMARY KEY, absence_id INTEGER NOT NULL REFERENCES absences(id), timetable_id INTEGER NOT NULL REFERENCES timetable(id),
  substitute_teacher_id INTEGER, status TEXT NOT NULL CHECK(status IN ('suggested','approved','self_study','uncovered')) DEFAULT 'suggested',
  candidates TEXT NOT NULL DEFAULT '[]', lesson_note TEXT, approved_by INTEGER, approved_at TEXT, UNIQUE(absence_id, timetable_id));
CREATE TABLE announcements (id INTEGER PRIMARY KEY, school_id INTEGER, title TEXT NOT NULL, body TEXT NOT NULL, urgent INTEGER NOT NULL DEFAULT 0, created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE messages (id INTEGER PRIMARY KEY, from_user INTEGER NOT NULL, to_user INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), read_at TEXT);
CREATE TABLE notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, link TEXT, sms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), read_at TEXT);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_tt_teacher ON timetable(teacher_id, day); CREATE INDEX idx_att_date ON attendance(date); CREATE INDEX idx_notif_user ON notifications(user_id, read_at);
```
Days: 0 = الأحد … 4 = الخميس. Dates are `YYYY-MM-DD` in Damascus local time (the server computes "today" with `Asia/Damascus`). Periods 1–7 (most sections use 6).

## 4. Authentication and authorisation

- `POST /api/login {code}` → `{token, user}`; codes are printed by the school (seeded, see §8). Token = `base64url(json payload).signature` where signature = HMAC-SHA256(payload, `TOKEN_SECRET` env var; default `dev-secret` when unset). Payload `{uid, role, exp}` (30 days). Sent as `Authorization: Bearer <token>`.
- Every route checks the role and the scope: a teacher only sees sections they teach; a school account only its school; a parent only its children; a student only itself; the directorate everything (read) plus circulars.
- Audit: every write records `(user_id, action, target)` in `audit_log`.
- Rate limit login: 20 attempts per IP per 10 minutes (in-memory map is acceptable for the pilot).

## 5. API contract (all JSON, UTF-8, errors `{error: "<Arabic message>"}` with 4xx/5xx)

Common:
- `GET /api/me` → `{user:{id,role,name,school_id,school_name,subject}, context}` where context is role-specific: teacher `{sections:[{id,grade,label}], subject}`; student `{section:{id,grade,label}, school_name}`; parent `{children:[{student_id,name,section_label,school_name}]}`; school `{school:{id,name,complex}}`; directorate `{schools:[{id,name,complex}]}`.
- `GET /api/notifications` → `[{id,kind,body,link,created_at,read_at}]` (latest 50). `POST /api/notifications/read` `{ids:[...]}`.
- `GET /api/timetable?section_id=|teacher_id=&day=` → `[{id,day,period,subject,subject_id,teacher,teacher_id,section_id,section_label, substitute: {teacher,status}|null}]` (substitute filled for today's approved substitutions).

Teacher:
- `GET /api/teacher/home` → `{today:{day,periods:[timetable rows for today with attendance_taken boolean]}, homework:[last 10 own], absence_today: absence row|null, substitutions_for_me:[today's approved rows where I am the substitute, with section_label, period, subject, lesson_note]}`.
- `POST /api/homework {section_id, subject_id, title, details?, book_page?, due_date}` → creates; notifies every student of the section and each guardian (`kind: 'homework'`). Returns `{id, notified_students, notified_guardians}`.
- `GET /api/homework?section_id=` → list with `submitted_count, student_count`. `GET /api/homework/:id` → details + submissions.
- `POST /api/attendance {section_id, date, period, records:[{student_id,status}]}` → upserts; for each `absent` student creates a guardian notification `kind:'absence'` with `sms=1` (logged, not sent), `confirmed=0` until the school confirms. Returns counts.
- `POST /api/absences {date, reason?}` (teacher reports own absence) → creates the absence and runs the substitute engine (§6); returns `{absence_id, affected:[{substitution_id, period, section_label, subject, candidates:[{teacher_id,name,subject,reason}]}]}`.

Student:
- `GET /api/student/home` → `{today:[timetable rows with substitute], homework:[{id,title,subject,book_page,due_date,done}], notifications_unread}`.
- `POST /api/homework/:id/submit` → marks done.

Parent:
- `GET /api/parent/home` → `{children:[{student_id,name,section_label,school_name,today:{status:'present'|'absent'|'late'|'none', first_period_time}, homework:[...due within 7 days with done], notifications:[last 10]}]}`.
- `POST /api/messages {to_user, body}` → stores + notifies; `GET /api/messages` → threads for me. The teacher's phone number is never returned to parents.

School (principal/deputy account):
- `GET /api/school/dashboard?date=` → `{students, present, present_pct, teachers, teachers_present, uncovered_periods, homework_today, attendance_by_grade:[{grade,pct}], absences:[{absence_id, teacher, subject, substitutions:[{id, period, section_label, status, substitute, candidates}]}]}`.
- `POST /api/absences {teacher_id, date, reason?}` (school records for a teacher) → same as teacher route.
- `POST /api/substitutions/:id/approve {teacher_id, lesson_note?}` → status `approved`; notifies the substitute (`kind:'substitution'` with the lesson note), the section's students and guardians (`kind:'change'`, body without names or reasons: «تغيّر معلّم الحصّة الثالثة اليوم»); audit.
- `POST /api/substitutions/:id/self-study {lesson_note}` → status `self_study`; notifies students/guardians.
- `POST /api/attendance` (same as teacher, any section of the school) and `POST /api/attendance/confirm {date}` → sets `confirmed=1` for the day; absence notifications for that day get `sms=1` only after confirmation (before confirmation they are in-app only).
- `POST /api/announcements {title, body, urgent}` → notifies all parents of the school (`kind:'announcement'`, `sms = urgent`).
- `GET /api/school/sections` → sections with students (for attendance entry).

Directorate:
- `GET /api/directorate/dashboard?date=` → `{schools:[{id,name,complex,students,present_pct,attendance_uploaded(bool),uncovered_periods,coverage_pct,homework_today}], totals:{schools_connected, present_pct, coverage_pct, alerts_count}, alerts:[{kind:'no_attendance'|'uncovered'|'three_days', school, text}], three_day_absences:[{student_name, school, days}]}`.
- `POST /api/announcements {title, body}` (school_id null) → circular to every school account.
- `GET /api/directorate/report.csv?date=` → UTF-8 CSV with BOM (Excel-friendly).

Notification bodies are Arabic, short, no personal data beyond first names. `sms` is a flag only; the server logs `console.log('[SMS]', phone, body)`.

## 6. Substitute engine (`src/substitute.ts`, pure functions + one DB wrapper; unit-tested)

Input: absence (teacher, date). Steps:
1. Affected rows = timetable rows of that teacher on that weekday (period, section, subject).
2. Candidates for each affected row = teachers of the same school who (a) have no timetable row at that day/period, (b) are not absent that date, (c) are not already assigned a substitution at that period that day.
3. Rank: tier 1 same `subject_id`; tier 2 teaches that section (any subject); tier 3 others. Within a tier, fewer substitutions this month first, then fewer weekly periods (timetable rows count), then name.
4. Weekly cap: exclude a candidate whose weekly periods + substitutions this week ≥ `WEEKLY_CAP` (env, default 28). The principal can still approve anyone explicitly.
5. Store the top 3 as `candidates` JSON `[{teacher_id,name,subject,tier,reason}]`, status `suggested`, `substitute_teacher_id` = top candidate or null. If no candidate: `candidates=[]`, status stays `suggested` with a flag the UI shows as «لا بديل متاح — تعلّم ذاتي موجَّه».
6. Notify the school account: «غياب أ. … اليوم: N حصص تحتاج تغطية».

## 7. Client (PWA) — screens and behaviour

Design: reuse the pitch's tokens (fonts Alexandria + IBM Plex Sans Arabic from `madar/site/fonts` copied into `client/public/fonts`; light glass look; role colours: directorate `#2a5bea`, school `#0c7886`, teacher `#6e52f5`, student `#a35f00`, parent `#c9386d`). RTL, Arabic-Indic digits in the UI (`toLocaleString('ar-EG')` or a helper). Phone-first; a bottom tab bar on phones, a side rail ≥ 900px. Every screen is usable at 360px wide.

- Login `/`: logo, «رمز الدخول» input, button; below it a collapsible «حسابات تجريبية» list with one-tap login for the seeded accounts (§8). Stores token in localStorage.
- Teacher: Home (today's periods with «تسجيل الحضور» per period → a roster with present/absent/late toggles, save; «واجب جديد» form; «الإبلاغ عن غياب» button with date + reason → shows the engine result), Homework list + submissions, Notifications.
- Student: Home (today timetable with substitute badges, homework due with «تمّ» checkbox → submit, notifications), simple points counter (10 per submitted homework) shown in the header.
- Parent: child cards (today status, homework due, last notifications), message the teacher (choose child → teacher list of the section → text), notifications.
- School: Dashboard tiles + attendance by grade; Absences board (per absence: affected periods with candidate chips → «اعتماد» / «تعلّم ذاتي» with note); «تسجيل غياب معلّم» form; Attendance entry (section → period → roster) + «تثبيت حضور اليوم» button; Announcements composer (urgent toggle) + list.
- Directorate: Dashboard (totals tiles, schools table sortable, alerts list), Circulars composer, «تنزيل تقرير CSV».
- Shared: notifications bell with unread count; «بيانات تجريبية» pill in the header when the user is a seeded demo account; offline banner «لا اتصال — تعمل من النسخة المحفوظة»; outbox badge «N عمليات بانتظار الإرسال».

Offline: `api.ts` caches every successful GET in localStorage (`cache:<url>` with timestamp) and returns the cached copy when `fetch` fails; POSTs to attendance/homework/submit are queued in `outbox` when offline and replayed in order when `online` fires (idempotent: attendance upserts, homework carries a client-generated `client_id` the server dedupes on — add column `client_id TEXT UNIQUE` to homework). `public/sw.js`: precache the app shell at install, cache-first for `/assets/*` and fonts, network-first for `/api/*` (no caching of POST). `manifest.webmanifest`: name «مَدار», short_name «مَدار», `dir: rtl`, `lang: ar`, theme `#2a5bea`, icons 192/512 generated from `madar/site/icon.svg`.

Build: `npm run build` → `client/dist`. `vite.config.ts` base `/`. Dev proxy `/api` → `http://localhost:8787`.

## 8. Seed data (`seed.sql`, idempotent: `INSERT OR IGNORE`)

Directorate: user `مديرية التربية · درعا` code `DIR-DARAA`.
Schools: (1) «مدرسة درعا النموذجية» complex «درعا المدينة» — full data; (2) «مدرسة (ب) · مجمّع إزرع»; (3) «مدرسة (ج) · مجمّع طفس» — minimal (school account, 2 teachers, 1 section, 8 students, timetable for Sun–Thu).
School 1: school account «إدارة مدرسة درعا النموذجية» code `SCH-1`. Subjects: اللغة العربية، الرياضيات، العلوم، اللغة الإنكليزية، الدراسات الاجتماعية، التربية الرياضية. Teachers (code, name, subject): `T-SAMER` سامر حسن رياضيات; `T-RANA` رنا سعيد علوم; `T-MAHER` ماهر عادل علوم; `T-HIBA` هبة سليم عربي; `T-KHALED` خالد نور دراسات اجتماعية; `T-LINA` لينا فارس إنكليزي; `T-OMAR` عمر سعد تربية رياضية. Sections: الخامس (أ), الخامس (ب), السادس (أ) — 12 students each (neutral names: محمد خالد، ليان أحمد، عبد الرحمن يوسف، سارة عمر، يوسف علي، هبة سامي، أحمد فادي، نور حسام، كرم رامي، جنى باسل، مريم طارق، آدم زياد… vary per section). Students codes `S-<SECTION>-<n>` e.g. `S-5B-01`; demo student `S-LAYAN` ليان أحمد in الخامس (ب). Guardians for 8 students per section, codes `P-<n>`; demo parent `P-KHALED` خالد (guardian of محمد خالد, الخامس (ب)).
Timetable: Sun–Thu, periods 1–6 for the three sections, consistent with the pitch: الخامس (ب) Thursday = ١ عربي (هبة) ٢ رياضيات (سامر) ٣ علوم (رنا) ٤ إنكليزي (لينا) ٥ دراسات (خالد) ٦ رياضة (عمر); سامر free in period 5 on Thursday; ماهر free in period 3 on Thursday (teaches علوم to السادس (أ) other periods).
Seeded state for "today" (the server treats the seed's dates relative to the real current date: seed uses `date('now')` expressions): homework «تمارين الكسور العشرية ص ٤٢» for الخامس (ب) due in 3 days; attendance for the last 5 school days with ~94% present; one student with 3 consecutive absent days (for the alert); absence of رنا سعيد today with the engine run so the school board shows suggestions (ماهر عادل for period 3 of الخامس (ب)); one announcement.

## 9. Deployment (done by the integrator, not the builders)

`madar/app/server/wrangler.toml`:
```toml
name = "madar-app"
main = "src/worker.ts"
compatibility_date = "2025-06-01"
[assets]
directory = "../client/dist"
binding = "ASSETS"
run_worker_first = true
[[durable_objects.bindings]]
name = "MADAR_DO"
class_name = "MadarDB"
[[migrations]]
tag = "v1"
new_sqlite_classes = ["MadarDB"]
[[rules]]
type = "Text"
globs = ["**/*.sql"]
[triggers]
crons = ["0 3 * * *"]          # 06:00 Damascus: fresh demo data every morning
[vars]
WEEKLY_CAP = "28"
APP_URL = "https://app.madar.raqeem.dev"
```
The database is a SQLite-backed Durable Object (`src/do.ts`, one object named `main`); `src/dbshim.ts` exposes it with the D1 `prepare/bind/all/first/run/batch/exec` shape, so routes and tests are storage-agnostic (the available API token had no D1 permission). Commands: `npm ci && npm run build` in client; `npx wrangler secret put TOKEN_SECRET` and `npx wrangler secret put ADMIN_KEY`; `npx wrangler deploy`; first fill with `ADMIN_KEY=… node scripts/apply-sql.mjs https://app.madar.raqeem.dev schema.sql seed.sql`; later `POST /api/admin/reseed` (header `x-admin-key`) or the daily cron; custom domain `app.madar.raqeem.dev` attached through the API.

## 10. Android wrapper

Package `dev.raqeem.madar`, app name «مَدار», minSdk 24, targetSdk 34. A WebView that loads `https://app.madar.raqeem.dev/` with JavaScript, DOM storage and service workers enabled (`WebView.setWebContentsDebuggingEnabled(false)`), handles the back button inside the WebView, opens external links in the browser, shows a bundled offline page (`assets/offline.html`, Arabic) when the first load fails and no cached PWA exists, and a splash with the icon. Build without Gradle using the Android build-tools (aapt2, d8, zipalign, apksigner) like `scripts/build-apk.sh` at the repository root; a keystore `madar/app/android/release.keystore` (alias `madar`, password in README) is created once and committed. Output `madar/site/app/madar.apk` (served by the pitch site at `/app/madar.apk`).

## 11. Quality bar

- `npm test` in server runs vitest: substitute ranking (tiers, cap, fairness), auth scope (a teacher cannot read another school), notification fan-out counts.
- Client builds with zero TypeScript errors; Lighthouse PWA installable; no console errors.
- Every Arabic string proofread (MSA, Syrian ministry register; «الحصّة», «الشعبة», «المرشد النفسي», «أمين السرّ»).
- No secrets in the repository; the API token is never written to a file.
