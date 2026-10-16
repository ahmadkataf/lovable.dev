#!/usr/bin/env python3
"""One Gemini TTS request for one section, within the free tier's rules (store/voiceover/README.md).

  python3 store/scripts/voiceover/run_tts.py --lesson L01-getting-started --voice <id> [--out FILE] [--allow-reserve]

- Never regenerates: an existing output is skipped (gemini_tts.py does the same).
- At most 8 requests per quota day (midnight to midnight Pacific time), keeping 2 of the 10 for retakes
  (--allow-reserve uses them). Every request is logged in store/voiceover/requests.csv.
- At least 25 seconds between two requests.
- Exit codes as gemini_tts.py: 0 saved or skipped, 3 daily quota used up (stop, resume after the reset),
  1 other error; 4 = this script's own daily budget is spent (not a request was sent).
- Updates the section's row in manifest.csv after the file is written (status generated, or quota/error).
The key comes from GEMINI_API_KEY only; it is never printed or written anywhere.
"""
import argparse, csv, datetime, os, subprocess, sys, time, wave
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.normpath(os.path.join(HERE, "../../voiceover"))
LOG = os.path.join(WORK, "requests.csv")
MANIFEST = os.path.join(WORK, "manifest.csv")
MODEL = "gemini-3.8-flash-tts"
STYLE = "clear, friendly instructor"
DAILY, RESERVE, GAP = 10, 2, 25


def quota_day(t=None):
    return (t or datetime.datetime.now(datetime.timezone.utc)).astimezone(ZoneInfo("America/Los_Angeles")).date().isoformat()


def log_rows():
    if not os.path.exists(LOG):
        return []
    with open(LOG, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def log(row):
    new = not os.path.exists(LOG)
    with open(LOG, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["utc", "quota_day", "lesson", "voice", "out", "exit", "seconds", "audio_seconds"])
        if new:
            w.writeheader()
        w.writerow(row)


def set_status(lesson, status, wav=None):
    with open(MANIFEST, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        cols = rows[0].keys() if rows else ["lesson", "section", "script", "wav", "start_sec", "status"]
    for r in rows:
        if r["lesson"] == lesson and r["section"] == "s1":
            r["status"] = status
            if wav:
                r["wav"] = wav
    with open(MANIFEST, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(cols), lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--lesson", required=True, help="e.g. L01-getting-started")
    p.add_argument("--voice", required=True)
    p.add_argument("--out", help="default audio/<lesson>_s1.wav")
    p.add_argument("--allow-reserve", action="store_true")
    p.add_argument("--status", default="generated", help="manifest status after success")
    a = p.parse_args()
    if not os.environ.get("GEMINI_API_KEY"):
        sys.exit("Set GEMINI_API_KEY in the environment.")
    script = os.path.join(WORK, "scripts", f"{a.lesson}_s1.txt")
    out = a.out or os.path.join(WORK, "audio", f"{a.lesson}_s1.wav")
    if os.path.exists(out) and os.path.getsize(out) > 44:
        print(f"SKIP (already exists): {os.path.relpath(out, WORK)}")
        return 0
    rows = log_rows()
    today = quota_day()
    sent = [r for r in rows if r["quota_day"] == today and r["exit"] != "skip"]
    budget = DAILY if a.allow_reserve else DAILY - RESERVE
    if len(sent) >= budget:
        print(f"BUDGET: {len(sent)} requests already sent on quota day {today} (budget {budget}); resume after midnight Pacific.")
        return 4
    if rows:
        last = datetime.datetime.fromisoformat(rows[-1]["utc"])
        wait = GAP - (datetime.datetime.now(datetime.timezone.utc) - last).total_seconds()
        if wait > 0:
            time.sleep(wait)
    started = datetime.datetime.now(datetime.timezone.utc)
    cmd = [sys.executable, "-I", os.path.join(HERE, "gemini_tts.py"), "--in", script, "--out", out,
           "--model", MODEL, "--voice", a.voice, "--style", STYLE]
    r = subprocess.run(cmd, capture_output=True, text=True)
    key = os.environ["GEMINI_API_KEY"]
    for stream in (r.stdout, r.stderr):
        if stream.strip():
            print(stream.replace(key, "<KEY>").strip()[-3000:], file=sys.stderr if stream is r.stderr else sys.stdout)
    secs = (datetime.datetime.now(datetime.timezone.utc) - started).total_seconds()
    audio = ""
    if r.returncode == 0 and os.path.exists(out):
        with wave.open(out) as w:
            audio = f"{w.getnframes() / w.getframerate():.1f}"
    log({"utc": started.isoformat(timespec="seconds"), "quota_day": quota_day(started), "lesson": a.lesson, "voice": a.voice,
         "out": os.path.relpath(out, WORK), "exit": r.returncode, "seconds": f"{secs:.0f}", "audio_seconds": audio})
    if r.returncode == 0:
        if not a.out:
            set_status(a.lesson, a.status, os.path.relpath(out, WORK))
    elif r.returncode == 3:
        set_status(a.lesson, "waiting-quota")
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
