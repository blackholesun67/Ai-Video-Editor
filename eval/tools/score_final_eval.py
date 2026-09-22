r"""
คำนวณ recall/precision/F1/นอกเฉลย/ทับ KEEP สำหรับ Final Evaluation Objective 1/2
ใช้ score() เดิมจาก eval/tools/score.py ตรง ๆ (import ไม่ก็อบปี้นิยามมาเขียนใหม่)

ต่างจาก eval/tools/score.py (ซึ่ง RUNS ผูกตายตัวกับโฟลเดอร์ eval/vad-filter-fix/):
  - ครบ 9 case ของ Final Evaluation (รวม V01/V03_full ที่ไม่เคยอยู่ใน RUNS เดิม)
  - รับ root หลายค่า (--root A --root B ...) เพื่อรวมผลจากหลาย "รอบรัน" (n ซ้ำ) เข้าตารางเดียว
    โดยไม่ทับกัน — root แต่ละอันมาจาก harness_unpack.py คนละครั้ง (คนละ --out)
  - ไม่เขียนทับ eval/vad-filter-fix/metrics.json (เขียนไฟล์ผลลัพธ์แยกที่ผู้ใช้ระบุด้วย --json เท่านั้น)

โครงสร้างที่คาดไว้ต่อ root (มาจาก eval/tools/harness_unpack.py --out <root>):
  <root>/after/<case>/preview.json        (โค้ด "new" ตาม /tmp/ai_logic_new.py ตอนรัน)
  <root>/control-old/<case>/preview.json  (โค้ด "old" ตาม /tmp/ai_logic_old.py ตอนรัน)
  <root>/{after,control-old}/<case>/harness.log   (มีเสมอ แม้ preview.json จะไม่มีเพราะ error)

สำหรับ Final Evaluation (ต้องใช้ FINAL CODE ชุดเดียวทั้งหมด — ดู MASTER-MATRIX.md ข้อ 7):
  ให้ก็อบปี้โค้ด HEAD เดียวกัน (1612888) ไปเป็นทั้ง /tmp/ai_logic_old.py และ /tmp/ai_logic_new.py
  ก่อนรัน harness แต่ละครั้ง — ผลที่ได้จาก tag "old"/"new" ในรอบเดียวกันจึงเป็น "run ซ้ำ 2 ครั้ง
  ของโค้ดเดียวกัน" (ใช้วัด variability ได้เลย ไม่ต้องแก้ analysis_harness.py เพิ่ม) ; รันซ้ำ (เปลี่ยน
  --out) กี่รอบก็ได้ตาม n ที่ต้องการ (n=2 ต่อ case = harness 1 ครั้ง ; n=4 = harness 2 ครั้ง เป็นต้น)

รัน (ตัวอย่าง, หลังมี evidence จริงแล้ว — ห้ามรันตอนยังไม่มี Gemini จริง เพราะจะได้แต่ N/A ทั้งตาราง):
  python eval/tools/score_final_eval.py --root eval/final-evaluation/objective1/rep1 \
                                          --root eval/final-evaluation/objective1/rep2 \
                                          --json eval/final-evaluation/objective1/metrics.json
"""
import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")
import argparse, json, os

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT_REPO = os.path.abspath(os.path.join(_HERE, "..", ".."))
if _HERE not in _sys.path:
    _sys.path.insert(0, _HERE)
os.chdir(_ROOT_REPO)  # score() ในสคริปต์เดิมสมมติ CWD = root โปรเจกต์ (เปิด eval/V0x/... แบบ relative)

from score import score  # ใช้ฟังก์ชันเดิม ไม่ก็อบปี้นิยาม recall/precision มาเขียนใหม่

# label -> (ground_truth path, หมายเหตุ)
# ตรงกับ RUNS ใน eval/tools/analysis_harness.py (9 case) ยกเว้น V01 ที่ไม่มีเฉลยจึงไม่อยู่ที่นี่
CASES = {
    "V02_full":    "eval/V02/ground_truth.txt",
    "V03_full":    "eval/V03/ground_truth.txt",   # ⚠️ เฉลยไฟล์นี้เขียนไว้สำหรับ mode summary (มีแค่ TANGENT)
                                                    #    รัน full ได้จริง แต่ recall จะเป็น N/A โดยดีไซน์ของ score.py เอง
                                                    #    (TANGENT ไม่อยู่ใน ALLOWED["full"]) — ไม่ใช่ error ของสคริปต์นี้
    "V03_summary": "eval/V03/ground_truth.txt",
    "V04_full":    "eval/V04/ground_truth.txt",
    "V05_full":    "eval/V05/ground_truth.txt",
    "V06_full":    "eval/V06/ground_truth.txt",
    "V06_summary": "eval/V06/ground_truth.txt",
    "V07_full":    "eval/V07/ground_truth.txt",
}
NO_GT = {"V01_full": "ไม่มี eval/V01/ground_truth.txt — ใช้เป็น sanity run เท่านั้น ไม่มี recall/precision"}


def score_root(root, case, gt_path):
    """คืน dict ผลของ 1 case ใน 1 root แยกตาม tag (new/old) — ไม่มีไฟล์ = สถานะบอกเหตุผล ไม่ใช่ 0"""
    result = {}
    for tag, folder in (("new", "after"), ("old", "control-old")):
        d = os.path.join(root, folder, case)
        pj = os.path.join(d, "preview.json")
        log = os.path.join(d, "harness.log")
        if os.path.exists(pj):
            result[tag] = score(gt_path, pj)
        elif os.path.exists(log):
            # ไม่มี preview.json แต่มี log = harness รันแล้วแต่ error (ตาม harness_unpack.py)
            tail = open(log, encoding="utf-8", errors="replace").read()[-300:]
            result[tag] = {"status": "ERROR", "log_tail": tail}
        else:
            result[tag] = {"status": "NOT RUN"}
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", action="append", required=True,
                     help="โฟลเดอร์ผลลัพธ์จาก harness_unpack.py หนึ่งรอบรัน (ใส่ซ้ำได้หลายครั้งสำหรับ n หลายรอบ)")
    ap.add_argument("--json", default=None, help="path ไฟล์ผลลัพธ์ (ไม่ระบุ = ไม่เขียนไฟล์ พิมพ์อย่างเดียว)")
    args = ap.parse_args()

    out = {}
    for case, gt in CASES.items():
        out[case] = {root: score_root(root, case, gt) for root in args.root}
    for case, note in NO_GT.items():
        out[case] = {"note": note,
                      "runs": {root: score_root_no_gt(root, case) for root in args.root}}

    print(json.dumps(out, ensure_ascii=False, indent=1))
    if args.json:
        os.makedirs(os.path.dirname(args.json) or ".", exist_ok=True)
        json.dump(out, open(args.json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"\nเขียนผลลัพธ์ที่ {args.json}", file=_sys.stderr)


def score_root_no_gt(root, case):
    """สำหรับ V01 (ไม่มีเฉลย): ตรวจแค่ว่า preview.json ถูกสร้างสำเร็จไหม (sanity) ไม่คำนวณ metric"""
    result = {}
    for tag, folder in (("new", "after"), ("old", "control-old")):
        pj = os.path.join(root, folder, case, "preview.json")
        result[tag] = {"status": "OK (sanity, ไม่มีเฉลย)"} if os.path.exists(pj) else {"status": "NOT RUN"}
    return result


if __name__ == "__main__":
    main()
