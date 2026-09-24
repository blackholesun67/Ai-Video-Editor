# Final Evaluation — Execution Plan

- สถานะ: **แผนปฏิบัติเท่านั้น ยังไม่มีการเรียก Gemini จริง / ไม่แก้ backend / ไม่แก้ Ground Truth / ไม่ commit source**
- อ้างอิงหลักฐานที่อ่านแล้วก่อนเขียนแผนนี้: `eval/final-evaluation-plan.md`, `eval/final-evaluation/{MASTER-MATRIX,READINESS}.md`, `eval/final-evaluation/objective{1,2,3,4}/*.md`, `eval/pre-final-audit.md`, HEAD ปัจจุบัน `822656f`

---

## 0. ⚠️ พบ Test Plan ฉบับจริงบางส่วน — ต้องอ่านก่อนสิ่งอื่น

### SOURCE FOUND (บางส่วน): `docs/REPORT_NOTES.md` §1.3–1.4

เอกสารนี้ (ชื่อ "บันทึกสำหรับเขียนปริญญานิพนธ์") มี **วัตถุประสงค์อย่างเป็นทางการ 5 ข้อ** — ไม่ใช่ 4 ข้อแบบที่ใช้กันมาตลอดเซสชันนี้:

1. ถอดเสียง + วิเคราะห์ระบุช่วงที่ควรตัด (= "Objective 1" ที่ทำแผนไว้แล้ว)
2. นำข้อมูลจากภาพมาร่วมตัดสินใจ ไม่ใช่เสียงอย่างเดียว (= "Objective 2")
3. สร้างคำบรรยายไทยที่ตรงจังหวะพูดจริง แก้ไขได้ (= "Objective 3")
4. ส่วนติดต่อผู้ใช้ให้คนตรวจสอบ/ปรับแก้ผล AI ได้ก่อนตัดต่อจริง (= "Objective 4")
5. **รองรับผลลัพธ์ทั้ง 16:9 และ 9:16 — ไม่เคยอยู่ในแผน Objective 1–4 ที่ทำมาทั้งเซสชันนี้เลย**

**สิ่งที่ต้องรายงานตรงไปตรงมา:** ทุกเอกสารที่สร้างไว้ก่อนหน้านี้ (`final-evaluation-plan.md`, `MASTER-MATRIX.md`, `READINESS.md`, `objective1-4/*`) **ไม่ครอบคลุม Objective 5** เพราะตอนสร้างไม่พบเอกสารนี้ (`docs/` ไม่เคยถูกค้นมาก่อนในรอบก่อน ๆ) **ข่าวดี:** Objective 5 มีหลักฐานเชิงวิศวกรรมที่วัดแล้วอยู่ในระบบพร้อมใช้เขียนบทที่ 4 ได้เลย โดยไม่ต้องรัน Final Evaluation ใหม่ — ดูหัวข้อ 0.3

### SOURCE NOT FOUND: นิยาม metric อย่างเป็นทางการของ Objective 3/4

`docs/REPORT_NOTES.md` ให้แค่ **วัตถุประสงค์และขอบเขต** (§1.3–1.4) ไม่มีส่วนไหนกำหนด metric อย่างเป็นทางการ (ค้นด้วย `grep` ทั่วไฟล์: ไม่มีคำว่า "recall", "precision", "CER", "WER", "SUS", "แบบสอบถาม", "ผู้เชี่ยวชาญ" หรือ "V01"–"V07" เลยแม้แต่ครั้งเดียว — เอกสารนี้เขียนไว้**ก่อน**ชุดข้อมูล Ground Truth V01–V07 จะถูกสร้างขึ้นด้วยซ้ำ) และค้นทั้ง repo แล้วไม่พบไฟล์ Test Plan อื่นที่ระบุ metric ของ Objective 3 (ความแม่นยำซับ) หรือ Objective 4 (เครื่องมือประเมินคนจริง เช่น SUS) เลย

**ต้องใช้เอกสารใดตัดสิน:** เอกสารวิทยานิพนธ์ฉบับที่ส่งอาจารย์ที่ปรึกษา หรือแบบฟอร์ม/เกณฑ์ที่มหาวิทยาลัย/ภาควิชากำหนดไว้สำหรับการประเมินบทที่ 4 — **ไม่มีในโค้ด repo นี้** ต้องให้ผู้ใช้ยืนยันจากเอกสารภายนอกก่อนล็อก metric ของ Objective 3/4 ตามที่ audit และแผนก่อนหน้าระบุไว้แล้ว (ยังไม่เปลี่ยนแปลง)

### 0.3 Objective 5 — 16:9/9:16: มีหลักฐานพร้อมใช้แล้ว ไม่ต้องรัน Final Evaluation ใหม่

`docs/REPORT_NOTES.md` §4.4 + `CLAUDE.md` §6.1 มีการวัดเชิงวิศวกรรมไว้ครบ: ปัญหาการ crop คลิป 2.35:1 เหลือ 24% ของความกว้าง, การพิสูจน์ว่า face-aware crop แก้ได้แค่ 2/12 เฟรม, การเลือกใช้ blur-pad แทน (แก้ได้ 12/12 เฟรม) — เป็นหลักฐานเชิงคุณภาพที่วัดจากข้อมูลจริงแล้ว ใช้เขียนบทที่ 4 ได้ทันทีโดยไม่ต้องรัน Gemini เพิ่มหรือหาคนทดสอบเพิ่ม **แนะนำ:** เพิ่ม Objective 5 เป็นหัวข้อย่อยในบทที่ 4 โดยอ้างอิงหลักฐานที่มีอยู่แล้วนี้ตรง ๆ ไม่ต้องเปิด Final Evaluation รอบใหม่สำหรับมัน

**คำถามที่ต้องให้ผู้ใช้ตัดสินใจ (ไม่ใช่สิ่งที่ Claude ควรตัดสินใจเอง):** จะรวม Objective 5 เข้าไปในขอบเขตของ Final Evaluation รอบนี้อย่างเป็นทางการไหม (แค่เพิ่มหัวข้อในบทที่ 4 โดยไม่ต้องทดสอบเพิ่ม) — แผนที่เหลือของเอกสารนี้ยังคง**เดินหน้าตาม Objective 1–4 ตามที่สั่งไว้เดิม** และถือว่า Objective 5 เป็นข้อเสนอเพิ่มเติมที่รอการยืนยัน

---

## 1. Current State (ตรวจซ้ำแล้ว)

| รายการ | ผล |
|---|---|
| HEAD | `822656f` (test: prepare final evaluation harness and protocols) |
| 3 fix commits อยู่ครบ | `5ad3d92`/`4308882` (VAD Filter) → `6decc1d` (Snap/Word-Bound) → `1612888` (Silence Gap) |
| source ปัจจุบัน = VAD+SilenceGap+Snap รวมกัน | ยืนยัน — `git diff HEAD -- backend/core/ai_logic.py` = 0 บรรทัด (working tree ตรง HEAD เป๊ะ) |
| Ground Truth ไม่เปลี่ยน | ยืนยัน — `git diff 4189548 -- '*/ground_truth.txt'` = 0 บรรทัด |
| Baseline evidence ไม่เปลี่ยน | ยืนยัน — `git diff cc454df -- eval/V0x eval/logs.sha256` = 0 บรรทัด |
| final-evaluation preparation files | ครบตามที่ commit `822656f` (harness 9 case, score wrapper, 4 objective protocol, master matrix, readiness) |
| git status | มีแค่ของค้างจากรอบก่อนที่ไม่เกี่ยวกับ milestone นี้ (`eval/vad-filter-fix/metrics.json` M, `gemini-quota-check/`, `archive-before-quota-reset/`, `gemini_ping.py`, `gemini_quota_matrix.py`, `vad-filter-fix/{after,control-old,...}`) — ไม่แตะในรอบนี้ |

---

## 2. งานตั้งแต่นี้จนพร้อมเขียนบทที่ 4 — แยกตามประเภท

### A. งานที่ Claude/script ทำได้เลย (ไม่ต้องรอ Gemini/คน)
- เตรียม/ตรวจ harness, scoring script (เสร็จแล้วจาก `822656f`)
- เขียน checklist/protocol/template สำหรับทุก Objective (เอกสารนี้ + ไฟล์ที่จะสร้างในรอบนี้)
- Objective 4.A (Functional test) — เตรียม integration test script ผ่าน endpoint จริงได้เอง (แต่การ "รัน" ยังต้อง trigger pipeline จริงซึ่งเรียก Gemini ภายใน — รันได้ก็ต่อเมื่อได้รับคำสั่งเรียก Gemini)
- คำนวณ/สรุปผลหลังมีข้อมูลจริง (สร้าง final report จาก raw evidence)

### B. งานที่ต้องเรียก Gemini
- Objective 1: รัน harness จริงกับ 9 case (batch ตามหัวข้อ 4)
- Objective 2: รัน harness จริงเงื่อนไข Audio-only (เงื่อนไข Audio+Visual reuse จาก Objective 1 ได้)
- Objective 3: ถ้าต้องวัด "Corrected text comparison" (AI-Correction เทียบ reference) จะต้องเรียก Gemini อีกครั้งสำหรับคลิปที่เลือก (แต่ transcription/timing ดิบไม่ต้องใช้ Gemini)
- Objective 4.A: การรันจริงผ่าน endpoint (upload→process) เรียก Gemini ภายใน pipeline

### C. งานที่ต้องใช้คนจริง (ห้าม Claude ทำแทน)
- Objective 3: ถอดเสียง reference transcript + กำกับ reference timing
- Objective 3: ทดสอบ editable-subtitle flow ผ่าน UI จริง (แนะนำให้คนทำ เพราะไม่มี UI automation อยู่แล้ว)
- Objective 4.B: Expert evaluation
- Objective 4.C: User evaluation
- Objective 4.D: Manual vs AI-assisted

### D. งานที่ทำ parallel ได้ — ดูตารางเต็มในหัวข้อ 6
สรุปสั้น: **C (งานที่ต้องใช้คนจริง — เตรียม reference/rubric/questionnaire/หาผู้เข้าร่วม) ทำคู่ขนานกับ B (รอบ Gemini ของ Objective 1/2) ได้ทั้งหมด** เพราะไม่ใช้ทรัพยากรร่วมกัน — นี่คือจุดประหยัดเวลาที่สำคัญที่สุดของแผนนี้

### E. งานที่ต้องทำตามลำดับ
1. Objective 1 ต้องรันเสร็จก่อน Objective 2 เงื่อนไข B (audio+visual) จึงจะ "เสร็จ" ได้ (แต่เงื่อนไข A รันคู่ขนานกับ Objective 1 ได้เลยถ้าไม่กังวลเรื่อง quota ร่วม — ดูหัวข้อ 5)
2. Objective 3/4 ต้องมี reference/rubric/questionnaire (งาน C) ก่อนจึงจะรันได้จริง
3. Objective 4.B/C/D ควรใช้คลิปผลลัพธ์จาก Objective 1 เป็น stimulus — ต้องรอ Objective 1 เสร็จอย่างน้อยบางส่วนก่อน

### F. งานที่ไม่จำเป็นต้องทำ (สำหรับรอบนี้)
- **ห้ามแก้/ทดสอบ VAD Filter, Silence Gap, Snap/Word-Bound เพิ่ม** เว้นแต่ Final Evaluation ค้นพบบั๊กใหม่ที่ยืนยันได้จากการรันจริง (ดูหัวข้อ 8)
- ไม่ต้องแก้บั๊ก `call_gemini_with_retry` (quota-per-model misclassification) — deferred ตามคำสั่งผู้ใช้รอบก่อน ไม่กระทบความถูกต้องของผล Final Evaluation (กระทบแค่ความเร็วตอน key แรกโดนโควตาโมเดลหลักหมด)
- ไม่ต้องสร้าง UI automation (Playwright/Cypress) ใหม่สำหรับ Objective 3/4 — ใช้คนทดสอบตรง ๆ ถูกกว่าในสเกลนี้ (2-3 คลิป, ไม่ใช่ regression suite ระยะยาว)
- ไม่ต้องรัน Objective 1/2 กับ V01 เกิน n=1 (ไม่มี GT ให้วัดอะไรเพิ่ม)

---

## 3. Objective 1 — AI Cut Detection: การจำแนก 9 case

| Case | ประเภท | เหตุผล | ใช้ใน aggregate metric อะไร |
|---|---|---|---|
| `V01_full` | **Sanity only** | ไม่มี `ground_truth.txt` เลย (ยืนยันด้วย `git log --all`) | ไม่ใช้เลย — แค่ยืนยันว่า pipeline รันจบไม่ crash |
| `V02_full` | **Quantitative (เต็มรูปแบบ)** | มี GT ครบ, ประเภทตัดหลากหลาย | recall + precision + F1 + outside-GT + keep-violation |
| `V03_full` | **Limited quantitative** | GT ไฟล์นี้เขียนไว้สำหรับ `mode: summary` (มีแค่ TANGENT ใน SHOULD_CUT) → recall จะเป็น **N/A เสมอโดยดีไซน์** (TANGENT ไม่อยู่ใน `ALLOWED["full"]`) | **ตัดออกจาก aggregate recall** ; ใช้ precision/outside-GT/keep-violation ได้ตามปกติ (รายงานแยกเป็น footnote ไม่ใช่ปนกับคลิปอื่น) |
| `V03_summary` | **Quantitative (เต็มรูปแบบ)** | GT ตรงกับโหมดที่ใช้จริง | recall + precision + F1 + outside-GT + keep-violation |
| `V04_full` | **Quantitative (เต็มรูปแบบ)** | มี GT ครบ | ครบทุก metric |
| `V05_full` | **⚠️ Limited quantitative — พบเพิ่มเติมในรอบนี้ ยังไม่เคยถูกระบุมาก่อน** | `eval/V05/ground_truth.txt` เป็น "คลิปควบคุมเพื่อวัดว่าตัดเกินไหม" — `[SHOULD_CUT]` ว่างเปล่าโดยตั้งใจ → **recall เป็น N/A โดยดีไซน์เหมือน V03_full** (allowed_total = 0) แต่ด้วยเหตุผลคนละแบบ (ไม่ใช่ mode mismatch แต่เป็น "ไม่มีอะไรควรตัดเลย") | **ตัดออกจาก aggregate recall เช่นกัน** — แต่เป็น case ที่**สำคัญที่สุด**สำหรับวัด **false-positive / over-cutting rate** (`outside_gt_s`, `keep_violation_s`, `cut_s` ควรเข้าใกล้ 0 ถ้าระบบทำงานถูก) ต้องรายงานแยกเป็นหัวข้อ "การตัดเกิน" ในบทที่ 4 ไม่ใช่ปนกับ recall aggregate |
| `V06_full` | **Quantitative (เต็มรูปแบบ)** | มี GT ครบ, มีเคสเทคซ้ำจริง | ครบทุก metric |
| `V06_summary` | **Quantitative (เต็มรูปแบบ)** | มี GT ครบ | ครบทุก metric |
| `V07_full` | **Quantitative (เต็มรูปแบบ)** | มี GT ครบ, เป็นเคสหลักที่ยืนยัน Snap fix | ครบทุก metric |

**สรุป:** aggregate recall/precision/F1 (ตัวเลขหลักที่จะขึ้นบทที่ 4) ควรคำนวณจาก **6 case เต็มรูปแบบ** (V02, V03_summary, V04, V06_full, V06_summary, V07) ; V03_full และ V05_full รายงานแยกเป็น footnote เฉพาะทาง (precision-only / over-cutting-only ตามลำดับ) ; V01 เป็น sanity ไม่มีตัวเลข

### n ที่เหมาะสม (ประหยัด quota แต่ยังอธิบายได้ — ไม่ลด n โดยไม่มีเหตุผล)

**กลไกที่ต้องใช้ประโยชน์:** ตาม `objective1/README.md` — ตั้งค่า `/tmp/ai_logic_old.py` = `/tmp/ai_logic_new.py` = โค้ด HEAD เดียวกัน ก่อนรัน harness แต่ละครั้ง **1 การรัน harness ต่อ 1 case (1 "case-slot" ใน `HARNESS_RUNS`) ให้ผลลัพธ์ 2 จุดข้อมูลอัตโนมัติ** (tag `old` + `new` = โค้ดเดียวกัน 2 ครั้ง) — จึงได้ **n=2 "ฟรี" จากการรัน 1 ครั้งต่อ case** ไม่ต้องรันซ้ำเอง

| ระดับ | n | วิธีทำ | เหตุผล |
|---|---|---|---|
| **REQUIRED FOR FINAL REPORT** | n=2 ทุก case ที่มี GT (8 case) + n=1 สำหรับ V01 | รัน `HARNESS_RUNS=V01_full,V02_full,V03_full,V03_summary,V04_full,V05_full,V06_full,V06_summary,V07_full` **ในคำสั่งเดียว** (1 docker exec invocation) | Pre-Final Audit พบ variability สูงมาก (recall ต่างกันถึง 42pp ด้วยโค้ด+อินพุตเดียวกัน) — n=1 ใช้สรุปไม่ได้ ; n=2 คือพื้นล่างที่สุดที่ยังพอเห็นพิสัยของความแปรปรวนได้ ห้ามลดต่ำกว่านี้ |
| **SHOULD DO** | n=4 สำหรับ 6 case เต็มรูปแบบ (V02, V03_summary, V04, V06×2, V07) | รันเพิ่มอีก 1 invocation แยก (`HARNESS_RUNS=V02_full,V03_summary,V04_full,V06_full,V06_summary,V07_full`) เพื่อได้ tag old+new อีกคู่ (รวมเป็น n=4 สำหรับ 6 case นี้) | เพิ่มความมั่นใจของตัวเลขหลักที่จะขึ้นบทที่ 4 โดยไม่เพิ่ม case ใหม่ ; ทำไม n=4 ไม่ใช่ n=3: กลไก old=new ให้ผลเป็นคู่เสมอ (2,4,6,...) การขอ n=3 ต้องทิ้ง 1 จุดข้อมูลทั้งที่มีอยู่แล้วโดยไม่มีประโยชน์ |
| **OPTIONAL / NICE TO HAVE** | n=6+ | รันเพิ่มอีก invocation | ลด confidence interval ต่อไปอีก แต่ผลตอบแทนลดลง (diminishing returns) เมื่อเทียบกับ quota ที่ใช้ |

**รวม operational overhead: 2 harness invocations เท่านั้น** สำหรับ "REQUIRED + SHOULD DO" ทั้งหมดของ Objective 1 (ไม่ใช่ 9 หรือ 15 ครั้งแยกทีละ case) — นี่คือจุดประหยัดเวลาที่สำคัญที่สุดของ Objective 1

**ประมาณการ Gemini request:** จาก log จริงของรอบก่อน (Silence Gap rerun ใช้ 52 คำขอสำหรับ ~8 run-unit รวม retry) เฉลี่ย **~6.5 คำขอ/run-unit** (สูงกว่ากรณีไม่มี retry เพราะรอบนั้นเจอ 429/503 หลายครั้ง) ; กรณีไม่มี error จะต่ำกว่านี้มาก (1-2 คำขอ/run-unit: AI-Correct ถ้ามีอักษรละติน + Deletion 1 ครั้ง) **ประมาณการช่วงกว้าง:** REQUIRED (18 run-unit: 9 case × 2) ≈ 18–120 คำขอ ; SHOULD DO เพิ่มอีก (12 run-unit: 6×2) ≈ 12–80 คำขอ — เทียบกับโควตา 60 คำขอ/วัน/โมเดล/คีย์ × 3 คีย์ = 180/วัน ทำได้ในวันเดียวถ้าไม่เจอ error รัว ๆ แต่ควรเผื่อ 1-2 วันถ้าเจอ 503 บ่อย (ประสบการณ์จริงจากรอบก่อน)

---

## 4. Objective 2 — Audio Only vs Audio+Visual: reuse strategy

### Reuse ผล Objective 1 เป็นเงื่อนไข "Audio+Visual" — **ได้ ภายใต้เงื่อนไขนี้เท่านั้น:**

1. Objective 1 ต้องรันด้วย `VISUAL_CONTEXT=1` (ค่า default ของระบบ — ไม่ต้องตั้ง env พิเศษ) — **ถ้ารัน Objective 1 ตามหัวข้อ 3 โดยไม่ใส่ `-e VISUAL_CONTEXT=...` เลย จะได้ค่านี้อัตโนมัติ** ไม่ต้องทำอะไรเพิ่ม
2. โค้ด/model/prompt/dataset ต้องเป็นชุดเดียวกันทุกประการ (ล็อกไว้แล้วตามหัวข้อ 7)
3. ต้องรันครบ **ก่อน** เริ่มเงื่อนไข Audio-only เพื่อให้แน่ใจว่าไม่มีอะไรเปลี่ยนระหว่างสองเงื่อนไข (source lock)

ถ้าเงื่อนไข 1–3 ผ่านครบ **ไม่ต้องรัน Gemini ซ้ำสำหรับเงื่อนไข Audio+Visual เลย** — ประหยัดครึ่งหนึ่งของ Objective 2 ทันที

### Audio-only ต้องรันใหม่กี่ case

เท่ากับ Objective 1 ทุกประการ (9 case, n=2 required + n=4 should-do สำหรับ 6 case หลัก) ด้วยกลไก old=new เดียวกัน แค่เพิ่ม `-e VISUAL_CONTEXT=0` ในคำสั่ง:

```
REQUIRED: HARNESS_RUNS=<9 case เดิม>       -e VISUAL_CONTEXT=0   (1 invocation)
SHOULD DO: HARNESS_RUNS=<6 case หลักเดิม>  -e VISUAL_CONTEXT=0   (1 invocation)
```

**รวม Objective 1+2: 4 harness invocations ทั้งหมด** (2 สำหรับ Objective 1 ที่ VISUAL_CONTEXT=1 = ใช้ร่วมกับ Objective 2 เงื่อนไข B, อีก 2 สำหรับ Objective 2 เงื่อนไข A) — ไม่ใช่ 4 (Obj1) + 4 (Obj2) = 8 แบบที่จะเป็นถ้าไม่ reuse

### วิธีลดจำนวน Gemini call เพิ่มเติม (OPTIONAL / NICE TO HAVE)

- ถ้า quota จำกัดมาก อาจรัน Audio-only เฉพาะ **6 case เต็มรูปแบบ** (ตัด V01/V03_full/V05_full ออก เพราะไม่มี recall ให้เปรียบเทียบอยู่แล้ว) — ลด case จาก 9 เหลือ 6 ; **แต่ V05_full ควรพิจารณาเก็บไว้** เพราะ over-cutting-under-visual เป็นคำถามที่น่าสนใจ (ภาพอาจช่วยลด false-positive ได้) — เป็น OPTIONAL ไม่ใช่ REQUIRED
- Qualitative Review Checklist (`objective2/PROTOCOL.md`) ไม่ต้องทำกับทุก case — เลือก 3-4 case ที่มีความแตกต่างชัดเจนที่สุดหลังเห็นตัวเลข (แต่ต้องเลือก**หลังเห็นผลแล้ว**ตามเกณฑ์ที่ตั้งไว้ล่วงหน้า ไม่ใช่เลือกเอาแต่เคสที่สวย)

---

## 5. Parallel / Sequential

| งาน | ทำได้เลย | ต้องรออะไร | Parallel ได้ไหม |
|---|---|---|---|
| Objective 1 preparation | ✅ (เสร็จแล้ว) | — | — |
| Objective 2 preparation | ✅ (เสร็จแล้ว) | — | — |
| Objective 3 reference setup (คนถอดเสียง+กำกับเวลา) | ✅ เริ่มได้ทันที | ไม่ต้องรอ Gemini | ✅ **ขนานกับ Objective 1/2 Gemini run ได้เต็มที่** |
| Objective 4 protocol (rubric/questionnaire ฉบับเต็ม + หาผู้เข้าร่วม) | ✅ เริ่มได้ทันที | ไม่ต้องรอ Gemini | ✅ **ขนานกับ Objective 1/2 Gemini run ได้เต็มที่** |
| Functional test (4.A) เตรียม script | ✅ เริ่มได้ทันที | — | ✅ ขนานได้ |
| Functional test (4.A) รันจริง | ต้องรอคำสั่งเรียก Gemini | Gemini quota (ใช้ร่วมกับ Objective 1/2) | ⚠️ แย่ง quota กับ Objective 1/2 ถ้ารันวันเดียวกัน — แนะนำรันคนละวันหรือหลัง Obj1/2 เสร็จ |
| Gemini run (Objective 1/2) | ต้องรอคำสั่งอนุญาตเรียก Gemini จริง | — | เป็นแกนหลักที่งานอื่นรอ ควรเริ่มก่อนสุดในกลุ่มที่ใช้ Gemini |
| Human test (4.B/C/D) | ต้องมี rubric/questionnaire + ผู้เข้าร่วม + คลิปผลลัพธ์จาก Obj1 | รอ (ก) protocol เตรียมเสร็จ (ข) Objective 1 มีผลอย่างน้อยบางส่วน | ✅ เตรียม protocol ขนานกับ Gemini run ได้ แต่ **รันจริง**ต้องรอผล Obj1 |

**หลักการ: งานกลุ่ม C (ต้องใช้คนจริง — การเตรียมการ ไม่ใช่การรันจริง) ทำขนานกับงานกลุ่ม B (Gemini run) ได้ทั้งหมด** — นี่คือวิธีลดเวลารอ quota ที่มีประสิทธิภาพที่สุด: เริ่มหาคนถอดเสียง/หาผู้เชี่ยวชาญ/ออกแบบแบบสอบถามได้ตั้งแต่วันแรก ไม่ต้องรอ Objective 1/2 เสร็จก่อน

---

## MINIMUM-SUFFICIENT-TESTS

**"ถ้าต้องการให้บทที่ 4 ครบและตอบ Objective 1–4 โดยไม่ทำงานเกินจำเป็น ต้องทำอะไรบ้าง?"**

### Must do
- Objective 1: n=2 ทุก 9 case (2 harness invocations ตามหัวข้อ 3) — ขาดไม่ได้ ไม่มี n=2 ตอบ Objective 1 ไม่ได้เลย
- Objective 2: n=2 เงื่อนไข Audio-only ทุก 9 case (reuse เงื่อนไข Audio+Visual จาก Objective 1) — ขาดไม่ได้ มิฉะนั้นไม่มีข้อมูลตอบ Objective 2 เลย
- Objective 3: reference transcript + reference timing ของอย่างน้อย **2 คลิป** (ขั้นต่ำที่ยังพอพูดถึงความแม่นยำได้ ไม่ใช่แค่ 1 คลิปซึ่งอาจเป็น edge case) + ยืนยัน metric จาก Test Plan ฉบับจริง (ห้ามเดา) + editable-subtitle test อย่างน้อย 1 รอบ (คนจริง)
- Objective 4.A: Functional checklist รันจริงอย่างน้อย 1 รอบครบ 7 ขั้น (upload→output verification)
- Objective 4.B: Expert evaluation อย่างน้อย **2 คน** (ขั้นต่ำที่พอเห็น inter-rater ได้บ้าง — ต่ำกว่านี้ประเมินความน่าเชื่อถือของ rubric เองไม่ได้เลย)
- Objective 4.C: User evaluation — จำนวนขึ้นกับที่ Test Plan ฉบับจริงกำหนด (ยังไม่ทราบ — ต้องยืนยันก่อน) ถ้าไม่มีระบุ แนะนำขั้นต่ำ **5 คน** (มาตรฐานทั่วไปสำหรับ usability pilot ขนาดเล็ก ไม่ใช่ตัวเลขจาก Test Plan)
- Objective 4.D: Manual vs AI-assisted — อย่างน้อย **3 คน** (within-subject, พอเห็นแนวโน้มแต่ยังไม่ใช่สถิติเต็มรูปแบบ)

### Should do
- Objective 1: n=4 สำหรับ 6 case เต็มรูปแบบ (ความมั่นใจของตัวเลขหลักที่จะอ้างในบทที่ 4)
- Objective 2: n=4 สำหรับ 6 case เดียวกัน + qualitative checklist ครบทุก case ที่มีความต่างชัดเจน
- Objective 3: reference data ครบ **3 คลิป** (เผื่อ 1 คลิปเป็น outlier)
- Objective 4.C: 8-10 คน (เพิ่มความน่าเชื่อถือของสถิติ satisfaction/task-success)

### Optional
- Objective 1/2: n>4, หรือทดสอบ V01/V03_full/V05_full ในเงื่อนไข Audio-only เพิ่มเติม
- Objective 3: reference ครบทุกคลิปใน V02–V07 (6 คลิป)
- Objective 4: SUS เต็มรูปแบบถ้า Test Plan ไม่ได้บังคับ (ใช้แบบสอบถามสั้นกว่าได้ถ้าจำเป็น) หรือเพิ่มจำนวนผู้เข้าร่วมเกินขั้นต่ำ

---

## 6. หลักการที่ต้องล็อกก่อนเริ่ม Final Evaluation จริง

| พารามิเตอร์ | ค่าที่ล็อก |
|---|---|
| source commit | `822656f` (หรือ commit ถัดไปถ้ามีการแก้บั๊กใหม่ที่ยืนยันแล้วจาก Final Evaluation เอง — ต้องบันทึก protocol change ถ้าเปลี่ยน) |
| model | `gemini-2.5-flash` (ไม่สลับกลางรอบ) |
| prompt version | ตาม `ai_logic.py` ที่ HEAD เดียวกัน |
| config | `VISUAL_CONTEXT` เปลี่ยนได้เฉพาะระหว่างเงื่อนไข A/B ของ Objective 2 เท่านั้น ตัวแปรอื่นคงที่ |
| dataset | 9 case ตามที่กำหนดใน `objective1/README.md` |
| Ground Truth | `eval/V0x/ground_truth.txt` ตรวจ diff = 0 ก่อน/หลังทุกรอบ |
| run count (n) | ตามหัวข้อ 3 (2 required / 4 should-do) |
| error handling | บันทึก 429/503/404 ทุกครั้งใน `harness.log`, ไม่รันซ้ำอัตโนมัติ |
| Gemini failure policy | mark failed run, เก็บ evidence, ไม่เปลี่ยน protocol กลางทาง |
| metric definitions | `score()` เดิมจาก `eval/tools/score.py` ไม่แก้ |

**หลังเริ่ม Final Evaluation แล้ว ห้ามเปลี่ยนค่าใดในตารางนี้กลางทางโดยไม่มีบันทึก "Protocol Change Log"** (ถ้าจำเป็นต้องเปลี่ยนจริง ๆ เช่น โมเดลถูกปิดใช้งานกะทันหัน ให้บันทึกเหตุผล+เวลา+ผลกระทบไว้ในไฟล์ผลลัพธ์ ไม่ใช่เงียบ ๆ เปลี่ยนแล้วรวมข้อมูลปนกัน)

---

## 7. อะไร "ไม่ต้องทำอีกแล้ว" หลังจากนี้

**หยุดแก้ทันทีและไม่กลับไปแตะ เว้นแต่ Final Evaluation พบบั๊กใหม่ที่ยืนยันได้จากการรันจริง (ไม่ใช่ความสงสัยเฉย ๆ):**

- ❌ VAD Filter Fix (`filter_transcript_by_vad`, `VAD_PREFILTER_MIN_SPEECH`) — ปิดแล้ว มี regression evidence ครบ
- ❌ Silence Gap Fix (`_vad_silence_gaps`, `_long_silence_gaps`) — ปิดแล้ว มี regression evidence ครบ
- ❌ Snap/Word-Bound Fix (`_is_silence_boundary`, `_word_bound`) — ปิดแล้ว ผ่านทุกระดับการทดสอบ (unit/synthetic/regression/E2E)
- ❌ Step 5 (กฎ 5 วินาที) — ยืนยันแล้วว่าเป็น intended behavior ไม่ใช่บั๊ก (Pre-Final Audit §6)
- ❌ Retake/Duplicate guard — ไม่มี regression จาก 3 fixes, false positive ที่รู้อยู่แล้วเป็น limitation ที่บันทึกไว้แล้ว ไม่ใช่สิ่งที่ต้องแก้ตอนนี้
- ❌ บั๊ก `call_gemini_with_retry` quota misclassification — deferred ตามคำสั่งผู้ใช้ ไปแก้ตอน "ปรับปรุงระบบ" รอบหลัง

**เป้าหมาย:** ป้องกันไม่ให้ project กลับเข้าวงจร test→fix→test→fix ไม่จบสิ้น — จากนี้ไปคือ**เก็บข้อมูลตามแผน แล้วเขียนรายงาน** ไม่ใช่แก้โค้ดเพิ่ม

---

## 8. Final Readiness Decision

### READY NOW (ทำได้ทันทีโดยไม่ต้องเตรียมอะไรเพิ่ม)
- Objective 1 harness/scoring (9 case, ตรวจแล้วครบ)
- Objective 2 harness/scoring (dataset+protocol พร้อม)
- Objective 4.A functional checklist (พร้อมรัน)
- เริ่มหา reference-transcriber, ผู้เชี่ยวชาญ, ผู้เข้าร่วม user test (งานเตรียมการ ไม่ใช่งานที่ต้องรอ)

### NEED PREPARATION
- Objective 3: metric ยืนยันจาก Test Plan จริง, เลือกคลิป, หาคนถอดเสียง
- Objective 4.B/C/D: เขียน rubric/questionnaire ฉบับเต็ม (ตอนนี้มีแค่โครงในไฟล์ PROTOCOL.md)

### HUMAN REQUIRED
- Objective 3: ถอดเสียง reference, กำกับเวลา, ทดสอบ editable-subtitle
- Objective 4.B/C/D ทั้งหมด

### GEMINI REQUIRED
- Objective 1 (ทุก case)
- Objective 2 เงื่อนไข Audio-only
- Objective 3 (ถ้าจะวัด corrected-text comparison)
- Objective 4.A (การรันจริงผ่าน endpoint)

### NOT NECESSARY (สำหรับ Final Report รอบนี้)
- แก้ไข/ทดสอบเพิ่มของ 3 fixes ที่ปิดแล้ว (หัวข้อ 7)
- UI automation ใหม่สำหรับ Objective 3/4 (ใช้คนทดสอบตรง ๆ คุ้มกว่าที่สเกลนี้)
- แก้บั๊ก quota-classification ที่ deferred ไว้
- ทดสอบ Objective 1/2 เกิน n=4 สำหรับตัวเลขหลัก (diminishing returns)
