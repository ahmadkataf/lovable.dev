#!/usr/bin/env bash
# Smoke test against a real local Worker: starts `wrangler dev --local` on port 8787 with a fresh Durable Object
# database (schema + seed applied through the admin endpoint), logs in as every demo role, calls the main GET endpoints and one POST per role, prints the
# HTTP codes and exits non-zero on any failure.  Usage: npm run smoke   (or bash scripts/smoke.sh [port])
set -u
cd "$(dirname "$0")/.."
PORT="${1:-8787}"
BASE="http://127.0.0.1:$PORT"
CONFIG=wrangler.local.toml
STATE=.wrangler/smoke-state
TMP="$(mktemp -d)"
LOG="$TMP/wrangler.log"
WRANGLER=./node_modules/.bin/wrangler   # called directly (not via npx) so $WPID is wrangler itself
FAIL=0

# wrangler forks workerd: kill the children first, then wrangler, so no server is left holding the port.
cleanup() { if [[ -n "${WPID:-}" ]]; then pkill -TERM -P "$WPID" 2>/dev/null; kill "$WPID" 2>/dev/null; wait "$WPID" 2>/dev/null; fi; rm -rf "$TMP"; }
trap cleanup EXIT

say() { printf '%s\n' "$*"; }
die() { say "FATAL: $*"; [[ -f "$LOG" ]] && tail -40 "$LOG"; exit 1; }

[[ -x "$WRANGLER" ]] || die "wrangler not installed — run npm install first"
if curl -s -o /dev/null "$BASE/" 2>/dev/null; then die "something already answers on $BASE — stop it or pass another port: bash scripts/smoke.sh 8790"; fi

ADMIN_KEY="smoke-$(date +%s)-$RANDOM"
say "== starting wrangler dev --local on :$PORT with a fresh Durable Object state ($STATE)"
rm -rf "$STATE"
"$WRANGLER" dev --local --config "$CONFIG" --persist-to "$STATE" --port "$PORT" --ip 127.0.0.1 --show-interactive-dev-session=false --var "ADMIN_KEY:$ADMIN_KEY" > "$LOG" 2>&1 &
WPID=$!
# Ready = the admin health probe answers (the Durable Object is reachable, not just the HTTP port).
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/health" -H "x-admin-key: $ADMIN_KEY" 2>/dev/null || true)
  [[ "$code" == "200" ]] && break
  kill -0 "$WPID" 2>/dev/null || die "wrangler dev exited early"
  sleep 1
done
[[ "$code" == "200" ]] || die "wrangler dev did not answer on $BASE (last health code: $code)"
say "   ready after ${i}s"

say "== schema + seed through POST /api/admin/sql"
ADMIN_KEY="$ADMIN_KEY" node scripts/apply-sql.mjs "$BASE" schema.sql seed.sql > "$TMP/sql.log" 2>&1 || { cat "$TMP/sql.log"; die "schema.sql / seed.sql failed"; }
check_admin() {   # the admin key must be required
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/health" -H 'x-admin-key: wrong')
  if [[ "$code" == "403" ]]; then say "ok   admin health without the right key → 403"; else say "FAIL admin health with a wrong key → $code"; FAIL=1; fi
}
check_admin

# check NAME METHOD PATH TOKEN BODY EXPECTED_CODES...   → prints the code, records failures, keeps the body in $BODY
BODY=""
check() {
  local name="$1" method="$2" path="$3" token="$4" data="$5"; shift 5
  local expect=" $* "
  local args=(-s -o "$TMP/body" -w '%{http_code}' -X "$method" "$BASE$path" -H 'content-type: application/json')
  [[ -n "$token" ]] && args+=(-H "authorization: Bearer $token")
  [[ -n "$data" ]] && args+=(--data "$data")
  local code; code=$(curl "${args[@]}")
  BODY="$(cat "$TMP/body")"
  if [[ "$expect" == *" $code "* ]]; then
    printf 'ok   %-6s %-55s %s  %s\n' "$method" "$path" "$code" "$name"
  else
    printf 'FAIL %-6s %-55s %s  %s (expected%s)\n' "$method" "$path" "$code" "$name" "$expect"
    printf '     %s\n' "$(head -c 400 "$TMP/body")"
    FAIL=1
  fi
}
login() {   # login CODE → token on stdout
  curl -s -X POST "$BASE/api/login" -H 'content-type: application/json' --data "{\"code\":\"$1\"}" | jq -r '.token // empty'
}
json() { printf '%s' "$BODY" | jq -r "$1"; }

TODAY=$(TZ=Asia/Damascus date +%F)
# the next Thursday after today: the absence reported below always has affected periods, whatever today is
NEXT_THU=$(for d in 1 2 3 4 5 6 7; do x=$(date -d "$TODAY +$d day" +%F); [[ $(date -d "$x" +%u) == 4 ]] && echo "$x" && break; done)
DUE=$(date -d "$TODAY +3 day" +%F)
say "== today (Damascus): $TODAY · absence demo date: $NEXT_THU"

say "== login as every demo role"
declare -A TOK
for code in DIR-DARAA SCH-1 T-SAMER T-RANA S-LAYAN P-KHALED; do
  TOK[$code]=$(login "$code")
  if [[ -n "${TOK[$code]}" ]]; then say "ok   login $code"; else say "FAIL login $code"; FAIL=1; fi
done
check "wrong code" POST /api/login "" '{"code":"NOPE"}' 401
check "no token" GET /api/me "" "" 401

say "== directorate"
check "me" GET /api/me "${TOK[DIR-DARAA]}" "" 200
check "dashboard" GET "/api/directorate/dashboard?date=$TODAY" "${TOK[DIR-DARAA]}" "" 200
check "report.csv" GET "/api/directorate/report.csv?date=$TODAY" "${TOK[DIR-DARAA]}" "" 200
check "circular" POST /api/announcements "${TOK[DIR-DARAA]}" '{"title":"تعميم تجريبي","body":"نصّ التعميم (اختبار الدخان)."}' 201

say "== school"
check "me" GET /api/me "${TOK[SCH-1]}" "" 200
check "dashboard" GET "/api/school/dashboard?date=$TODAY" "${TOK[SCH-1]}" "" 200
check "sections" GET /api/school/sections "${TOK[SCH-1]}" "" 200
check "teachers" GET /api/school/teachers "${TOK[SCH-1]}" "" 200
check "announcement" POST /api/announcements "${TOK[SCH-1]}" '{"title":"إعلان تجريبي","body":"نصّ الإعلان (اختبار الدخان).","urgent":true}' 201
check "confirm attendance" POST /api/attendance/confirm "${TOK[SCH-1]}" "{\"date\":\"$TODAY\"}" 200

say "== teacher"
check "me" GET /api/me "${TOK[T-SAMER]}" "" 200
check "home" GET /api/teacher/home "${TOK[T-SAMER]}" "" 200
check "timetable" GET /api/timetable "${TOK[T-SAMER]}" "" 200
check "homework list" GET "/api/homework?section_id=2" "${TOK[T-SAMER]}" "" 200
check "homework detail" GET /api/homework/1 "${TOK[T-SAMER]}" "" 200
check "homework create" POST /api/homework "${TOK[T-SAMER]}" "{\"section_id\":2,\"subject_id\":2,\"title\":\"واجب اختبار الدخان\",\"book_page\":\"42\",\"due_date\":\"$DUE\",\"client_id\":\"smoke-1\"}" 201
check "homework replay" POST /api/homework "${TOK[T-SAMER]}" "{\"section_id\":2,\"subject_id\":2,\"title\":\"واجب اختبار الدخان\",\"due_date\":\"$DUE\",\"client_id\":\"smoke-1\"}" 200
check "roster" GET "/api/sections/2/roster?date=$TODAY&period=3" "${TOK[T-SAMER]}" "" 200
RECORDS=$(json '[.students[] | {student_id, status: (if .student_id == 13 then "absent" else "present" end)}]')
check "attendance" POST /api/attendance "${TOK[T-SAMER]}" "{\"section_id\":2,\"date\":\"$TODAY\",\"period\":3,\"records\":$RECORDS}" 200
check "other school section" GET "/api/homework?section_id=4" "${TOK[T-SAMER]}" "" 403
check "absence → suggestions" POST /api/absences "${TOK[T-RANA]}" "{\"date\":\"$NEXT_THU\",\"reason\":\"اختبار الدخان\"}" 201 200
SUB_ID=$(json '.affected[0].substitution_id // empty')
CAND=$(json '.affected[0].candidates[0].teacher_id // empty')
SUB2=$(json '.affected[1].substitution_id // empty')
say "     affected periods: $(json '[.affected[].period] | join(",")') · first candidate: $(json '.affected[0].candidates[0].name // "—"')"
if [[ -n "$SUB_ID" && -n "$CAND" ]]; then
  check "approve substitute" POST "/api/substitutions/$SUB_ID/approve" "${TOK[SCH-1]}" "{\"teacher_id\":$CAND,\"lesson_note\":\"متابعة الدرس من الكتاب\"}" 200
else
  say "FAIL no substitution/candidate to approve"; FAIL=1
fi
if [[ -n "$SUB2" ]]; then
  check "self-study" POST "/api/substitutions/$SUB2/self-study" "${TOK[SCH-1]}" '{"lesson_note":"حلّ تمارين الصفحة ٥٠"}' 200
fi

say "== student"
check "me" GET /api/me "${TOK[S-LAYAN]}" "" 200
check "home" GET /api/student/home "${TOK[S-LAYAN]}" "" 200
check "submit homework" POST /api/homework/1/submit "${TOK[S-LAYAN]}" "" 200
check "notifications" GET /api/notifications "${TOK[S-LAYAN]}" "" 200

say "== parent"
check "me" GET /api/me "${TOK[P-KHALED]}" "" 200
check "home" GET /api/parent/home "${TOK[P-KHALED]}" "" 200
check "message teacher" POST /api/messages "${TOK[P-KHALED]}" '{"to_user":11,"body":"أستاذ سامر، هل يمكن تأجيل تسليم الواجب؟"}' 201
check "threads" GET /api/messages "${TOK[P-KHALED]}" "" 200
check "notifications" GET /api/notifications "${TOK[P-KHALED]}" "" 200
check "announcements" GET /api/announcements "${TOK[P-KHALED]}" "" 200
check "mark read" POST /api/notifications/read "${TOK[P-KHALED]}" '{"all":true}' 200

say "== static shell"
check "SPA fallback" GET /teacher/home "" "" 200
check "API 404" GET /api/nothing "${TOK[DIR-DARAA]}" "" 404

if grep -q '\[SMS\]' "$LOG"; then say "ok   [SMS] stub logged $(grep -c '\[SMS\]' "$LOG") lines"; else say "warn no [SMS] lines in the worker log"; fi
if grep -qiE 'phone' "$TMP/body"; then :; fi
if [[ $FAIL -eq 0 ]]; then say "== SMOKE PASSED"; else say "== SMOKE FAILED"; tail -30 "$LOG"; fi
exit $FAIL
