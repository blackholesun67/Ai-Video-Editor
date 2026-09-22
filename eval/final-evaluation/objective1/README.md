# Objective 1 — AI Cut Detection

- สถานะเอกสารนี้: **เตรียมความพร้อมเท่านั้น ยังไม่มีการเรียก Gemini จริงหรือสร้างผลการทดลองใด ๆ**
- โค้ดที่จะใช้ทดสอบ (ล็อกไว้ ห้ามเปลี่ยนระหว่างรัน): HEAD `1612888` (VAD Filter Fix + Silence Gap Fix + Snap/Word-Bound Fix รวมกันครบ) แฮช `backend/core/ai_logic.py` (LF-normalized) = `3a67a004…`
- เครื่องมือ: `eval/tools/analysis_harness.py` (แก้แล้วรอบนี้ — เพิ่ม 5 case ใหม่) + `eval/tools/harness_unpack.py` (ไม่แก้) + `eval/tools/score_final_eval.py` (สร้างใหม่รอบนี้, reuse `score()` จาก `eval/tools/score.py` ไม่แก้นิยาม)

---

## Dataset — 9 case (verified ก่อนเขียนเอกสารนี้ ไม่ใช่การเดา)

| Case | Job ID | edit_mode | video_path | GT | หมายเหตุ |
|---|---|---|---|---|---|
| `V01_full` | `8e43cd1d-431d-4f98-9e78-0c72946988e1` | full | ✅ มีไฟล์วิดีโอ+เสียง | ❌ **ไม่มี** `eval/V01/ground_truth.txt` (ยืนยันด้วย `git log --all` = ว่างเปล่า) | ใช้เป็น **sanity run** (pipeline รันจบไหม) เท่านั้น — ห้ามสร้างเฉลยปลอมให้มีตัวเลข |
| `V02_full` | `0e4c606f-d1e1-42dd-a030-6be1cd904465` | full | ✅ | ✅ `eval/V02/ground_truth.txt` | มีผล final-output จากรอบก่อนแล้ว (historical, ดูหมายเหตุท้ายไฟล์) |
| `V03_full` | `9eb88221-4197-463f-8c62-1daed7dd9744` | full | ✅ | ⚠️ `eval/V03/ground_truth.txt` **หัวไฟล์ระบุ `mode: summary`** และมีแค่รายการ TANGENT ใน `[SHOULD_CUT]` | รันได้จริง แต่ **recall จะเป็น N/A โดยดีไซน์** (TANGENT ไม่อยู่ใน `ALLOWED["full"]` ของ `score.py`) — ไม่ใช่บั๊กของ harness ; precision/outside-GT/keep-violation ยังใช้งานได้ตามปกติ |
| `V03_summary` | `e30793df-0e40-4955-9b4f-c196f0574857` | summary | ✅ | ✅ ตรงกับที่ GT เขียนไว้ | เป็น case ที่ตรงกับเจตนาเดิมของผู้เขียนเฉลย |
| `V04_full` | `9590035b-7af5-4e7b-92b9-496ed863a3ba` | full | ✅ | ✅ `eval/V04/ground_truth.txt` | ยังไม่เคยมีผล final-output มาก่อนเลย |
| `V05_full` | `4c4597f3-61a4-437d-a420-28d09f6f010b` | full | ✅ | ✅ `eval/V05/ground_truth.txt` (คลิป "ควบคุมเพื่อวัดว่าตัดเกินไหม" — SHOULD_CUT ว่างเปล่าโดยตั้งใจ) | ยังไม่เคยมีผล final-output มาก่อนเลย ; ใช้วัด over-cutting โดยเฉพาะ |
| `V06_full` | `0772b3c4-8449-48b6-bbb6-f2631a3aae3a` | full | ✅ | ✅ | มีผล final-output จากรอบก่อนแล้ว (historical) |
| `V06_summary` | `20692075-ce67-46ae-aea5-6b9672231db7` | summary | ✅ | ✅ | มีผล final-output จากรอบก่อนแล้ว (historical) |
| `V07_full` | `cc0db657-a323-4516-9f4c-3e8cf5a23685` | full | ✅ | ✅ | มีผล final-output จากรอบก่อนแล้ว (historical) |

**ตรวจแล้วทุก case:** `backend/storage/<job_id>/{preview.json,full_audio.wav,*.mp4}` มีครบ (ตรวจด้วย `ls`/`grep` จริง ไม่ใช่สมมติ) · `preview.json` มี `edit_mode`/`user_prompt`/`transcript`/`video_path`/`output_mode`/`target_length` ครบทุก field ที่ `analyze_video_content()` ต้องใช้

**หมายเหตุเรื่องรายการ 8 case ที่ผู้ใช้ระบุ:** ผู้ใช้ระบุ 8 case (V01, V02, V03 full, V03 summary, V04, V05, V06 full, V07 full) ซึ่ง **ไม่มี V06 summary** — เอกสารนี้เพิ่ม V06 summary เข้าไปด้วยเป็น case ที่ 9 เพราะ (ก) มี Ground Truth ถูกต้องอยู่แล้ว (ข) เคยเป็นส่วนหนึ่งของทุกรอบทดสอบ VAD/Silence Gap ที่ผ่านมา การตัดออกจะทำให้เสียความต่อเนื่องของ historical evidence โดยไม่มีเหตุผลชัดเจน — **รายงานความแตกต่างนี้ไว้ตรงนี้ ไม่ได้ตัดสินใจแทนโดยไม่บอก** ถ้าต้องการเฉพาะ 8 case ตามที่ระบุจริง ๆ ให้สั่งเอา `V06_summary` ออกจาก `RUNS` ใน `analysis_harness.py`

---

## การแก้ไข `eval/tools/analysis_harness.py` รอบนี้

เพิ่ม 5 entry ใหม่ใน `RUNS` dict: `V01_full`, `V03_full`, `V04_full`, `V05_full` (และ `V03_summary` ซึ่งเดิมไม่มี) — ของเดิมมี `V02_full`, `V06_full`, `V06_summary`, `V07_full` อยู่แล้ว รวมเป็น 9 entry ไม่มีการแก้ตรรกะอื่นในไฟล์ (การ vote/loop/output format เดิมทั้งหมด) — diff คือการเพิ่มบรรทัดใน dict เดียวเท่านั้น

**ตรวจแล้ว (ตามที่กำหนด):**
- ✅ input path ถูกต้อง — `storage/{job}/preview.json` และ `storage/{job}/full_audio.wav` มีอยู่จริงทุก job ที่เพิ่มใหม่ (ตรวจด้วย `find`/`ls`)
- ✅ mode ถูกต้อง — `edit_mode` ใน `backend/storage/<job>/preview.json` ตรงกับชื่อ case (`_full`/`_summary`) ทุกตัว
- ✅ Ground Truth ถูกต้อง (มีไฟล์ + parse ได้) — ยกเว้น `V03_full` ที่มีข้อจำกัดเชิงดีไซน์ (ดูตารางด้านบน) และ `V01_full` ที่ไม่มีเฉลยเลย (รายงานไว้ ไม่ได้สร้างเฉลยปลอม)
- ✅ scoring ทำงานครบ — สร้าง `eval/tools/score_final_eval.py` (reuse `score()` เดิม) แล้ว **ทดสอบจริงกับหลักฐานเก่าที่มีอยู่แล้ว** (`eval/vad-filter-fix/{after,control-old}/`, ไม่เรียก Gemini เพราะเป็นไฟล์ preview.json ที่มีอยู่แล้ว) ได้ตัวเลขตรงกับ `metrics_final_three_way.json` เป๊ะทุกค่า (V02 full recall 0.0%, V06 full recall 65.8%/79.4% เป็นต้น) — ยืนยันว่าสคริปต์ทำงานถูกต้องก่อนจะมีข้อมูลจริงของ 5 case ใหม่
- ✅ **โครงสายงานของ harness เอง (ไม่รวม Gemini) ตรวจได้ครบ 9 case แล้วจากหลักฐานที่มีอยู่แล้ว** — `eval/vad-filter-fix/vad_segments.json` (ผล VAD จริงที่ dump ไว้ตั้งแต่รอบ VAD Filter Fix) มีข้อมูลของ **ทั้ง V01–V07 ครบ** ไม่ใช่แค่ 4 คลิปเดิม (`job` ID ในไฟล์นี้ตรงกับ `RUNS` ที่เพิ่มใหม่ทุกตัว: V01=`8e43cd1d…`, V04=`9590035b…`, V05=`4c4597f3…` ตรงเป๊ะ) แปลว่า `HARNESS_DRYRUN=1` (โหมดจำลองที่มีอยู่แล้วในสคริปต์ — ปลอม Gemini ให้ตอบ `[]` เสมอ, ไม่ดึงภาพ) **รองรับครบทั้ง 9 case โดยไม่ต้องเพิ่มข้อมูลอะไรอีก** ถ้าต้องการตรวจโครงสายงานเพิ่มเติมแบบไม่เรียก Gemini จริงในอนาคต ; V03 (ทั้ง full และ summary) ใช้ค่า VAD ชุดเดียวกัน (คีย์ `"V03"` ในไฟล์นี้ผูกกับ job `e30793df…` ของ summary run) เพราะเป็นเสียงต้นฉบับเดียวกัน — สอดคล้องกับที่สคริปต์คอมเมนต์ไว้แล้วสำหรับ V06 full/summary
- ✅ output แยกเป็นราย run — `harness_unpack.py` เขียนผลเป็น `<root>/{after,control-old}/<case>/{preview.json,harness.log}` อยู่แล้ว (ไม่ต้องแก้) ทำงานกับ case ใหม่ได้เหมือน case เดิมทุกประการ (เป็น generic ไม่ hardcode ชื่อ run)
- ✅ ไม่มี hard-code timestamp เพื่อให้ผ่าน Ground Truth — ตรวจทั้ง `analysis_harness.py`, `harness_unpack.py`, `score.py`, `score_final_eval.py` แล้วไม่มีเงื่อนไข `if` ใดอิงชื่อคลิป/ID/timestamp ของเฉลย (มีแค่คอมเมนต์อธิบาย)

---

## Protocol

| หัวข้อ | ค่า |
|---|---|
| Dataset | 9 case ข้างต้น (8 case ที่มี GT ใช้ scoring ได้ + V01 sanity เท่านั้น) |
| Mode | ตาม `edit_mode` ในตาราง — ห้ามเปลี่ยน (ผูกกับ Ground Truth ของแต่ละ case) |
| Gemini model | `gemini-2.5-flash` (ตรึงตลอดทั้งแผน Final Evaluation ตาม `eval/final-evaluation-plan.md` §0.2) |
| Prompt version | ตาม `backend/core/ai_logic.py` ที่ HEAD `1612888` ตรง ๆ ไม่แก้ระหว่างรัน (ดู MASTER-MATRIX.md ข้อ "Code Lock") |
| n ที่จะใช้ | **n=2–3 ต่อ case** ตามคำแนะนำจาก `eval/pre-final-audit.md` §8 (variability สูงมาก พบ recall ต่างกันถึง 42pp ด้วยโค้ด+อินพุตเดียวกัน) — วิธีทำโดยไม่ต้องแก้ script เพิ่ม: copy โค้ด HEAD เดียวกันเป็นทั้ง `/tmp/ai_logic_old.py` และ `/tmp/ai_logic_new.py` ก่อนรัน (ทั้ง tag "old"/"new" จะเป็นโค้ดเดียวกัน = run ซ้ำ 2 ครั้งในตัว) แล้วรัน harness+unpack ซ้ำเป็นรอบ ๆ (`--out .../rep1`, `.../rep2`, ...) จนครบ n ที่ต้องการ |
| Metrics | Recall, Precision, F1 (`2PR/(P+R)`), outside-GT cut (วินาที), KEEP overlap/violation (วินาที) — ทั้งหมดจาก `score()` เดิมไม่แก้นิยาม |
| Error handling | ทุก run ที่ error (429/503/404) ให้ `harness_unpack.py` เขียน `harness.log` ไว้ตามปกติ (ไม่มี `preview.json`) ; `score_final_eval.py` อ่านสถานะนี้เป็น `"status": "ERROR"` พร้อม log tail อัตโนมัติ ไม่ปนกับ run ที่สำเร็จแต่ cuts=[] จริง ; **ห้ามรันซ้ำอัตโนมัติจนสำเร็จ** — เก็บ error แล้วรายงาน |
| การอ่านผล | อ่าน recall คู่กับ precision + outside-GT + keep-violation เสมอ (บทเรียนจาก V02: recall ต่ำอาจมาจาก "ไม่ตัดอะไรเลยเพราะเห็นข้อมูลครบ" ไม่ใช่ตัดพลาด) ; รายงานทุก run แยกรายตัว + ค่าเฉลี่ย/พิสัย ต่อ case ห้ามใช้ n=1 เป็นข้อสรุปสุดท้าย |

## Evidence files (โครงที่คาดไว้ — ยังไม่มีไฟล์จริงในรอบเตรียมความพร้อมนี้)

```
eval/final-evaluation/objective1/
  README.md                 (ไฟล์นี้)
  rep1/after/<case>/{preview.json,harness.log}       ← โค้ด HEAD (tag "new")
  rep1/control-old/<case>/{preview.json,harness.log} ← โค้ด HEAD เดียวกัน (tag "old", = run ซ้ำ)
  rep2/... (ถ้าต้องการ n เพิ่ม)
  metrics.json               ← ผลจาก score_final_eval.py --root rep1 --root rep2 ...
  harness_out.txt / harness_stderr.txt   (ต่อรอบ, เก็บชื่อ rep1_*, rep2_* ไม่ให้ทับกัน)
```

## หมายเหตุ (historical, ไม่ใช่ผลของรอบนี้)

V02, V06 full, V06 summary, V07 full มีผล final-output จากรอบทดสอบ VAD Filter Fix / Silence Gap Fix / Snap-Word-Bound Fix อยู่แล้ว (ดู `eval/vad-filter-fix-report.md`, `eval/silence-gap-report.md`, `eval/snap-wordbound-fix-report.md`) — เป็น **historical evidence จากคนละรอบ/คนละจุดของโค้ด** (บางผลรันด้วยโค้ดที่ยังไม่รวม fix ทั้ง 3 ตัว) **ห้ามนำมารวมเป็นตัวเลข Final Evaluation เดียวกัน** ต้องรันใหม่ด้วยโค้ด HEAD `1612888` ที่ล็อกไว้เท่านั้นตามตาราง Protocol ข้างบน
