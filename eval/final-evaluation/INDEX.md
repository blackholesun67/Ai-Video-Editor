# สารบัญหลักฐาน Final Evaluation (2026-09-23)

เอกสารนี้คือ "หน้าแรก" สำหรับหาไฟล์หลักฐานทั้งหมดของรอบ Final Evaluation — โฟลเดอร์
`eval/final-evaluation/` นี้เป็นที่รวมหลักฐานทั้งหมดของรอบนี้อยู่แล้ว (สร้างสะสมมาตลอด
ทั้ง session) จึงไม่ย้าย/คัดลอกไฟล์ไปที่ใหม่ — ทำสารบัญนี้เป็นตัวชี้ทางแทน เพื่อไม่ให้เสี่ยง
ทำ path ที่ถูกอ้างอิงไว้ในเอกสารอื่น (`RESULTS-TEMPLATE.md`, `INVESTIGATION-NOTES.md` ฯลฯ) พัง

**เริ่มอ่านจากไฟล์นี้ก่อนเสมอ → [`RESULTS-TEMPLATE.md`](RESULTS-TEMPLATE.md)** (มีหัวข้อ
"🏁 สรุปผลรวมสุดท้าย" อยู่บนสุด สรุปสถานะทุก Objective ในหน้าเดียว)

---

## 1. เอกสารสรุปผล/แผน (อ่านเรียงตามนี้)

| ไฟล์ | คืออะไร |
|---|---|
| [`RESULTS-TEMPLATE.md`](RESULTS-TEMPLATE.md) | **เอกสารหลัก** — ผลลัพธ์จริงทุก Objective (1/2/3/4) + สรุปรวมสุดท้าย + caveat/limitation ทั้งหมด ใช้เขียนบทที่ 4 ได้ตรงนี้ |
| [`EXECUTION-PLAN.md`](EXECUTION-PLAN.md) | แผนก่อนเริ่มรันจริง — นิยาม n ที่ต้องการ, กลยุทธ์ประหยัดโควตา, MINIMUM-SUFFICIENT-TESTS |
| [`REMAINING-TESTS.md`](REMAINING-TESTS.md) | รายการ Objective 3 และ 4B/C/D ที่ยังไม่ได้ทำ — ต้องใช้อะไร/ใครกี่คน/ทำยังไง สำหรับรันตอน deploy จริง |
| [`MASTER-MATRIX.md`](MASTER-MATRIX.md) | ตารางรวม Objective × Condition × สถานะ (ภาพรวมก่อนเริ่มรัน) |
| [`READINESS.md`](READINESS.md) | เช็กลิสต์ความพร้อมก่อนเริ่ม Final Evaluation |

**หลักฐานรอบก่อนหน้า (คนละรอบ คอมมิทแล้วใน `822656f`, ไม่ได้อยู่ในโฟลเดอร์นี้):**
`eval/vad-filter-fix-report.md`, `eval/silence-gap-report.md`, `eval/snap-wordbound-fix-report.md`,
`eval/pre-final-audit.md` — รายงานการแก้บั๊ก 3 จุดหลัก (VAD Filter / Silence Gap / Snap-Word-Bound)
ก่อนเริ่มรอบ Final Evaluation นี้ พร้อม raw evidence ที่ `eval/vad-filter-fix/`, `eval/silence-gap/`,
`eval/snap-wordbound-fix/`

---

## 2. Objective 1 — AI Cut Detection (Audio+Visual, `VISUAL_CONTEXT=1`)

| ไฟล์/โฟลเดอร์ | คืออะไร |
|---|---|
| [`objective1/README.md`](objective1/README.md) | นิยาม case/GT edge-case (V03_full, V05_full เป็น N/A โดยดีไซน์) |
| `objective1/metrics_combined_pretty.txt` | ผลลัพธ์ตัวเลขดิบทุก case/tag/run แบบอ่านง่าย (คำนวณจาก `score_final_eval.py`) |
| `objective1/metrics_combined.json`, `metrics_rep1.json` | ผลลัพธ์รูปแบบ JSON (เครื่องอ่านได้) |
| `objective1/rep1_out.txt` + `rep1/{after,control-old}/<case>/` | **รอบ 1 — pre-fix (HEAD `822656f`)** n=2 ทุก case (9 case) — `preview.json` + `harness.log` ต่อ case |
| `objective1/rep2_out.txt` + `rep2/{after,control-old}/<case>/` | **รอบ 2 — pre-fix** n=4 สำหรับ 6 case หลัก (V07 ได้แค่ 3 เพราะโควตาหมดกลางรัน) |
| `objective1/rep3_out.txt`, `rep3_stderr.txt` + `rep3/{after,control-old}/V07_full/` | **รอบ 3 — POST-FIX (HEAD `e136e8a`)** ความพยายามเติม V07 เป็น n=4 — **ล้มเหลวทั้งคู่** (โควตาหมดทั้งระบบ) มีแค่ `harness.log` (ไม่มี `preview.json` เพราะ error) |

## 3. Objective 2 — Audio-only vs Audio+Visual

| ไฟล์/โฟลเดอร์ | คืออะไร |
|---|---|
| [`objective2/PROTOCOL.md`](objective2/PROTOCOL.md) | นิยามเงื่อนไข A (audio-only) vs B (audio+visual = ใช้ผล Objective 1 ซ้ำ) |
| `objective2/metrics_combined.json`, `metrics_rep1.json` | ผลลัพธ์ตัวเลข audio-only |
| `objective2/rep1_out.txt` + `rep1/{after,control-old}/<case>/` | **รอบ 1 — pre-fix** — ล้มเหลวบางส่วน (V01/V04-old/V05 เท่านั้นที่สำเร็จ, ที่เหลือ 429) |
| `objective2/rep2_out.txt` + `rep2/{after,control-old}/<case>/` | **รอบ 2 — pre-fix** — รันที่เหลือจนครบ required tier (n≥2 ทุก case) |
| — | **should-do tier (n=4) ไม่ได้ทำ** — หยุดก่อนเริ่มเพราะโควตาหมดทั้งระบบ (พบตอนเติม V07 ของ Objective 1 ก่อนหน้า) |

## 4. Objective 3 — Subtitle (ยังไม่เริ่มทดสอบจริง)

| ไฟล์ | คืออะไร |
|---|---|
| [`objective3/PROTOCOL.md`](objective3/PROTOCOL.md) | โปรโตคอล 6 หัวข้อ (text accuracy / timing / editability) |
| [`objective3/DATA-SETUP.md`](objective3/DATA-SETUP.md) | แผนเตรียม reference transcript (ยังไม่ได้ทำ — ต้องมีคนถอดแบบ blind) |

## 5. Objective 4 — Functional + Human

| ไฟล์/โฟลเดอร์ | คืออะไร |
|---|---|
| [`objective4/PROTOCOL.md`](objective4/PROTOCOL.md) | โปรโตคอลรวม 4A/B/C/D |
| [`objective4/FUNCTIONAL-TEST.md`](objective4/FUNCTIONAL-TEST.md) | เช็กลิสต์ 4A (upload → preview → edit → render → output) |
| [`objective4/PARTICIPANT-PLAN.md`](objective4/PARTICIPANT-PLAN.md) | แผนจำนวนผู้เข้าร่วม 4B/C/D (ข้อเสนอ ยังไม่ได้จัดหาคนจริง) |
| [`objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md`](objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md) | **การสืบสาเหตุ job ที่ล้มครั้งที่ 2** — ไฟล์เสียง/VAD ไม่ใช่ปัญหา ; ข้อสรุป "transcript-cache bug" เดิมถูกถอนแล้ว 2026-09-24 (ดูหัวข้อแก้ไขบนสุดของไฟล์) สาเหตุจริง: worker รัน image เก่าก่อนแก้ VAD-prefilter (ยืนยันแล้ว) |
| [`objective4/functional/run2-post-rebuild/checklist_result.md`](objective4/functional/run2-post-rebuild/checklist_result.md) | **4A รอบใหม่หลัง rebuild (ใช้ผลนี้)** — checklist ตามข้อ + หลักฐาน (upload/preview/subtitle/render responses, process_log, ffprobe, `burn/frame_t3s.jpg`) ; ไม่มี token ในไฟล์ |
| [`objective4/UI-MANUAL-CHECKLIST.md`](objective4/UI-MANUAL-CHECKLIST.md) | **checklist 33 ข้อให้ผู้ใช้ทดสอบหน้าเว็บด้วยมือ** (ส่วน UI ของ 4A ที่ API ยืนยันไม่ได้) — ผล: NOT RUN |
| [`objective4/functional/run3-v04-repeat/SUMMARY.md`](objective4/functional/run3-v04-repeat/SUMMARY.md) | รอบเสริม V04 (ทำซ้ำเช็ค "0 ช่วงตัด" ของ V02) + `process_log.txt`, `preview.json` |
| `objective4/functional/job-5ab40c1a/extracted_audio.wav` | ไฟล์เสียงหลังผ่าน ffmpeg extract ของ job ที่ล้ม (เก็บไว้เทียบ SHA-256 กับต้นฉบับ) |

**หลักฐาน 4A ทั้งหมดอยู่ใน `RESULTS-TEMPLATE.md` หัวข้อ "A. Functional"** (ตาราง PASS/FAIL ต่อขั้นตอน,
request-sequence log, หัวข้อ "ข้อจำกัดที่พบระหว่างทดสอบ" ที่มีการถอนข้อสรุป cache-bug เดิม) — ไฟล์ใน `objective4/functional/` เป็นหลักฐานสนับสนุนเชิงลึก

---

## 6. หมายเหตุสำคัญเรื่อง git

- ไฟล์ `.log` ทั้งหมด (รวม `harness.log` ทุกไฟล์ในโฟลเดอร์นี้) ถูก `.gitignore` (`*.log`) กันไว้
  ไม่ถูก track โดยอัตโนมัติ — ถ้าจะคอมมิทหลักฐานชุดนี้ในอนาคต ต้อง `git add -f` เฉพาะไฟล์ที่ต้องการ
  หรือแก้ `.gitignore` ก่อน (ยังไม่ได้ทำในรอบนี้ — เป็นแค่ข้อสังเกต)
- ไฟล์ `preview.json`, `*_out.txt`, `*_stderr.txt`, `metrics*.json`, `*.md` ไม่ติด gitignore —
  ยังคง untracked (`??`) รอการตัดสินใจว่าจะคอมมิทหรือไม่ ยังไม่มีการคอมมิทชุดข้อมูล evaluation
  รอบนี้เลย (มีแค่ commit `e136e8a` ที่เป็น source code fix เพียงไฟล์เดียว)
