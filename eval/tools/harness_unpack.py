"""
แตกผลจาก analysis_harness.py (harness_out.txt) ออกเป็นไฟล์ preview.json + log ต่อ run
  หลังแก้ (โค้ดใหม่)      -> eval/vad-filter-fix/after/<run>/preview.json , harness.log
  control (โค้ดเดิม)      -> eval/vad-filter-fix/control-old/<run>/preview.json , harness.log
ไม่เขียนทับ baseline เดิม (eval/V0x/...) และไม่เขียนทับไฟล์ที่มีอยู่แล้วของ after/control (ใช้ --force ถ้าจงใจ)

รัน: python eval/tools/harness_unpack.py [ไฟล์ harness_out.txt] [--out รากปลายทาง] [--force]
"""
import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
import json, os, sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
src = args[0] if args else "eval/vad-filter-fix/harness_out.txt"
root = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "eval/vad-filter-fix"
force = "--force" in sys.argv
if "--out" in sys.argv:
    args = [a for a in args if a != root]
    src = args[0] if args else src

raw = open(src, encoding="utf-8", errors="replace").read()
if "@@HARNESS_JSON@@" not in raw:
    sys.exit("ไม่พบ @@HARNESS_JSON@@ ใน %s — harness อาจล้มก่อนจบ (ดู stderr)" % src)
data = json.loads(raw.split("@@HARNESS_JSON@@")[1])
for run, rec in data.items():
    for tag, folder in (("new", "after"), ("old", "control-old")):
        r = rec[tag]; d = os.path.join(root, folder, run); os.makedirs(d, exist_ok=True)
        pj = os.path.join(d, "preview.json")
        if os.path.exists(pj) and not force:
            print("ข้าม (มีอยู่แล้ว ไม่เขียนทับ):", pj); continue
        open(os.path.join(d, "harness.log"), "w", encoding="utf-8").write(r.get("log", ""))
        if not r.get("ok"):
            print("%-12s %-11s ERROR: %s" % (run, folder, r.get("error"))); continue
        json.dump({"edit_mode": r["edit_mode"], "user_prompt": r["user_prompt"], "transcript": r["transcript"],
                   "selected_segments": r["selected_segments"], "segments": r["selected_segments"],
                   "produced_by": "eval/tools/analysis_harness.py (%s ai_logic, transcript ฉีดจาก baseline)" % ("โค้ดใหม่" if tag == "new" else "โค้ดเดิม baseline-ch4"),
                   "analysis_seconds": r["seconds"]}, open(pj, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("%-12s %-11s เขียน %s (%.0fs)" % (run, folder, pj, r["seconds"]))
