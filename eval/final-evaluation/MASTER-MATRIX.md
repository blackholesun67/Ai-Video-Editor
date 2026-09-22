# Final Evaluation — Master Matrix

- สถานะ: **เตรียมความพร้อมเท่านั้น ยังไม่มีการรันจริง** — เอกสารนี้รวมภาพรวมของ `objective1/README.md`, `objective2/PROTOCOL.md`, `objective3/PROTOCOL.md`, `objective4/PROTOCOL.md`
- ห้ามแก้ source / Ground Truth / Test Plan / commit source ในรอบที่สร้างเอกสารนี้ (ยืนยันท้ายไฟล์)

---

## 7. Final Evaluation ต้องใช้ FINAL CODE เดียวกันทั้งชุด ("Code Lock")

| ข้อกำหนด | วิธีบังคับใช้ |
|---|---|
| ใช้ HEAD เดียวกันทั้งชุด | HEAD `1612888` (VAD Filter Fix + Silence Gap Fix + Snap/Word-Bound Fix รวมกันครบ) — แฮช `backend/core/ai_logic.py` (LF-normalized) = `3a67a004…` ตรวจก่อนรันทุกครั้งด้วย `git show 1612888:backend/core/ai_logic.py \| sha256sum` (หรือเทียบกับ working tree ปัจจุบันถ้า `git diff HEAD -- backend/core/ai_logic.py` = 0 บรรทัด) |
| source ไม่เปลี่ยนระหว่าง runs | copy `backend/core/ai_logic.py` ที่ HEAD เดียวกันไปเป็นทั้ง `/tmp/ai_logic_old.py` **และ** `/tmp/ai_logic_new.py` ก่อนรัน harness ทุกครั้ง (แทนที่จะเทียบ old-vs-new แบบรอบทดสอบ fix ที่ผ่านมา) — ทำให้ tag "old"/"new" ในผลลัพธ์กลายเป็น "run ซ้ำ 2 ครั้งของโค้ดเดียวกัน" ใช้วัด variability ได้โดยไม่ต้องแก้ `analysis_harness.py` เพิ่ม |
| Ground Truth ล็อก | `eval/V0x/ground_truth.txt` ทุกไฟล์ — ตรวจ `git diff 4189548 -- '*/ground_truth.txt'` = 0 บรรทัดก่อนเริ่มและหลังจบทุกรอบ |
| prompt/model/config ล็อก | `GEMINI_MODELS=gemini-2.5-flash,gemini-3.6-flash` (ตรึงเป็น `gemini-2.5-flash` หลัก), prompt = ตาม `ai_logic.py` ที่ HEAD เดียวกัน ไม่แก้ระหว่างรัน, `VISUAL_CONTEXT` เปลี่ยนได้เฉพาะระหว่าง Objective 1 (default=1) กับ Objective 2 เงื่อนไข A (=0) เท่านั้น ตัวแปรอื่นทั้งหมดคงที่ |
| evidence แยกตาม test | `eval/final-evaluation/objective{1,2,3,4}/` แยกโฟลเดอร์ชัดเจน ไม่ปนกับ `eval/vad-filter-fix/`, `eval/silence-gap/`, `eval/snap-wordbound-fix/` (ของรอบ fix ที่ผ่านมา) |

**ผลจาก VAD Filter Fix / Silence Gap Fix / Snap-Word-Bound Fix รอบก่อนใช้เป็น historical evidence เท่านั้น** — บางผลรันด้วยโค้ดที่ยังไม่รวม fix ครบทั้ง 3 ตัว (เช่น ผล VAD-fix-only รันก่อนมี Silence Gap Fix) **ห้ามนำมารวมเป็นตัวเลข Final Evaluation เดียวกันกับผลที่รันด้วย HEAD `1612888`** — ใช้ได้แค่เป็นข้อมูลอ้างอิงเชิงประวัติศาสตร์ (เช่น เพื่อเล่าพัฒนาการของระบบ) แยกหัวข้อชัดเจนในรายงานสุดท้าย

---

## 8. Gemini Variability Protocol (ตาม `eval/pre-final-audit.md` §8)

| กฎ | รายละเอียด |
|---|---|
| Model เดียว | `gemini-2.5-flash` ตลอดทั้งแผน ห้ามสลับกลางรอบ |
| Prompt version เดียว | ตาม HEAD `1612888` เท่านั้น |
| Record error code | บันทึก 429/503/404 ทุกครั้งที่เกิด พร้อม key/model ที่ตอบ (มีอยู่แล้วในรูปแบบ `harness.log` ของ `analysis_harness.py`/`harness_unpack.py` — ไม่ต้องสร้างกลไกใหม่) |
| Record timestamp | เวลาที่รันแต่ละ run (พบพิสัยจริงในรอบก่อน 11.6s–672.4s ต่อ request) |
| Record successful/failed run | แยก `"status": "ERROR"` ออกจาก run ที่สำเร็จแต่ cuts=[] จริง (จัดการแล้วใน `score_final_eval.py`) |
| n ≥ 2–3 ต่อ case | ตามแผน — ดูวิธีทำใน `objective1/README.md` (ใช้ tag old=new = โค้ดเดียวกัน) |
| ห้าม rerun จนกว่าจะได้ผลดี | เก็บ error แล้วรายงาน ไม่รันซ้ำอัตโนมัติ (กฎเดิมจาก `RERUN.md` ของรอบ Silence Gap Fix ที่พิสูจน์แล้วว่าได้ผล) |
| ถ้า quota/API error | mark failed run, เก็บ evidence (`harness.log`), **ไม่เปลี่ยน protocol กลางทาง** (เช่น ห้ามสลับโมเดลกลางรอบแม้จะมีทางลัดที่ใช้ได้ — บทเรียนจากบั๊ก quota-per-model ที่เก็บไว้แก้ทีหลัง) |

---

## 9. Final Evaluation Run Order (ลดความเสี่ยง quota — เรียง Gemini ไว้ท้ายสุด)

| ลำดับ | ขั้น | ใช้ Gemini? | รายละเอียด |
|---|---|---|---|
| 1 | Functional/local tests | ❌ ไม่ใช้ | Objective 4.A (endpoint/UI logic) — ทำได้อิสระจาก Gemini quota |
| 2 | Objective 3 preparation | ❌ ไม่ใช้ | จัดหา reference transcript/timing (คนถอดเอง) — งานเตรียมข้อมูล ไม่เรียกระบบ |
| 3 | Objective 4 preparation (B/C/D) | ❌ ไม่ใช้ | ออกแบบ rubric/questionnaire, หาผู้เข้าร่วม — งานเตรียมการ ไม่เรียกระบบ |
| 4 | **Objective 1** (9 case × n=2–3) | ✅ ใช้ | ต้องเสร็จก่อน Objective 2 เพราะเงื่อนไข B ของ Objective 2 ใช้ผลจาก Objective 1 ร่วมกันได้ |
| 5 | **Objective 2** เงื่อนไข A เท่านั้น (9 case × n=2–3, `VISUAL_CONTEXT=0`) | ✅ ใช้ | เงื่อนไข B ใช้ผลจากลำดับ 4 อยู่แล้ว ไม่ต้องรันซ้ำ |
| 6 | Objective 3 metric run (ถ้าเตรียมข้อมูลจากลำดับ 2 เสร็จแล้ว) | ⚠️ อาจใช้ (ถ้าต้องรัน AI-Correction เทียบ reference) | ทำหลัง Objective 1/2 เพราะไม่เร่งด่วนเท่าและ quota อาจเหลือน้อย |
| 7 | Objective 4.B/C/D (human tests) | ❌ ไม่ใช้ Gemini โดยตรง (ใช้ผลจากลำดับ 4 เป็น stimulus) | รันได้อิสระจาก quota แต่ต้องรอผลจากลำดับ 4 ก่อน (ใช้เป็นคลิปตัวอย่างให้ผู้เชี่ยวชาญ/ผู้ใช้ดู) |

**หลักการ:** ห้ามเรียก Gemini ในขั้น preparation (ลำดับ 1–3) ทั้งหมด — สอดคล้องกับ "ห้ามเรียก Gemini จริง" ของรอบเตรียมความพร้อมนี้ด้วย (เอกสารทั้งหมดในรอบนี้จึงหยุดอยู่ที่ลำดับ 1–3 เท่านั้น ยังไม่แตะลำดับ 4 เป็นต้นไป)

---

## Master Run Matrix

| Objective | Test | Cases | Condition | n | Metric | Evidence | Ready |
|---|---|---|---|---|---|---|---|
| 1 | AI Cut Detection E2E | 9 case (V01,V02,V03×2,V04,V05,V06×2,V07) | HEAD `1612888`, `gemini-2.5-flash`, `VISUAL_CONTEXT=1` | 2–3 | Recall/Precision/F1/outside-GT/keep-violation | `eval/final-evaluation/objective1/` | **8/9 case ready ทันที** (V03_full มีข้อจำกัด GT โดยดีไซน์ ดู objective1/README.md) |
| 2 | Audio-only vs Audio+Visual | เหมือน Objective 1 (9 case) | `VISUAL_CONTEXT=0` (A) vs `=1` (B, ใช้ร่วมกับ Objective 1) | 2–3 ต่อเงื่อนไข | เหมือน Objective 1 + qualitative checklist | `eval/final-evaluation/objective2/` | **Ready (dataset พร้อม) — ต้องรันเพิ่มเฉพาะเงื่อนไข A** |
| 3 | Subtitle accuracy (metric ตาม Test Plan จริง) | 2–3 คลิปย่อยจาก V02–V07 | HEAD เดียวกัน | ยังกำหนดไม่ได้ | รอยืนยันจาก Test Plan (CER/WER/อื่น) | `eval/final-evaluation/objective3/` | **NOT READY** |
| 3 | Subtitle timing accuracy | เหมือนข้างบน | เหมือนข้างบน | ยังกำหนดไม่ได้ | offset เฉลี่ย/สูงสุดเทียบ reference timing | ยังไม่มี | **NOT READY** |
| 3 | Editable subtitle flow | 1 คลิปตัวอย่าง | `SubtitleEditScreen.jsx` จริง | 1 รอบ (คนจริง) ขึ้นไป | task success | ยังไม่มี | **NOT READY** |
| 4.A | Functional (endpoint/UI logic) | 1–2 คลิปตัวอย่าง | FastAPI endpoint จริง | 1–2 | pass/fail, response time | `eval/final-evaluation/objective4/` | **NOT READY (เล็กน้อย — เตรียมเองได้)** |
| 4.B | Expert evaluation | ผลจาก Objective 1 | rubric (ยังไม่ออกแบบ) | ≥2 ผู้เชี่ยวชาญ | คะแนนตาม rubric | ยังไม่มี | **NOT SET UP** |
| 4.C | User evaluation | ระบบจริง | questionnaire (ยังไม่ยืนยัน SUS) | ตามที่ออกแบบ | task success/time, satisfaction | ยังไม่มี | **NOT SET UP** |
| 4.D | Manual vs AI-assisted | คลิปตัวอย่าง | คนตัดเอง vs ใช้ระบบช่วย | ตามที่ออกแบบ | task time, task success | ยังไม่มี | **NOT SET UP** |

## Objective Readiness Summary

| Objective | Ready? | Missing | Action |
|---|---|---|---|
| 1 | **เกือบพร้อม (8/9 case)** | ยังไม่มี evidence จริง (เพิ่งเตรียม harness/scoring) ; V03_full มีข้อจำกัด GT โดยดีไซน์ | รัน harness จริงตาม run order ข้อ 9 (ลำดับ 4) |
| 2 | **โครงสร้างพร้อม** | ยังไม่เคยรันเงื่อนไข A บนชุด V01–V07 เลย ; checklist เชิงคุณภาพต้องตกลงก่อนรัน (ทำแล้วในรอบนี้ — ดู `objective2/PROTOCOL.md`) | รันตาม run order ข้อ 9 (ลำดับ 5) |
| 3 | **NOT READY** | reference transcript, reference timing, metric ที่ยืนยันจาก Test Plan, วิธีทดสอบ editable-subtitle | ทำ checklist ใน `objective3/PROTOCOL.md` ก่อน |
| 4 | **A พร้อมเตรียมเอง / B-C-D NOT SET UP** | rubric, questionnaire, ผู้เข้าร่วมจริง | ออกแบบ + จัดหาคนสำหรับ B/C/D ; เตรียม endpoint test สำหรับ A ได้ทันที |

---

## ยืนยันท้ายไฟล์ (รอบสร้างเอกสารนี้)

- ไม่มีการแก้ `backend/core/*` (แก้เฉพาะ `eval/tools/analysis_harness.py` ซึ่งเป็นเครื่องมือทดสอบ ไม่ใช่ source ของระบบ)
- ไม่มีการแก้ Ground Truth
- ไม่มีการเรียก Gemini จริง (การรัน `score_final_eval.py` ที่ทำในรอบนี้เป็นการคำนวณ metric จากไฟล์ `preview.json` ที่มีอยู่แล้วจากรอบทดสอบก่อนหน้า ไม่ใช่การเรียก Gemini ใหม่)
- ไม่มีการ commit source
