"""
Replay ขั้น [VAD Pre-filter] แบบออฟไลน์: ตัวกรองเดิม (tag baseline-ch4) เทียบกับตัวกรองใหม่ (working tree)

อินพุตจริง:
  - transcript : eval/<clip>/preview*.json  (เวลาของท่อนไม่ถูกแก้ตอน AI-correct)
  - VAD        : eval/vad-filter-fix/vad_segments.json (Silero ตัวเดิม พารามิเตอร์เดียวกับ tasks.py:307
                 — ตรวจแล้วว่าตรงกับ log ตอนรันจริง ดู vad_measure.py)
ไม่เรียก Gemini/Whisper — ตรวจได้เฉพาะ "สิ่งที่ตัวกรองส่งต่อให้ Gemini" ไม่ใช่ผลการตัดสุดท้าย

รัน: python eval/tools/vad_filter_replay.py   (จาก root ของโปรเจกต์)
"""
import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
import contextlib, io, json, os, re, subprocess, sys, types

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.chdir(ROOT)

# ── ตัวกรองเดิม: ดึงซอร์สจาก git tag ตรง ๆ ไม่เขียนใหม่จากความจำ ──────────────────
old_src = subprocess.run(["git", "show", "baseline-ch4:backend/core/ai_logic.py"],
                         capture_output=True, text=True, encoding="utf-8", check=True).stdout
m = re.search(r"^def filter_transcript_by_vad.*?^    return filtered\n", old_src, re.S | re.M)
old_ns: dict = {}
exec(m.group(0), old_ns)
old_filter = old_ns["filter_transcript_by_vad"]

# ── ตัวกรองใหม่: import ai_logic จริง (stub เฉพาะไลบรารีหนักที่ไม่จำเป็นต่อฟังก์ชันนี้) ──
os.environ.setdefault("GEMINI_API_KEY", "x")
for name in ["google", "google.genai", "google.genai.errors", "google.genai.types",
             "faster_whisper", "dotenv", "core.visual_logic"]:
    sys.modules[name] = types.ModuleType(name)
sys.modules["google"].genai = sys.modules["google.genai"]
sys.modules["google.genai"].errors = sys.modules["google.genai.errors"]
sys.modules["google.genai"].types = sys.modules["google.genai.types"]
sys.modules["faster_whisper"].WhisperModel = object
sys.modules["faster_whisper"].BatchedInferencePipeline = object
sys.modules["dotenv"].load_dotenv = lambda *a, **k: None
sys.modules["core.visual_logic"].pick_keyframe_times = None
sys.modules["core.visual_logic"].extract_keyframes = None
sys.path.insert(0, os.path.join(ROOT, "backend"))
with contextlib.redirect_stdout(io.StringIO()):
    from core import ai_logic as A

VAD = json.load(open("eval/vad-filter-fix/vad_segments.json", encoding="utf-8"))
CLIPS = {  # clip -> (ไฟล์ transcript, label)
    "V01": ("eval/V01/preview_pre-baseline.json", "V01"), "V02": ("eval/V02/preview.json", "V02"),
    "V03": ("eval/V03/preview_summary-mode-run.json", "V03"), "V04": ("eval/V04/preview.json", "V04"),
    "V05": ("eval/V05/preview.json", "V05"), "V06": ("eval/V06/preview_full.json", "V06"),
    "V07": ("eval/V07/preview.json", "V07"),
}
LOG_CHARS = {  # "[Transcript] N segments, C chars" จาก worker.log ตอนรันจริง (เฉพาะที่มี log)
    "V02": (6, 983), "V05": (12, 1923), "V06": (11, 2113), "V07": (0, 2)}


def run(fn, tr, voice):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        kept = fn(tr, voice)
    return kept, buf.getvalue()


def chars(segs):
    return len(json.dumps(A._slim_for_gemini(segs), ensure_ascii=False))


def speech_withheld(tr, kept, voice):
    kept_ids = {id(s) for s in kept}
    return sum(A._voiced_ratio(s["start"], s["end"], voice) * (s["end"] - s["start"])
               for s in tr if id(s) not in kept_ids)


results = {}
print("ตัวกรองใหม่: VAD_PREFILTER_MIN_SPEECH = %.2f\n" % A.VAD_PREFILTER_MIN_SPEECH)
print("%-4s | %-9s | %-21s | %-21s | %-15s | %-15s" % (
    "clip", "ท่อนทั้งหมด", "เดิม kept / ทิ้ง", "ใหม่ kept / ทิ้ง", "chars เดิม→ใหม่", "เสียงพูดที่ถูกกัน (วินาที) เดิม→ใหม่"))
for clip, (path, _) in CLIPS.items():
    tr = json.load(open(path, encoding="utf-8"))["transcript"]; voice = VAD[clip]["voice_segments"]
    ko, _ = run(old_filter, tr, voice); kn, log_new = run(A.filter_transcript_by_vad, tr, voice)
    wo, wn = speech_withheld(tr, ko, voice), speech_withheld(tr, kn, voice)
    results[clip] = {"segments": len(tr), "old_kept": len(ko), "new_kept": len(kn), "old_chars": chars(ko), "new_chars": chars(kn),
                     "speech_withheld_old_s": round(wo, 1), "speech_withheld_new_s": round(wn, 1),
                     "newly_kept": [(round(s["start"], 1), round(s["end"], 1)) for s in kn if id(s) not in {id(x) for x in ko}],
                     "newly_dropped": [(round(s["start"], 1), round(s["end"], 1)) for s in ko if id(s) not in {id(x) for x in kn}],
                     "new_log": log_new.strip().splitlines()}
    print("%-4s | %-11d | %-2d / %-16d | %-2d / %-16d | %5d → %-8d | %5.1f → %.1f" % (
        clip, len(tr), len(ko), len(tr) - len(ko), len(kn), len(tr) - len(kn), chars(ko), chars(kn), wo, wn))

print("\nตรวจ replay ตัวกรองเดิมกับ log จริง ([Transcript] N segments, C chars):")
for clip, (n, c) in LOG_CHARS.items():
    r = results[clip]
    print("  %s: log = %d ท่อน/%d chars | replay = %d ท่อน/%d chars | ท่อน: %s" % (
        clip, n, c, r["old_kept"], r["old_chars"], "ตรง" if n == r["old_kept"] else "ไม่ตรง"))
print("  (chars ต่างเล็กน้อยได้ เพราะ preview.json เก็บข้อความหลัง AI-correct ; จำนวนท่อนต้องตรง)")

print("\nท่อนที่ตัวกรอง 'ใหม่' ให้ผลต่างจากเดิม และ log ที่ตัวกรองใหม่พิมพ์:")
for clip, r in results.items():
    if r["newly_kept"] or r["newly_dropped"]:
        print("  %s  เก็บเพิ่ม=%s  ทิ้งเพิ่ม=%s" % (clip, r["newly_kept"], r["newly_dropped"]))
    for l in r["new_log"]:
        if clip in ("V02", "V06", "V07") or "DROP" in l:
            print("     ", clip, l)

# ── ความไวต่อเกณฑ์: ผลการตัดสินเปลี่ยนที่เกณฑ์ไหน ─────────────────────────────────
print("\nความไวต่อเกณฑ์ (จำนวนท่อนที่ถูกเก็บ / ทั้งหมด ต่อคลิป):")
ths = [0.0, 0.05, 0.10, 0.20, 0.30, 0.40, 0.45, 0.46, 0.50]
print("  เกณฑ์ " + " ".join("%5.2f" % t for t in ths))
orig = A.VAD_PREFILTER_MIN_SPEECH
sens = {}
for clip, (path, _) in CLIPS.items():
    tr = json.load(open(path, encoding="utf-8"))["transcript"]; voice = VAD[clip]["voice_segments"]; row = []
    for t in ths:
        A.VAD_PREFILTER_MIN_SPEECH = t
        row.append(len(run(A.filter_transcript_by_vad, tr, voice)[0]))
    sens[clip] = row
    print("  %-5s " % clip + " ".join("%2d/%-2d " % (k, len(tr)) for k in row))
A.VAD_PREFILTER_MIN_SPEECH = orig

# ── กรณีขอบ (สังเคราะห์ ไม่ใช่ข้อมูลจริง — ใช้ตรวจว่าโค้ดทำงานตามสัญญา ไม่ใช่วัดคุณภาพ) ──
print("\nกรณีขอบ (ข้อมูลสังเคราะห์ ตรวจพฤติกรรมของโค้ด):")
voice = [{"start": 10.0, "end": 20.0}]
cases = {
    "ท่อนเงียบล้วน 30-35 → ต้องทิ้ง": ([{"start": 30.0, "end": 35.0, "text": "x"}], 0),
    "ท่อนอยู่ในเสียงพูดเต็ม 11-19 → ต้องเก็บ": ([{"start": 11.0, "end": 19.0, "text": "x"}], 1),
    "ท่อนคร่อมขอบ (speech 25%: 18-26) → ต้องเก็บ": ([{"start": 18.0, "end": 26.0, "text": "x"}], 1),
    "ท่อนคร่อมขอบ (speech 10%: 19-29) → ต้องทิ้ง": ([{"start": 19.0, "end": 29.0, "text": "x"}], 0),
    "ท่อนไม่มีความยาวในเสียงพูด 15-15 → ต้องเก็บ": ([{"start": 15.0, "end": 15.0, "text": "x"}], 1),
    "ท่อนไม่มีความยาวนอกเสียงพูด 40-40 → ต้องทิ้ง": ([{"start": 40.0, "end": 40.0, "text": "x"}], 0),
}
ok = True
for name, (tr, expect) in cases.items():
    got = len(run(A.filter_transcript_by_vad, tr, voice)[0]); good = got == expect; ok &= good
    print("  %-50s -> เก็บ %d (คาด %d) %s" % (name, got, expect, "PASS" if good else "FAIL"))
tr = [{"start": 0.0, "end": 5.0, "text": "x"}]
fb = run(A.filter_transcript_by_vad, tr, [])[0]; good = fb == tr; ok &= good
print("  %-50s -> %s" % ("ไม่มีข้อมูล VAD → ต้องคืน transcript เดิมทั้งหมด", "PASS" if good else "FAIL"))
print("  กรณีขอบทั้งหมด:", "PASS" if ok else "FAIL")

json.dump({"threshold": orig, "clips": results, "sensitivity": {"thresholds": ths, "kept": sens}},
          open("eval/vad-filter-fix/replay_results.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
