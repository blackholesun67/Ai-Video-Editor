# Final Evaluation Plan — บทที่ 4

- สถานะเอกสารนี้: **แผนเท่านั้น ยังไม่มีการรันใด ๆ** ตามที่กำหนด (ห้ามรัน Gemini / แก้ source / แก้เฉลย / แก้ threshold / แก้ prompt / commit source ในรอบที่สร้างเอกสารนี้)
- อ้างอิงจาก: `eval/pre-final-audit.md` (17 หัวข้อ), `eval/vad-filter-fix-report.md`, `eval/silence-gap-report.md`, `eval/snap-wordbound-fix-report.md` (อัปเดตล่าสุดทั้งหมดแล้วก่อนสร้างแผนนี้)
- HEAD ที่ใช้เป็นฐาน: `1612888` (VAD Filter Fix + Silence Gap Fix + Snap/Word-Bound Fix รวมกันครบ) — **ไม่มี MUST FIX ด้าน source เหลือค้างก่อน Final Evaluation** ตาม audit
- ไม่พบเอกสาร Test Plan ในโค้ด repo นี้ (ค้นด้วย `find`/`grep` ทั่ว repo ไม่เจอ) — Objective 1–4 ด้านล่างตั้งชื่อตามที่ผู้ใช้อ้างถึงและตามหลักฐาน/ฟีเจอร์ที่มีอยู่จริงในระบบ (README.md, CLAUDE.md) **ถ้ามีเอกสาร Test Plan ฉบับทางการอยู่นอก repo (เช่นในวิทยานิพนธ์) ต้องใช้เอกสารนั้นตรวจทานแผนนี้ซ้ำก่อนใช้จริง โดยเฉพาะชื่อ metric ที่กำหนดไว้สำหรับ Objective 3–4**

> **สถานะล่าสุด (superseded บางส่วน):** แผนนี้เสนอไว้ที่ **8 case** สำหรับ Objective 1/2 (V02, V03×2, V04, V05, V06×2, V07) — รอบเตรียม Final Evaluation ถัดมาได้ขยาย `eval/tools/analysis_harness.py` เป็น **9 case** จริง (เพิ่ม V01 เป็น sanity-only case) และย้ายรายละเอียด protocol/readiness ที่เป็นปัจจุบันไปไว้ที่ `eval/final-evaluation/objective{1,2,3,4}/` + `eval/final-evaluation/MASTER-MATRIX.md` + `eval/final-evaluation/READINESS.md` แล้ว **ให้ใช้ไฟล์เหล่านั้นเป็นตัวเลขล่าสุด** ส่วนหลักการร่วม (§0), แนวทาง Objective 3/4 design และเหตุผลเชิงลึกในเอกสารนี้ยังใช้อ้างอิงได้ตามเดิม (ไม่ถูกแทนที่)

---

## 0. หลักการร่วมของทุก Objective

1. **ตรึงโค้ดที่ทดสอบทั้งแผน:** ใช้ `backend/core/ai_logic.py` ที่ HEAD `1612888` ตลอด (แฮช LF-normalized `3a67a004…`) ห้ามแก้ระหว่างรัน Final Evaluation ทั้งชุด — ถ้าจำเป็นต้องแก้ (เช่นแก้บั๊ก `call_gemini_with_retry` ที่เก็บไว้ตามที่ผู้ใช้สั่ง) ต้อง tag/commit เป็นจุดตัดใหม่ก่อน แล้วเริ่มรอบวัดใหม่ทั้งหมด ห้ามผสมผลจากโค้ดคนละเวอร์ชันในตารางเดียวกัน
2. **ตรึงตัวแปร Gemini ตลอดการทดลองเดียว:** `GEMINI_MODELS=gemini-2.5-flash,gemini-3.6-flash` (ค่า default ปัจจุบัน, ใช้ `gemini-2.5-flash` เป็นหลักตามที่ทุกรอบก่อนหน้าใช้) — ห้ามสลับกลางรอบแม้จะมีทางลัดที่ใช้ได้ (บทเรียนจากบั๊ก quota-per-model ที่พบและเก็บไว้แก้ทีหลัง)
3. **บันทึก error ทุกครั้ง ไม่ปิดบัง:** ทุก run ที่เจอ 429/503/404 ต้องบันทึก key/model ที่ตอบ, ข้อความ error เต็ม, และเวลาที่ใช้ ลงใน `harness.log` เดิม (รูปแบบเดียวกับที่ใช้มาตลอด) — ห้ามรันซ้ำจนกว่าจะสำเร็จ (เก็บ error แล้วรายงาน ตามกฎเดิมของ `RERUN.md`)
4. **n ต่อ clip/mode/condition:** ตาม audit แนะนำ **n=2–3** เพราะ variability สูงมาก (พบ recall ต่างกันถึง 42pp ด้วยโค้ด+อินพุตเดียวกัน) — n=1 ใช้ได้แค่เป็นหลักฐานเชิงกลไก (mechanism-level) ไม่ใช่ข้อสรุปเชิงสถิติ
5. **ใช้ `score()` เดิมจาก `eval/tools/score.py` เสมอ** ไม่สร้าง metric ใหม่ ไม่แก้นิยาม recall/precision/F1/outside-GT/keep-violation
6. **ไม่มีเงื่อนไขใดในโค้ดหรือ harness ที่อิงชื่อคลิป/ID/timestamp ของเฉลย** — ตรวจซ้ำก่อนเริ่มรอบจริงทุกครั้ง (`grep` หาชื่อ V0x/ground_truth ใน source ต้องเจอแค่คอมเมนต์อธิบาย ไม่ใช่เงื่อนไข `if`)

---

## 1. Objective 1 — AI Cut Detection (ความแม่นยำการตัด)

### Clips × Modes (ชุดเต็มที่มี Ground Truth)

| Clip | Mode | Job ID | มี GT | อยู่ใน `analysis_harness.py` RUNS แล้วหรือไม่ |
|---|---|---|---|---|
| V02 | full | `0e4c606f-d1e1-42dd-a030-6be1cd904465` | ✅ | ✅ อยู่แล้ว |
| V03 | full | `9eb88221-4197-463f-8c62-1daed7dd9744` | ✅ | ❌ **ต้องเพิ่ม** (storage folder มีอยู่แล้วในเครื่อง) |
| V03 | summary | `e30793df-0e40-4955-9b4f-c196f0574857` | ✅ | ❌ **ต้องเพิ่ม** (storage folder มีอยู่แล้ว) |
| V04 | full | `9590035b-7af5-4e7b-92b9-496ed863a3ba` | ✅ | ❌ **ต้องเพิ่ม** (storage folder มีอยู่แล้ว) |
| V05 | full | `4c4597f3-61a4-437d-a420-28d09f6f010b` | ✅ | ❌ **ต้องเพิ่ม** (storage folder มีอยู่แล้ว) |
| V06 | full | `0772b3c4-8449-48b6-bbb6-f2631a3aae3a` | ✅ | ✅ อยู่แล้ว |
| V06 | summary | `20692075-ce67-46ae-aea5-6b9672231db7` | ✅ | ✅ อยู่แล้ว |
| V07 | full | `cc0db657-a323-4516-9f4c-3e8cf5a23685` | ✅ | ✅ อยู่แล้ว |
| V01 | full | `8e43cd1d-431d-4f98-9e78-0c72946988e1` | ❌ ไม่มี `ground_truth.txt` | ใช้เป็น input-level sanity check เท่านั้น (ไม่นับ Objective 1) |

**สิ่งที่ต้องเตรียมก่อนรัน:** เพิ่ม 4 entry (V03_full, V03_summary, V04_full, V05_full) เข้า `RUNS = {...}` ใน `eval/tools/analysis_harness.py` — เป็นการแก้**เครื่องมือทดสอบ**ไม่ใช่ source ของระบบ ไม่ขัดกับ "ห้ามแก้ source" (เครื่องมือใน `eval/tools/` ไม่ใช่ `backend/core/`) แต่ก็ **ยังไม่แก้ในรอบนี้** ตามคำสั่ง "ห้ามรันจริง" — บันทึกไว้เป็นสิ่งที่ต้องทำก่อนรันจริงเท่านั้น ; ไฟล์เสียง/transcript ของทั้ง 4 job ID มีอยู่แล้วที่ `backend/storage/<job_id>/` ไม่ต้องอัปโหลดใหม่

### Protocol

| หัวข้อ | ค่า |
|---|---|
| Gemini model | `gemini-2.5-flash` (ตรึงตาม §0.2) |
| Prompt/version | ตาม `backend/core/ai_logic.py` ที่ HEAD `1612888` ตรง ๆ ไม่แก้ระหว่างรัน |
| Runs per case | **n=3** ต่อ clip×mode (8 case ข้างต้น) = 24 run ; ถ้าโควตา/เวลาไม่พอ ลดเหลือ n=2 ได้ (ระบุเหตุผลไว้ในรายงานผล ห้ามลดเหลือ n=1 โดยไม่ระบุเป็นข้อจำกัด) |
| Metric | Recall, Precision, F1 (`2PR/(P+R)`), outside-GT cut (วินาที), KEEP overlap/violation (วินาที) — ทั้งหมดจาก `score()` เดิม |
| การจัดการ Gemini error | บันทึก error (429/503/404) ต่อ run ตาม §0.3 ; run ที่ error ให้นับเป็น "ERROR" แยกจาก run ที่ตัด cuts=[] จริง (ห้ามปนกัน) ; ไม่รันซ้ำอัตโนมัติจนสำเร็จ |
| การจัดการ variability | รายงานทุก run แยกรายตัว **และ** ค่าเฉลี่ย/พิสัย (min–max) ต่อ clip×mode ; ห้ามใช้ run เดียวเป็นข้อสรุปสุดท้าย (n=1 = "ชั่วคราว/เชิงกลไก" เท่านั้น ตามบทเรียนจากรอบ VAD/Silence Gap) |
| Timeout | บันทึกเวลาต่อ request ทุกครั้ง (พบพิสัยจริง 11.6s–672.4s ในรอบก่อน) — ถ้า request เดี่ยวเกิน ~10 นาที ให้ตัดสินใจล่วงหน้าว่าจะยกเลิกหรือรอ (ระบุ policy ก่อนเริ่มรัน ไม่ใช่ตัดสินใจกลางรอบ) |

### เกณฑ์การอ่านผล (ห้ามดู recall อย่างเดียว — บทเรียนจากทุกรอบก่อนหน้า)
อ่าน recall คู่กับ precision + outside-GT + keep-violation เสมอ (recall ต่ำอาจมาจาก "ไม่ตัดอะไรเลยหลังเห็นข้อมูลครบ" ไม่ใช่ตัดพลาด — กรณี V02 ยืนยันแล้ว) และเทียบกับ control (โค้ดก่อนแก้ รันในเซสชันเดียวกัน) เสมอเมื่อทำได้ ไม่ใช้ผล baseline คนละเซสชันเป็นค่าเทียบหลัก

**พร้อมหรือไม่:** input-level ready เต็มที่ ; final-output ready 4/8 case ทันที (V02, V06×2, V07) อีก 4 case (V03×2, V04, V05) ต้องเพิ่ม harness entry ก่อน (ใช้เวลาไม่มาก — ข้อมูลพร้อมหมดแล้ว)

---

## 2. Objective 2 — Audio-only vs Audio+Visual

### หลักการ
ใช้ **ชุดคลิปเดียวกับ Objective 1 ทั้ง 8 case** (ไม่ใช่คลิปนอกชุดแบบที่ CLAUDE.md §3.7 เคยทำ n=2) เพื่อให้เทียบกับ Objective 1 ได้ด้วย metric ชุดเดียวกัน — ปิดช่องว่างที่ audit พบว่าหลักฐาน multimodal เดิมใช้ dataset คนละชุดกับ V01–V07

### Protocol

| หัวข้อ | ค่า |
|---|---|
| Dataset | เหมือน Objective 1 ทุกประการ (8 clip×mode, GT เดียวกัน) |
| ตัวแปรที่เปลี่ยน | **เฉพาะ** `VISUAL_CONTEXT` (env var, อ่านที่ `ai_logic.py:1107`, toggle ได้โดยไม่แก้ code: `-e VISUAL_CONTEXT=0` ผ่าน `docker compose exec`) — ทุกอย่างอื่น (model, prompt, threshold, n) เหมือน Objective 1 เป๊ะ |
| Condition | (ก) Audio+Visual (`VISUAL_CONTEXT=1`, ค่า default — **ใช้ผลจาก Objective 1 ได้เลยถ้ารันพร้อมกัน ไม่ต้องรันซ้ำ**) (ข) Audio-only (`VISUAL_CONTEXT=0`, รันเพิ่ม) |
| n | เท่ากับ Objective 1 (n=2–3 ต่อ clip×mode×condition) |
| Metric | ชุดเดียวกับ Objective 1 (Recall/Precision/F1/outside-GT/keep-violation) **บวก**การเปรียบเทียบเชิงคุณภาพแบบเดิม (อ่าน `reason` ที่ Gemini ให้ต่อช่วงตัด เทียบว่าอ้างอิงภาพหรือไม่ — ตามที่ CLAUDE.md §3.7 เคยทำ) |
| วิธีเปรียบเทียบ | คู่ (clip×mode, condition=on) vs (clip×mode, condition=off) ที่ n เท่ากัน — รายงาน Δrecall/Δprecision/Δoutside-GT ต่อคู่ **ก่อนสรุปว่า "ดีขึ้น/แย่ลง" ต้องดู reason เชิงกลไกประกอบเสมอ** (บทเรียนจาก CLAUDE.md §3.7: ผลอาจก้ำกึ่งและตีความผิดได้ถ้าดูแค่ตัวเลข) |

### สิ่งที่ต้องเตรียมเพิ่ม
- Storage ของ V02–V07 มีคีย์เฟรมอยู่แล้ว (ผ่าน pipeline ปกติ) — **ไม่ต้องเก็บ dataset ใหม่**
- ต้องเพิ่ม harness entry สำหรับ V03/V04/V05 เหมือนกับ Objective 1 (ใช้ entry เดียวกัน)
- ต้องเพิ่มความสามารถส่ง `-e VISUAL_CONTEXT=0` เข้า `docker compose exec` ตอนรัน harness (ไม่ต้องแก้ source — เป็น env var ที่มีอยู่แล้ว)
- ต้องมี protocol การอ่าน `reason` field เชิงคุณภาพที่ตกลงล่วงหน้า (เช่น checklist: "อ้างอิงภาพหรือไม่", "ระบุ outro/ฉากถูกไหม") ก่อนรัน ไม่ใช่ตีความหลังเห็นผลแล้ว

**พร้อมหรือไม่:** **NOT READY** — โครงสร้าง/dataset พร้อม (ไม่ต้องเก็บข้อมูลใหม่) แต่ยังไม่เคยรันบนชุด V01–V07 เลยสักครั้ง ต้องเพิ่ม harness entry (ร่วมกับ Objective 1) และตกลง checklist เชิงคุณภาพก่อนรันจริง

---

## 3. Objective 3 — Subtitle

### สถานะปัจจุบัน (จาก audit §10)
ไม่มี evidence ใด ๆ ในรอบทดสอบ 3 fixes ที่ผ่านมาเลย (ไม่ถูกแตะโดย fix ทั้ง 3 จึงไม่มี regression risk แต่ก็ไม่มีข้อมูลใหม่)

### กำหนดองค์ประกอบที่ต้องมี (ตามที่ผู้ใช้ระบุ)

| องค์ประกอบ | สถานะ | รายละเอียด |
|---|---|---|
| Dataset | **NOT READY** | ต้องเลือกชุดคลิปสำหรับทดสอบซับ — แนะนำใช้ชุด V02–V07 เดิม (มี transcript+words[] อยู่แล้วใน `preview.json`) เพื่อไม่ต้องเก็บข้อมูลใหม่ |
| Reference transcript | **บางส่วนพร้อม** | `preview.json` ทุกคลิปมี `transcript` (Whisper 3-pass) อยู่แล้ว แต่ **ไม่มี human-verified reference transcript แยกต่างหาก** สำหรับวัดความแม่นยำของ Whisper+AI-correction เทียบกับ "ควรจะเป็น" — ต้องมีคนถอดเทียบ (ground truth transcript) ซึ่งยังไม่มี |
| Metric ความแม่นยำ (CER หรือตาม Test Plan) | **NOT READY — ต้องยืนยันจาก Test Plan ฉบับจริง** | ไม่พบชื่อ metric ที่กำหนดไว้ในโค้ด repo ถ้า Test Plan ระบุ CER (Character Error Rate) หรือ WER (Word Error Rate) ต้องมี reference transcript ก่อนถึงจะคำนวณได้ — เป็น NOT READY เดียวกับข้อบน |
| Timing metric | **ต้องออกแบบใหม่** | ระบบมี invariant ที่วัดได้อยู่แล้ว (CLAUDE.md §6: `tail_pad`, `remap_edited_phrases`, ปัด 0.1 วิ) แต่ไม่มีการทดสอบเชิงปริมาณว่า "ซับตรงเวลาพูดแค่ไหน" — ต้องกำหนด metric (เช่น ค่าเฉลี่ย/max offset ของ `start`/`end` ซับเทียบกับขอบเขตคำพูดจริงจาก `words[]`) |
| Timing ground truth | **NOT READY** | ต้องมีคนตรวจว่าซับแต่ละบรรทัดขึ้น/ลงตรงกับที่พูดจริงหรือไม่ (sample-based) — ยังไม่มีชุดนี้ |
| Corrected text comparison | **บางส่วนพร้อม** | ระบบมี AI-Correction step (`🔧 [AI-Correct]`) อยู่แล้วและมี log ผลการแก้ แต่ไม่มีการวัดเชิงปริมาณว่าแก้ถูกกี่ % เทียบ reference |
| Editable subtitle test | **NOT READY** | ต้องทดสอบผ่านหน้า `SubtitleEditScreen.jsx` จริง (ผู้ใช้แก้ข้อความ/เวลา แล้วตรวจว่า render ออกมาตรงตามที่แก้) — เป็นการทดสอบ UI ไม่ใช่ core logic ล้วน ต้องมีคน/สคริปต์ driver ระดับ UI (เช่น Playwright) ซึ่งยังไม่มีในโปรเจกต์ |

**พร้อมหรือไม่:** **NOT READY ทั้งหมด** รายการที่ต้องเตรียมก่อนรันจริง: (1) เลือก/สร้าง human-verified reference transcript สำหรับอย่างน้อย 2–3 คลิป (2) กำหนด metric ตาม Test Plan ฉบับจริง (ยืนยันว่าใช้ CER/WER หรืออื่น) (3) กำหนด timing-accuracy metric + เก็บ timing ground truth แบบ sample (4) เตรียมวิธีทดสอบ editable-subtitle flow (คนจริงหรือ UI automation)

---

## 4. Objective 4 — UI / Human-in-the-loop

### แยกสิ่งที่ Claude/script ทดสอบได้ ออกจากสิ่งที่ต้องใช้คนจริง

| งาน | ใครทดสอบได้ | สถานะ |
|---|---|---|
| Functional: upload → process (endpoint จริงผ่าน FastAPI/Celery) | **Script/Claude ทดสอบได้** (integration test แบบ `test_core.py` หรือเรียก endpoint ตรงด้วย `requests`/`httpx`) | **NOT TESTED ในรอบ 3 fixes นี้** — evidence ที่มีจำกัดอยู่ที่ `analyze_video_content()` เท่านั้น ไม่ผ่าน endpoint จริง |
| Functional: `GET/POST /subtitle`, `render_only_task` | **Script/Claude ทดสอบได้** | **NOT TESTED** |
| Functional: หน้า Preview/Edit selection (`PreviewScreen.jsx`) | **ทดสอบตรรกะได้ด้วย script** (เช่น `useTimelineRows.js` เป็น pure function ตาม CLAUDE.md §7) **แต่การ "ใช้งานได้จริงจากมุมคน" ต้องมีคนคลิกจริง** | ตรรกะ: ทดสอบได้ · ประสบการณ์ใช้งานจริง: **ต้องใช้คน** |
| User edit → render (ผู้ใช้แก้ช่วง/ซับจริงแล้ว render ออกมาตรงที่แก้) | **ต้องใช้คนจริงอย่างน้อย 1 รอบ** เพื่อยืนยัน flow ครบ ; หลังจากนั้น script ทำซ้ำ (regression) ได้ | **NOT SET UP** |
| Manual vs AI-assisted (เทียบเวลา/คุณภาพระหว่างตัดเองล้วน ๆ กับใช้ระบบช่วย) | **ต้องใช้คนจริงทั้งสองฝั่ง** (ห้ามใช้ Claude แทนคนตามที่ผู้ใช้กำชับ) | **NOT SET UP** |
| Expert evaluation (ผู้เชี่ยวชาญตัดต่อ/สอนวิชาที่เกี่ยวข้องประเมินผลลัพธ์) | **ต้องใช้คนจริง** | **NOT SET UP** — ยังไม่มี rubric/เกณฑ์ให้ผู้เชี่ยวชาญใช้ |
| User evaluation (ผู้ใช้ทั่วไปทดลองใช้ระบบ) | **ต้องใช้คนจริง** | **NOT SET UP** |
| Task success / Task time | **วัดได้อัตโนมัติบางส่วน** (เวลาในการประมวลผลของระบบ วัดได้จาก log) **แต่ "task success ของผู้ใช้" (ทำงานสำเร็จตามเป้าหมายจริงไหม) ต้องมีคนทำ task แล้ววัด** | ระบบ: วัดได้ (`Total duration` ใน log มีอยู่แล้ว) · ผู้ใช้: **NOT SET UP** |
| Satisfaction / Perceived control / SUS | **ต้องใช้คนจริง (แบบสอบถาม)** — SUS ใช้ก็ต่อเมื่อ Test Plan ฉบับจริงระบุไว้ (ไม่พบใน repo นี้ ต้องยืนยันจากเอกสารภายนอก) | **NOT SET UP** |

### สิ่งที่ต้องเตรียมก่อนรัน
1. **Functional (endpoint/UI logic):** เขียน/รัน integration test ผ่าน FastAPI endpoint จริง (ไม่ใช่แค่เรียก `analyze_video_content` ตรง) — ทำได้โดย script/Claude ล้วน ๆ
2. **Human-in-the-loop:** ต้องมี (ก) rubric สำหรับ expert evaluation (ข) แบบสอบถามผู้ใช้ (มาตรฐาน เช่น SUS ถ้า Test Plan กำหนด) (ค) กลุ่มผู้เข้าร่วมจริง — **ไม่มีส่วนใดที่ Claude ควรทำแทน** ตามที่ผู้ใช้กำชับไว้ชัดเจนในรอบ audit ก่อนหน้า

**พร้อมหรือไม่:** ส่วน Functional (script-testable) **พร้อมเตรียมได้ทันที** ส่วน Human-in-the-loop **ไม่พร้อมเลย** ต้องออกแบบ protocol + หาผู้เข้าร่วมก่อน ซึ่งอยู่นอกเหนือขอบเขตที่ dev/audit รอบนี้ทำแทนได้

---

## 5. Final Evaluation Run Matrix

| Objective | Test | Dataset | Condition | n | Metric | Evidence (คาดว่าจะอยู่ที่) |
|---|---|---|---|---|---|---|
| 1 | AI Cut Detection E2E | V02,V03(full+sum),V04,V05,V06(full+sum),V07 (8 case) | โค้ด HEAD `1612888`, `gemini-2.5-flash` | 2–3 | Recall/Precision/F1/outside-GT/keep-violation | `eval/final-evaluation/objective1/` |
| 2 | Audio vs Audio+Visual | เหมือน Objective 1 (8 case) | `VISUAL_CONTEXT=1` vs `=0` | 2–3 ต่อ condition | เหมือน Objective 1 + checklist เชิงคุณภาพของ `reason` | `eval/final-evaluation/objective2/` |
| 3 | Subtitle accuracy (CER/WER ตาม Test Plan) | คลิปย่อย 2–3 คลิปที่มี reference transcript ใหม่ | โค้ด HEAD เดียวกัน | ยังกำหนดไม่ได้ (รอ reference transcript) | ตาม Test Plan ฉบับจริง | `eval/final-evaluation/objective3/` (ยังไม่มี) |
| 3 | Subtitle timing accuracy | เหมือนข้างบน | เหมือนข้างบน | ยังกำหนดไม่ได้ | offset เฉลี่ย/สูงสุดเทียบ `words[]` | ยังไม่มี |
| 3 | Editable subtitle flow | คลิปตัวอย่าง 1 คลิป | ผ่านหน้า `SubtitleEditScreen.jsx` จริง | 1 รอบ (คนจริง) ขึ้นไป | task success (แก้แล้ว render ตรงไหม) | ยังไม่มี |
| 4 | Functional (endpoint/UI logic) | 1–2 คลิปตัวอย่าง | FastAPI endpoint จริง (ไม่ผ่าน core function ตรง) | 1–2 | pass/fail ต่อ endpoint | `eval/final-evaluation/objective4-functional/` |
| 4 | Manual vs AI-assisted | คลิปตัวอย่าง (คนจริงเลือกเอง) | คนตัดเองล้วน ๆ vs ใช้ระบบช่วย | ผู้เข้าร่วมตามที่ออกแบบไว้ (คนจริง) | task time, task success | ยังไม่มี |
| 4 | Expert evaluation | ผลลัพธ์จาก Objective 1 (คลิปเดิม) | ผู้เชี่ยวชาญประเมินตาม rubric | ตามจำนวนผู้เชี่ยวชาญที่หาได้ | ตาม rubric (ยังไม่ออกแบบ) | ยังไม่มี |
| 4 | User evaluation / satisfaction | ผู้ใช้จริงทดลองระบบ | ตามที่ออกแบบ protocol | ตามจำนวนผู้เข้าร่วม | satisfaction/SUS (ถ้า Test Plan กำหนด) | ยังไม่มี |

---

## 6. Readiness Checklist

| Test | Ready | Missing | Action |
|---|---|---|---|
| Objective 1 — V02, V06×2, V07 (4/8 case) | **Ready** | — | รันได้ทันทีตาม §0/§1 |
| Objective 1 — V03×2, V04, V05 (4/8 case) | Not ready (เล็กน้อย) | เพิ่ม 4 entry ใน `analysis_harness.py RUNS` | เพิ่ม entry (ไม่แก้ source ระบบ, ข้อมูลพร้อมแล้ว) |
| Objective 2 — โครงสร้าง/dataset | Ready | ยังไม่เคยรันบนชุด V01–V07 | รันคู่กับ Objective 1 โดยเพิ่ม `-e VISUAL_CONTEXT=0` |
| Objective 2 — checklist เชิงคุณภาพของ `reason` | Not ready | ยังไม่มี checklist ตกลงล่วงหน้า | ออกแบบ checklist ก่อนรัน |
| Objective 3 — reference transcript | Not ready | ต้องมีคนถอดเทียบอย่างน้อย 2–3 คลิป | จัดหาคน/เวลาถอดเทียบ |
| Objective 3 — metric ที่ถูกต้อง | Not ready | ต้องยืนยันจาก Test Plan ฉบับจริงว่าใช้ metric อะไร | ตรวจเอกสาร Test Plan นอก repo |
| Objective 3 — timing ground truth | Not ready | ต้องมีคนตรวจ sample | จัดหาคน/เวลา |
| Objective 3 — editable subtitle test | Not ready | ต้องมีคนทดสอบ UI หรือ UI automation | เลือกวิธี (คนจริง แนะนำสำหรับรอบแรก) |
| Objective 4 — Functional (endpoint) | Not ready (เล็กน้อย) | เขียน integration test ผ่าน endpoint จริง | Claude/script ทำได้ ไม่ต้องใช้คน |
| Objective 4 — Human-in-the-loop ทั้งหมด | Not ready | protocol, rubric, ผู้เข้าร่วม | ต้องออกแบบและจัดหาแยกต่างหาก — **ไม่ใช้ Claude แทนคน** |
| Gemini reliability protocol | Ready (ออกแบบแล้วใน §0) | ยังไม่เคยใช้จริงกับชุด 8 case เต็ม | ใช้ตอนรัน Objective 1/2 |
| Ground Truth (V02–V07) | Ready | — | ใช้ของเดิม ห้ามแก้ |

---

## 7. ข้อจำกัดของแผนนี้ (ต้องระบุไว้ล่วงหน้า)

- แผนนี้อิง Test Plan ที่**อนุมานจากหลักฐานในระบบ ไม่ใช่เอกสารทางการ** — Objective 3/4 อาจต้องปรับ metric ให้ตรงกับที่วิทยานิพนธ์กำหนดจริง
- ทุกตัวเลขที่ระบุเป็น "n=2–3" เป็นคำแนะนำจาก audit ไม่ใช่ค่าบังคับ — ถ้าโควตา Gemini (20 คำขอ/วัน/โมเดล/คีย์ × 3 คีย์ = 60 คำขอ/วัน) ไม่พอสำหรับ 8 case × 3 n × ~5-8 คำขอ/run (Objective 1) บวกอีกเท่าตัวสำหรับ Objective 2 (audio-only) อาจต้องรันหลายวันหรือลด n ลง — ต้องวางแผนเรื่องเวลาไว้ล่วงหน้า ไม่ใช่ตัดสินใจกลางรอบ
- V01 ไม่มี Ground Truth และจะไม่ถูกนับใน Objective 1/2 ตลอดแผนนี้ (ใช้เป็น sanity check เท่านั้นถ้าต้องการ)
- เอกสารนี้ไม่ได้ยืนยันว่า "ระบบพร้อม Final Evaluation ทั้งระบบแล้ว" — เป็นแค่แผนเตรียมการ ยังไม่มีการรันใด ๆ ตามแผนนี้เกิดขึ้นจริง
