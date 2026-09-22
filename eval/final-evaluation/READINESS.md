# Final Evaluation — Readiness Summary

- สร้างเมื่อ: 2026-09-22 (รอบเตรียมความพร้อม Final Evaluation — ไม่มีการเรียก Gemini จริง)
- อ้างอิง: `objective1/README.md`, `objective2/PROTOCOL.md`, `objective3/PROTOCOL.md`, `objective4/PROTOCOL.md`, `MASTER-MATRIX.md`

---

## Objective 1 — AI Cut Detection: **NOT READY TO RUN YET (โครงสร้างพร้อม, ยังไม่มีข้อมูลจริง)**

- ✅ Harness รองรับครบ 9 case แล้ว (`eval/tools/analysis_harness.py`) — verified: input path, mode, storage files, GT parse
- ✅ Scoring script พร้อมและทดสอบแล้วจริงกับหลักฐานเก่า (`eval/tools/score_final_eval.py`) — ตัวเลขตรงกับ `metrics_final_three_way.json` เป๊ะ
- ⚠️ V03_full มีข้อจำกัด GT โดยดีไซน์ (recall จะเป็น N/A เสมอ — ไม่ใช่บั๊ก)
- ⚠️ V01 ไม่มี Ground Truth (ใช้ได้แค่ sanity run)
- ❌ ยังไม่มี evidence จริงสักไฟล์เดียว (ยังไม่รัน Gemini)

**ต้องทำก่อนเริ่มจริง:** ไม่มีสิ่งกีดขวางเชิงโครงสร้างเหลือแล้ว — พร้อมรันได้ทันทีที่ได้รับคำสั่งให้เรียก Gemini จริง

---

## Objective 2 — Audio Only vs Audio+Visual: **NOT READY TO RUN YET (โครงสร้าง/dataset พร้อม)**

- ✅ Dataset พร้อมครบ 9 case (`get_visual_signals()` เคยรันสำเร็จกับวิดีโอทุกไฟล์แล้วจริง — ตรวจจาก `"visual"` key ใน `preview.json` ที่มีอยู่)
- ✅ `VISUAL_CONTEXT` toggle ได้ด้วย env var ไม่ต้องแก้ source
- ✅ Qualitative Review Checklist ออกแบบไว้ล่วงหน้าแล้ว (`objective2/PROTOCOL.md`)
- ✅ เงื่อนไข B (audio+visual) ใช้ร่วมกับผล Objective 1 ได้เลย ไม่ต้องรันซ้ำ
- ❌ ยังไม่เคยรันเงื่อนไข A (audio-only) บนชุด V01–V07 เลยสักครั้ง

**ต้องทำก่อนเริ่มจริง:** ไม่มีสิ่งกีดขวางเชิงโครงสร้างเหลือแล้ว — พร้อมรันได้ทันทีหลัง Objective 1 (ตาม run order)

---

## Objective 3 — Subtitle: **NOT READY**

- ❌ ไม่มี human-verified reference transcript
- ❌ ไม่มี reference timing
- ❌ ไม่ยืนยัน metric จาก Test Plan ฉบับจริง (CER/WER/อื่น — ไม่พบเอกสาร Test Plan ในโค้ด repo)
- ❌ ไม่มีวิธีทดสอบ editable-subtitle flow ที่ตกลงแล้ว

**ต้องทำก่อนเริ่มจริง:** ทำ checklist ทั้ง 6 ข้อใน `objective3/PROTOCOL.md` ให้ครบก่อน (จัดหาคนถอดเสียง, กำกับเวลา, เปิดเอกสาร Test Plan ฉบับจริง, ตัดสินใจวิธีทดสอบ UI)

---

## Objective 4 — Functional + Human: **NOT READY (แยกตามส่วน)**

| ส่วน | สถานะ |
|---|---|
| A. Functional (endpoint/UI logic) | NOT READY (เล็กน้อย) — เตรียม integration test ผ่าน endpoint จริงได้เองโดยไม่ต้องรอคน |
| B. Expert evaluation | NOT SET UP — ต้องออกแบบ rubric + หาผู้เชี่ยวชาญ ≥2 คน |
| C. User evaluation | NOT SET UP — ต้องออกแบบ questionnaire (ยืนยัน SUS หรือแบบอื่นจาก Test Plan) + หาผู้ใช้จริง |
| D. Manual vs AI-assisted | NOT SET UP — ต้องออกแบบ procedure + หาผู้เข้าร่วมทั้งสองฝั่ง |

**ต้องทำก่อนเริ่มจริง:** A ทำได้ทันที ; B/C/D ต้องออกแบบ protocol โดยละเอียดกว่าที่มีใน `objective4/PROTOCOL.md` (rubric/questionnaire ฉบับเต็ม) และจัดหาผู้เข้าร่วมจริง — **ไม่ใช้ Claude แทนคนไม่ว่ากรณีใด**

---

## สรุปภาพรวม

| Objective | Ready? |
|---|---|
| 1 — AI Cut Detection | **โครงสร้าง/เครื่องมือพร้อม รอคำสั่งให้เรียก Gemini จริง** |
| 2 — Audio vs Audio+Visual | **โครงสร้าง/dataset พร้อม รอคำสั่งให้เรียก Gemini จริง** |
| 3 — Subtitle | **NOT READY** (ขาด reference data + ยืนยัน metric จาก Test Plan) |
| 4 — Functional + Human | **A พร้อมเตรียมเอง / B-C-D NOT SET UP** (ต้องใช้คนจริง) |

รายการที่ต้องทำก่อนเริ่ม Final Evaluation เต็มรูปแบบ (รวมทุก Objective) อยู่ใน `MASTER-MATRIX.md` หัวข้อ "Objective Readiness Summary" และ checklist ในแต่ละ `objectiveN/*.md`
