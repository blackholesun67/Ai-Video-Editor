import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
"""
วัด "ช่วงเงียบ" จากสามแหล่งบนข้อมูลจริงของ 7 คลิป (อ่านอย่างเดียว) เพื่อออกแบบเกณฑ์และ guard

  1. ช่องว่างระหว่าง transcript segment   — สิ่งที่ hint ปัจจุบันใช้ (_long_silence_gaps)
  2. ช่วงเงียบจาก VAD (voice_segments)     — get_silence_gaps() ใน vad_logic.py (ปัจจุบันไม่ถูกเรียกใช้เลย)
  3. ช่องว่างระหว่างคำ (words[])           — ระดับที่ละเอียดที่สุด (CLAUDE.md 3.1)
และตรวจว่า Whisper มีคำเริ่มพูดอยู่ "ภายใน" ช่วงที่ VAD บอกว่าเงียบหรือไม่ (ขัดกันของหลักฐาน)

เฉลย (SHOULD_CUT / SHOULD_KEEP) ใช้ "เทียบผล" เท่านั้น ไม่มีผลต่อการตัดสินใจใดในโค้ด

รัน: python eval/tools/silence_measure.py   (จาก root โปรเจกต์)
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.chdir(ROOT)
VAD = json.load(open("eval/vad-filter-fix/vad_segments.json", encoding="utf-8"))
PREV = {"V01": "eval/V01/preview_pre-baseline.json", "V02": "eval/V02/preview.json", "V03": "eval/V03/preview_summary-mode-run.json",
        "V04": "eval/V04/preview.json", "V05": "eval/V05/preview.json", "V06": "eval/V06/preview_full.json", "V07": "eval/V07/preview.json"}
GT = {c: f"eval/{c}/ground_truth.txt" for c in ("V02", "V03", "V04", "V05", "V06", "V07")}
LINE = re.compile(r"^\s*(\d+):(\d{1,2}(?:\.\d+)?)\s*-\s*(\d+):(\d{1,2}(?:\.\d+)?)\s*\|\s*([A-Za-z\-]+)\s*\|")


def get_silence_gaps(voice_segments, total_duration, min_gap=2.0):   # สำเนาตรงจาก vad_logic.py:108 (ไม่ import เพราะ torch)
    gaps, cursor = [], 0.0
    for seg in sorted(voice_segments, key=lambda x: x["start"]):
        gd = seg["start"] - cursor
        if gd >= min_gap:
            gaps.append({"start": round(cursor, 2), "end": round(seg["start"], 2), "duration": round(gd, 2)})
        cursor = seg["end"]
    if total_duration - cursor >= min_gap:
        gaps.append({"start": round(cursor, 2), "end": round(total_duration, 2), "duration": round(total_duration - cursor, 2)})
    return gaps


def seg_gaps(tr, total, min_gap):  # ตรรกะเดียวกับ _long_silence_gaps ปัจจุบัน
    segs = sorted(tr, key=lambda s: s["start"]); out = []
    if segs[0]["start"] >= min_gap: out.append((0.0, segs[0]["start"]))
    for a, b in zip(segs, segs[1:]):
        if b["start"] - a["end"] >= min_gap: out.append((a["end"], b["start"]))
    if total - segs[-1]["end"] >= min_gap: out.append((segs[-1]["end"], total))
    return out


def word_gaps(tr, min_gap):
    ws = [w for s in tr for w in s.get("words", []) if w.get("start") is not None]; out = []
    for a, b in zip(ws, ws[1:]):
        if b["start"] - a["end"] >= min_gap: out.append((a["end"], b["start"]))
    return out


def gt_of(path):
    cuts, keeps, sect = [], [], None
    for line in open(path, encoding="utf-8"):
        if line.startswith("["): sect = line.split("]")[0][1:]; continue
        m = LINE.match(line)
        if m and sect in ("SHOULD_CUT", "SHOULD_KEEP"):
            (cuts if sect == "SHOULD_CUT" else keeps).append((int(m[1]) * 60 + float(m[2]), int(m[3]) * 60 + float(m[4]), m[5]))
    return cuts, keeps


f1 = lambda L: "[" + ", ".join("%.1f-%.1f(%.1f)" % (a, b, b - a) for a, b in L) + "]"
allvad = []
for clip, path in PREV.items():
    tr = json.load(open(path, encoding="utf-8"))["transcript"]; total = max(s["end"] for s in tr); voice = VAD[clip]["voice_segments"]
    print("=" * 96); print("%s | ท่อน %d | จบ transcript %.1fs" % (clip, len(tr), total))
    print("  (1) ช่องว่างระหว่างท่อน  ≥3.0s : %s" % f1(seg_gaps(tr, total, 3.0)))
    vg = get_silence_gaps(voice, total, 2.0); allvad += [g["duration"] for g in vg]
    print("  (2) ช่วงเงียบจาก VAD     ≥2.0s : %s" % f1([(g["start"], g["end"]) for g in vg]))
    print("  (3) ช่องว่างระหว่างคำ    ≥3.0s : %s" % f1(word_gaps(tr, 3.0)))
    ws = [w for s in tr for w in s.get("words", []) if w.get("start") is not None]
    for g in vg:
        inside = [w for w in ws if g["start"] < w["start"] < g["end"]]
        if inside:
            cover = sum(min(w["end"], g["end"]) - w["start"] for w in inside)
            print("      ⚠ VAD-gap %.1f-%.1f มีคำที่ Whisper เริ่มพูดข้างใน %d คำ (ช่วง %.1f-%.1f, ครอบเวลา %.1fs จาก %.1fs)" % (g["start"], g["end"], len(inside), inside[0]["start"], inside[-1]["start"], cover, g["duration"]))
    if clip in GT:
        c, k = gt_of(GT[clip]); print("  เฉลย SHOULD_CUT: %s | SHOULD_KEEP: %s" % ([(a, b, t) for a, b, t in c], [(a, b) for a, b, _ in k]))
print("=" * 96)
print("การกระจายความยาวของ VAD silence gap (≥2.0s) ทุกคลิป:", sorted(round(x, 1) for x in allvad))
for th in (2.0, 3.0, 4.0, 5.0):
    print("  gap ≥ %.1fs : %d ช่วง" % (th, sum(1 for x in allvad if x >= th)))
