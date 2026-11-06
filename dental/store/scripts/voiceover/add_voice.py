#!/usr/bin/env python3
"""Put narration clips on a video with ffmpeg (needs ffmpeg + ffprobe on PATH).

  python add_voice.py --video L01.mp4 --clip audio/L01.wav --out final/L01.mp4
  python add_voice.py --video L02.mp4 --clip s1.wav@0 --clip s2.wav@14.5 --clip s3.wav@41 --out final/L02.mp4 --mode mix

--clip FILE[@SECONDS]   a narration clip and the second where it starts in the video (default 0). Repeatable.
--mode replace|mix      drop the video's own audio (default) or keep it quietly underneath (--bg-volume).
If the narration runs past the end of the video, the last frame is frozen to cover it;
if it ends earlier, silence fills the rest. Narration is loudness-normalised (default -16 LUFS).
"""
import argparse, json, os, subprocess, sys


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                          "-of", "json", path], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"ffprobe failed on {path}: {out.stderr.strip()}")
    info = json.loads(out.stdout)
    kinds = {s.get("codec_type") for s in info.get("streams", [])}
    return float(info["format"]["duration"]), "audio" in kinds, "video" in kinds


def parse_clip(spec):
    path, start = spec, 0.0
    if "@" in spec:
        head, _, tail = spec.rpartition("@")
        try:
            start, path = float(tail), head
        except ValueError:
            pass
    if not os.path.isfile(path):
        sys.exit(f"Clip not found: {path}")
    dur, has_audio, _ = probe(path)
    if not has_audio:
        sys.exit(f"No audio stream in clip: {path}")
    return start, dur, path


def main():
    p = argparse.ArgumentParser(description="Put narration on a video")
    p.add_argument("--video", required=True)
    p.add_argument("--clip", action="append", required=True, help="FILE or FILE@SECONDS (repeatable)")
    p.add_argument("--out", required=True)
    p.add_argument("--mode", choices=["replace", "mix"], default="replace")
    p.add_argument("--bg-volume", type=float, default=0.12, help="original audio level in --mode mix")
    p.add_argument("--lufs", type=float, default=-16.0, help="narration loudness target")
    p.add_argument("--tail", type=float, default=0.5, help="seconds to keep after the last word")
    a = p.parse_args()

    vdur, v_audio, v_video = probe(a.video)
    if not v_video:
        sys.exit("No video stream in --video")
    clips = sorted(parse_clip(c) for c in a.clip)
    for (s1, d1, p1), (s2, _, p2) in zip(clips, clips[1:]):
        if s1 + d1 > s2:
            print(f"WARNING: {os.path.basename(p1)} ends at {s1 + d1:.2f}s but {os.path.basename(p2)} "
                  f"starts at {s2:.2f}s (overlap {s1 + d1 - s2:.2f}s) - move it later or shorten the text.",
                  file=sys.stderr)
    nar_end = max(s + d for s, d, _ in clips)
    total = max(vdur, nar_end + a.tail)
    extend = total - vdur

    inputs, graph, labels = ["-i", a.video], [], []
    for i, (start, _, path) in enumerate(clips, 1):
        inputs += ["-i", path]
        graph.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=mono,adelay={int(round(start * 1000))}[c{i}]")
        labels.append(f"[c{i}]")
    mix = f"amix=inputs={len(labels)}:duration=longest:normalize=0" if len(labels) > 1 else "anull"
    graph.append(f"{''.join(labels)}{mix},loudnorm=I={a.lufs}:TP=-1.5:LRA=11,"
                 f"aresample=48000,aformat=channel_layouts=stereo[nar]")
    if a.mode == "mix" and v_audio:
        graph.append(f"[0:a]aresample=48000,aformat=channel_layouts=stereo,volume={a.bg_volume}[bg]")
        graph.append("[nar][bg]amix=inputs=2:duration=longest:normalize=0,apad[aout]")
    else:
        if a.mode == "mix":
            print("Note: video has no audio track; using replace mode.", file=sys.stderr)
        graph.append("[nar]apad[aout]")

    if extend > 0.04:   # narration longer than the video -> freeze the last frame
        graph.append(f"[0:v]tpad=stop_mode=clone:stop_duration={extend:.3f}[vout]")
        vargs = ["-map", "[vout]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
    else:               # video untouched
        vargs = ["-map", "0:v:0", "-c:v", "copy"]

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *inputs, "-filter_complex", ";".join(graph),
           *vargs, "-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
           "-t", f"{total:.3f}", "-movflags", "+faststart", a.out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ffmpeg failed:\n" + r.stderr[-3000:])
    odur, _, _ = probe(a.out)
    print(f"DONE {a.out}: {odur:.2f}s (video was {vdur:.2f}s, narration ends {nar_end:.2f}s"
          + (f", last frame frozen +{extend:.2f}s" if extend > 0.04 else "") + ")")


if __name__ == "__main__":
    main()
