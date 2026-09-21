"""วัดสัดส่วนเสียงพูดของทุก transcript segment เทียบกับ VAD จริง + replay ตัวกรอง "เดิม" (midpoint)"""
import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
import json, sys
BASE = "eval"
VAD = json.load(open(f"{BASE}/vad-filter-fix/vad_segments.json", encoding="utf-8"))
PREVIEW = {  # transcript ที่ตัวกรองได้รับตอนรันจริง (preview.json เก็บ transcript ก่อนกรอง — เวลาไม่ถูกแก้ตอน AI-correct)
    "V01": f"{BASE}/V01/preview_pre-baseline.json", "V02": f"{BASE}/V02/preview.json",
    "V03": f"{BASE}/V03/preview_summary-mode-run.json", "V04": f"{BASE}/V04/preview.json",
    "V05": f"{BASE}/V05/preview.json", "V06": f"{BASE}/V06/preview_full.json", "V07": f"{BASE}/V07/preview.json",
}
LOG_REMOVED = {"V02": 1, "V05": 0, "V06": 1, "V07": 2}   # จาก "[VAD Pre-filter] Removed N" ใน worker.log (baseline)

def midpoint_filter(seg, voice):   # ตรรกะเดิมจาก tag baseline-ch4: filter_transcript_by_vad
    mid = (seg["start"] + seg["end"]) / 2
    return any(v["start"] <= mid <= v["end"] for v in voice)

def ratio(seg, voice):
    span = seg["end"] - seg["start"]
    return min(1.0, sum(max(0.0, min(seg["end"], v["end"]) - max(seg["start"], v["start"])) for v in voice) / span) if span > 0 else 0.0

allrows = []
for clip, path in PREVIEW.items():
    tr = json.load(open(path, encoding="utf-8"))["transcript"]; voice = VAD[clip]["voice_segments"]
    dropped = 0
    print("=" * 78); print(clip, "| ท่อน", len(tr), "| VAD:", [(round(v["start"],1), round(v["end"],1)) for v in voice])
    for i, s in enumerate(tr):
        r = ratio(s, voice); keep = midpoint_filter(s, voice); dropped += (not keep)
        allrows.append((clip, i, s["start"], s["end"], r, keep))
        flag = "" if keep else "  <-- ตัวกรองเดิมทิ้ง"
        if (not keep) or r < 0.9: print("  seg%-2d %6.1f-%6.1f dur=%5.1f overlap=%5.1f%%  เดิม=%s%s" % (i, s["start"], s["end"], s["end"]-s["start"], 100*r, "KEEP" if keep else "DROP", flag))
    exp = LOG_REMOVED.get(clip)
    print("  ตัวกรองเดิมทิ้ง %d/%d ท่อน" % (dropped, len(tr)), ("| log จริง: %d -> %s" % (exp, "ตรง" if exp == dropped else "ไม่ตรง")) if exp is not None else "| (ไม่มี log ให้เทียบ)")
print("=" * 78); print("การกระจายของ overlap (ทุกท่อนทุกคลิป = %d ท่อน):" % len(allrows))
rs = sorted(r for *_, r, _ in allrows)
import bisect
for lo, hi in ((0, .001), (.001, .1), (.1, .2), (.2, .3), (.3, .4), (.4, .5), (.5, .6), (.6, .7), (.7, .8), (.8, .9), (.9, .95), (.95, 1.001)):
    n = bisect.bisect_left(rs, hi) - bisect.bisect_left(rs, lo)
    print("  %4.0f%%-%4.0f%%: %3d ท่อน %s" % (100*lo, 100*min(hi,1), n, "#" * n))
print("ท่อนที่ overlap < 95%:", [(c, i, round(s, 1), round(e, 1), round(100*r)) for c, i, s, e, r, k in allrows if r < 0.95])
