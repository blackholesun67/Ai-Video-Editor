# Objective 3 — Subtitle

## สถานะ: **NOT READY**

ตรวจแล้ว (`eval/pre-final-audit.md` §10, ยืนยันซ้ำอีกครั้งในรอบนี้ด้วย `find`): **ไม่มี evidence ด้านซับใด ๆ ในระบบเลย** ไม่ว่าจะเป็น human-verified reference transcript, timing ground truth, หรือผลทดสอบ editable-subtitle flow — `srt_utils.py` ไม่ถูกแตะโดยทั้ง 3 fixes ที่ผ่านมาเลย (ไม่มี regression risk แต่ก็ไม่มีข้อมูลใหม่)

**ตามคำสั่ง: ห้ามสร้าง reference transcript ปลอมเพื่อให้มีตัวเลข** — เอกสารนี้จึงเป็น checklist สิ่งที่ต้องเตรียมจริง ไม่ใช่ protocol ที่รันได้ทันที โครงสร้างด้านล่างแบ่งตาม 6 องค์ประกอบที่ต้องมีตามที่กำหนด

**Video cases (พร้อมแล้ว, ไม่ใช่ส่วนที่ NOT READY):** แนะนำใช้ชุดย่อย 2–3 คลิปจากชุด V02–V07 — มีไฟล์เสียง/วิดีโอ/transcript ของ Whisper อยู่แล้วใน `backend/storage/` ไม่ต้องอัปโหลดใหม่

---

## 1. Human Reference Transcript

**สถานะ: ❌ NOT READY**

- ต้องมีคนถอดเสียงคลิปที่เลือกใหม่ทั้งหมดด้วยตัวเอง ฟังจากไฟล์เสียงจริง
- **ห้ามใช้ Whisper output ของระบบเองเป็นเฉลย** — จะกลายเป็นการวัดความแม่นยำของ Whisper เทียบกับตัวมันเอง ไม่มีความหมายเป็น ground truth
- **ห้ามให้ Claude สร้าง reference transcript แทน** (เข้าข่ายเดียวกับการสร้างข้อมูลเทียมเพื่อให้ผ่าน — ต้องเป็นคนฟังและถอดเองจริง)
- ยังไม่มีใครทำขั้นนี้ ณ ตอนนี้

## 2. Reference Timing

**สถานะ: ❌ NOT READY**

- ต้องมีคนกำกับเวลาเริ่ม/จบของแต่ละประโยคอ้างอิง (หรืออย่างน้อย sample บางช่วงต่อคลิป) เทียบกับเสียงจริงที่ได้ยิน
- ใช้คู่กับ reference transcript (ข้อ 1) เพื่อคำนวณ timing metric (ข้อ 3)
- ยังไม่มีข้อมูลนี้เลย

## 3. Metric จาก Test Plan

**สถานะ: ❌ NOT READY — ต้องยืนยันจาก Test Plan ฉบับจริงก่อน ห้ามเดา**

- ไม่พบเอกสาร Test Plan ในโค้ด repo นี้ (`find`/`grep` ทั่ว repo ไม่เจอไฟล์ชื่อเกี่ยวกับ test plan) จึงไม่ทราบว่า metric ที่กำหนดไว้จริงคือ **CER (Character Error Rate)**, **WER (Word Error Rate)**, หรือ metric อื่น — ต้องเปิดเอกสารวิทยานิพนธ์/Test Plan ฉบับจริง (นอก repo) แล้วบันทึกกลับมาที่นี่ก่อนเขียน metric ให้แน่ชัด
- **Timing metric** (ยังไม่มีชื่ออย่างเป็นทางการ — เสนอไว้ล่วงหน้าเผื่อ Test Plan ไม่ได้ระบุ): ค่าเฉลี่ย/สูงสุดของ `|ซับ.start − เสียงจริง.start|` และ `|ซับ.end − เสียงจริง.end|` ต่อบรรทัด เทียบกับ reference timing (ข้อ 2) — ระบบมี invariant ที่เกี่ยวข้องอยู่แล้ว (CLAUDE.md §6: `tail_pad`, `remap_edited_phrases`, ปัด 0.1 วิ) แต่ยังไม่มี metric เชิงปริมาณอย่างเป็นทางการมาก่อน
- **Corrected text comparison**: ระบบมี AI-Correction step (`🔧 [AI-Correct]`) และ log ผลการแก้อยู่แล้ว (บางส่วนพร้อม) แต่ยังไม่มีการวัดเชิงปริมาณว่าแก้ถูกกี่ % เทียบ reference — ต้องมี reference transcript (ข้อ 1) ก่อนถึงจะคำนวณได้

## 4. Editable Subtitle Procedure

**สถานะ: ❌ NOT READY**

- ต้องทดสอบผ่านหน้า `frontend/src/components/SubtitleEditScreen.jsx` จริง: ผู้ใช้แก้ข้อความ/เวลา → กดยืนยัน → render → ตรวจว่าไฟล์ output ตรงตามที่แก้
- เป็นการทดสอบระดับ UI ไม่ใช่ core logic ล้วน ๆ — โปรเจกต์นี้ไม่มี UI automation (Playwright/Cypress) อยู่แล้ว
- ต้องตัดสินใจ: ให้คนทดสอบเองจริง (แนะนำสำหรับรอบแรก เพราะไม่มี automation อยู่แล้ว และงานนี้เข้าข่าย human-in-the-loop) หรือเขียน UI automation ใหม่ (ใช้เวลาเตรียมเพิ่ม)
- Procedure ร่าง (ใช้เมื่อพร้อม): (1) โหลดคลิปที่ผ่าน Objective 1 มาแล้ว (2) แก้ข้อความอย่างน้อย 1 บรรทัด (3) แก้เวลาอย่างน้อย 1 บรรทัด (4) กดยืนยัน → render (5) ตรวจไฟล์ output ว่าซับตรงกับที่แก้ทั้งข้อความและเวลา

## 5. Evidence

**สถานะ: ยังไม่มีไฟล์จริง (โครงที่คาดไว้เท่านั้น)**

```
eval/final-evaluation/objective3/
  PROTOCOL.md                     (ไฟล์นี้ — อัปเดตเมื่อมีข้อมูลตาม checklist ท้ายไฟล์)
  reference/<case>/transcript.txt (มนุษย์ถอดเอง — ข้อ 1)
  reference/<case>/timing.json    (มนุษย์กำกับเวลาเอง — ข้อ 2)
  results/<case>/metric.json      (คำนวณเทียบ reference ตาม metric ที่ยืนยันแล้ว — ข้อ 3)
  editable-subtitle-test-log.md   (บันทึกผลทดสอบ UI จริง — ข้อ 4)
```

## 6. Acceptance / Interpretation Rule

ร่างไว้ล่วงหน้า ใช้ตอนมีข้อมูลจริงแล้วเท่านั้น:

- **ห้ามตีความ "ความแม่นยำสูง" จาก CER/WER (หรือ metric ที่ Test Plan กำหนด) ตัวเดียว** ต้องดูคู่กับตัวอย่างข้อความที่ผิดจริง (เช่น ชื่อเฉพาะ/ตัวเลขที่ผิดมีผลกระทบมากกว่าคำเชื่อมที่ผิด) — ต้องมี qualitative spot-check ประกอบเสมอ (แนวทางเดียวกับ Objective 2)
- **Timing accuracy ต้องแยกกรณี** ซับที่มาจาก Whisper ตรง ๆ กับซับที่ผ่าน AI-Correction (อาจมี offset ต่างกัน)
- ผลที่ได้ต้องรายงานแยก **input-level (ความแม่นยำถอดเสียง)** ออกจาก **timing-level (จังหวะขึ้น/ลง)** ออกจาก **UI-level (แก้ไขได้จริงไหม)** เสมอ ไม่รวมเป็นตัวชี้วัดเดียว (ตามหลักการเดียวกับที่ใช้แยก input-level/final-output ใน Objective 1)

---

## Checklist สิ่งที่ต้องเตรียมก่อนเริ่ม Objective 3 ได้จริง

1. [ ] เลือกคลิป 2–3 คลิปจากชุด V02–V07 สำหรับทดสอบซับ
2. [ ] หาคน/เวลาถอดเสียง reference transcript ของคลิปที่เลือก (ข้อ 1 — ห้ามใช้ Whisper output ของระบบเองเป็นเฉลย)
3. [ ] กำกับ reference timing (อย่างน้อย sample-based) สำหรับคลิปเดียวกัน (ข้อ 2)
4. [ ] เปิดเอกสาร Test Plan ฉบับจริง (นอก repo) เพื่อยืนยัน metric ที่กำหนดไว้จริง (ข้อ 3) — บันทึกกลับมาไว้ในไฟล์นี้
5. [ ] ตัดสินใจวิธีทดสอบ editable-subtitle flow (ข้อ 4)
6. [ ] หลังมีข้อมูลข้อ 1–4 ครบ ค่อยเขียน test matrix จริง (จำนวน case × metric) แทนที่เอกสารนี้
