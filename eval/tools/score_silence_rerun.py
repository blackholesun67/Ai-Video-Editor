import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
"""
ให้คะแนนเฉพาะผลจากรอบ rerun (หลัง Gemini quota reset ครั้งที่ 1, 2026-09-22) — ไม่แก้นิยาม ไม่แตะไฟล์เดิม

เรียก S.score() ตัวเดิมจาก score.py กับไฟล์ใน eval/silence-gap/rerun/ เท่านั้น
(แยกจาก score_silence.py ซึ่งอ่าน eval/silence-gap/{after,control-old}/ ของรอบก่อน — ไม่เขียนทับ metrics_three_way.json)

ไฟล์ที่ไม่มี (Gemini 429 ระหว่าง rerun) = NOT TESTED ไม่ใช่ 0

รัน: python eval/tools/score_silence_rerun.py   (จาก root ของโปรเจกต์)
"""
import json, os, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, "eval", "tools"))
import score as S  # noqa: E402  (ใช้ score() / parse_gt() / ov() เดิม)

RUNS = {  # ชื่อ run -> (เฉลย, BEFORE[รอบ VAD-fix], CONTROL[rerun], NEW[rerun])
    "V07 full":    ("eval/V07/ground_truth.txt", "eval/vad-filter-fix/after/V07_full/preview.json", "eval/silence-gap/rerun/control-old/V07_full/preview.json", "eval/silence-gap/rerun/after/V07_full/preview.json"),
    "V06 summary": ("eval/V06/ground_truth.txt", "eval/vad-filter-fix/after/V06_summary/preview.json", "eval/silence-gap/rerun/control-old/V06_summary/preview.json", "eval/silence-gap/rerun/after/V06_summary/preview.json"),
}


def full_score(gt, path):
    if not os.path.exists(path):
        return None
    d = json.load(open(path, encoding="utf-8"))
    r = S.score(gt, path)
    r["all_cut"] = not d["selected_segments"]
    p, rc = r["precision"], r["recall"]
    r["f1"] = None if (p is None or rc is None or (p + rc) == 0) else round(2 * p * rc / (p + rc), 4)
    sil = [(a, b) for a, b, t in S.parse_gt(gt)[0] if t == "SILENCE"]
    r["silence_gt_s"] = round(sum(b - a for a, b in sil), 1)
    r["silence_cut_s"] = round(sum(S.ov(c, (a, b)) for c in r["cuts"] for a, b in sil), 1)
    return r


def pct(x): return "N/A" if x is None else "%.1f%%" % (100 * x)


if __name__ == "__main__":
    out = {}
    for name, (gt, before, control, new) in RUNS.items():
        out[name] = {"before": full_score(gt, before), "control": full_score(gt, control), "new": full_score(gt, new)}
    for name, row in out.items():
        print("=" * 100); print(name)
        print("  %-8s | %-7s %-9s %-7s | %-12s %-13s %-9s | %s" % ("ชุด", "Recall", "Precision", "F1", "นอกเฉลย(s)", "ทับ KEEP(s)", "ตัดรวม(s)", "เงียบตามเฉลยที่ตัด / ทั้งหมด (s)  ช่วงที่ตัด"))
        for tag in ("before", "control", "new"):
            r = row[tag]
            if r is None:
                print("  %-8s | ไม่มีผล (Gemini 429 ระหว่าง rerun — NOT TESTED)" % tag); continue
            flag = "  [ALL_CUT: ไม่เหลือช่วงที่เก็บ — score ด้านบนไม่สะท้อน]" if r["all_cut"] else ""
            print("  %-8s | %-7s %-9s %-7s | %-12.1f %-13.1f %-9.1f | %.1f / %.1f   %s%s" % (tag, pct(r["recall"]), pct(r["precision"]), pct(r["f1"]), r["outside_gt_s"], r["keep_violation_s"], r["cut_s"], r["silence_cut_s"], r["silence_gt_s"], r["cuts"], flag))
    json.dump(out, open("eval/silence-gap/metrics_rerun.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
