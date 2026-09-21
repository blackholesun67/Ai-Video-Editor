"""
คำนวณ recall / precision ของผลตัด (preview.json) เทียบเฉลย (ground_truth.txt) — ทำซ้ำได้

นิยาม (ใช้ชุดเดียวกันทั้งค่า Before และ After):
  ช่วงที่ระบบตัด = ส่วนประกอบของ selected_segments ภายใน [0, จุดจบ transcript]
  recall    = วินาทีที่ตัดตรง SHOULD_CUT "ประเภทที่โหมดนั้นอนุญาต" / วินาทีรวมของ SHOULD_CUT ประเภทนั้น
              (full: SILENCE, RETAKE, FILLER, TECH · summary: ทุกประเภทรวม TANGENT) ; ไม่มีเฉลยให้ตัด → N/A
  precision = วินาทีที่ตัดตรง SHOULD_CUT "ทุกประเภท" / วินาทีรวมที่ระบบตัด ; ไม่ได้ตัดเลย → N/A
  นอกเฉลย   = วินาทีที่ตัด ซึ่งไม่อยู่ใน SHOULD_CUT ใดเลย
  ทับ KEEP  = วินาทีที่ตัดทับ SHOULD_KEEP

รัน: python eval/tools/score.py
ค่า After อ่านจาก eval/vad-filter-fix/after/<run>/preview.json — ไม่มีไฟล์ = NOT TESTED
"""
import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.chdir(ROOT)
LINE = re.compile(r"^\s*(\d+):(\d{1,2}(?:\.\d+)?)\s*-\s*(\d+):(\d{1,2}(?:\.\d+)?)\s*\|\s*([A-Za-z\-]+)\s*\|")
ALLOWED = {"full": {"SILENCE", "RETAKE", "FILLER", "TECH"}, "summary": {"SILENCE", "RETAKE", "FILLER", "TECH", "TANGENT"}}

# run -> (เฉลย, preview ก่อนแก้ [baseline], preview หลังแก้ [ต้องรันใหม่จริง])
RUNS = {
    "V02 full":    ("eval/V02/ground_truth.txt", "eval/V02/preview.json",                    "eval/vad-filter-fix/after/V02_full/preview.json"),
    "V03 summary": ("eval/V03/ground_truth.txt", "eval/V03/preview_summary-mode-run.json",   "eval/vad-filter-fix/after/V03_summary/preview.json"),
    "V04 full":    ("eval/V04/ground_truth.txt", "eval/V04/preview.json",                    "eval/vad-filter-fix/after/V04_full/preview.json"),
    "V05 full":    ("eval/V05/ground_truth.txt", "eval/V05/preview.json",                    "eval/vad-filter-fix/after/V05_full/preview.json"),
    "V06 full":    ("eval/V06/ground_truth.txt", "eval/V06/preview_full.json",               "eval/vad-filter-fix/after/V06_full/preview.json"),
    "V06 summary": ("eval/V06/ground_truth.txt", "eval/V06/preview_summary.json",            "eval/vad-filter-fix/after/V06_summary/preview.json"),
    "V07 full":    ("eval/V07/ground_truth.txt", "eval/V07/preview.json",                    "eval/vad-filter-fix/after/V07_full/preview.json"),
}


def parse_gt(path):
    sect, cuts, keeps = None, [], []
    for line in open(path, encoding="utf-8"):
        if line.startswith("["):
            sect = line.split("]")[0][1:]
            continue
        m = LINE.match(line)
        if not m or sect not in ("SHOULD_CUT", "SHOULD_KEEP"):
            continue
        a, b = int(m[1]) * 60 + float(m[2]), int(m[3]) * 60 + float(m[4])
        (cuts if sect == "SHOULD_CUT" else keeps).append((a, b, m[5].upper()))
    return cuts, keeps


def ov(a, b):
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


def score(gt_path, preview_path):
    d = json.load(open(preview_path, encoding="utf-8"))
    tr = d["transcript"]; end = tr[-1]["end"]; mode = d.get("edit_mode", "full")
    sel = sorted((s["start"], s["end"]) for s in d["selected_segments"])
    cuts, prev = [], 0.0
    for s, e in sel:
        if s > prev + 0.01:
            cuts.append((prev, min(s, end)))
        prev = max(prev, e)
    cuts = [(a, b) for a, b in cuts if b > a]
    gt_cut, gt_keep = parse_gt(gt_path)
    allowed = [(a, b) for a, b, t in gt_cut if t in ALLOWED.get(mode, ALLOWED["full"])]
    sys_total = sum(b - a for a, b in cuts)
    hit_all = sum(ov(c, (a, b)) for c in cuts for a, b, _ in gt_cut)
    hit_allowed = sum(ov(c, g) for c in cuts for g in allowed)
    allowed_total = sum(b - a for a, b in allowed)
    return {
        "mode": mode, "cut_s": round(sys_total, 1), "transcript_end": round(end, 1),
        "recall": None if not allowed_total else round(hit_allowed / allowed_total, 4),
        "precision": None if not sys_total else round(hit_all / sys_total, 4),
        "outside_gt_s": round(sys_total - hit_all, 1),
        "keep_violation_s": round(sum(ov(c, (a, b)) for c in cuts for a, b, _ in gt_keep), 1),
        "cuts": [(round(a, 1), round(b, 1)) for a, b in cuts],
    }


def pct(x):
    return "N/A" if x is None else "%.1f%%" % (100 * x)


if __name__ == "__main__":
    out = {}
    print("%-12s | %-7s | %-9s %-9s | %-9s %-9s | %-9s %-9s | %-9s %-9s" % (
        "run", "mode", "recall ก่อน", "หลัง", "prec ก่อน", "หลัง", "นอกเฉลย ก่อน", "หลัง", "ทับKEEP ก่อน", "หลัง"))
    for name, (gt, before, after) in RUNS.items():
        b = score(gt, before)
        a = score(gt, after) if os.path.exists(after) else None
        out[name] = {"before": b, "after": a if a else "NOT TESTED"}
        print("%-12s | %-7s | %-10s %-9s | %-9s %-9s | %-12s %-9s | %-12s %-9s" % (
            name, b["mode"], pct(b["recall"]), pct(a["recall"]) if a else "NOT TESTED", pct(b["precision"]), pct(a["precision"]) if a else "NOT TESTED",
            "%.1fs" % b["outside_gt_s"], ("%.1fs" % a["outside_gt_s"]) if a else "NOT TESTED",
            "%.1fs" % b["keep_violation_s"], ("%.1fs" % a["keep_violation_s"]) if a else "NOT TESTED"))
    print("\nช่วงที่ระบบตัด (ก่อนแก้):")
    for name, v in out.items():
        print("  %-12s %s" % (name, v["before"]["cuts"]))
    json.dump(out, open("eval/vad-filter-fix/metrics.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
