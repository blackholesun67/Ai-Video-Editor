# Final Evaluation — Results Template

- **อัปเดต 2026-09-23:** กรอกข้อมูลจริงแล้วสำหรับ **Objective 1 (ครบ) และ Objective 2 (ครบ)** — รันผ่าน `analysis_harness.py` จริงกับ Gemini จริง (`gemini-2.5-flash`, HEAD `822656f`) โควตาหมดทั้ง 4 key หลังรันเสร็จ (ไม่ใช่ error หรือบั๊ก) ; **Objective 3 และ 4 ยังเป็น TBD/NOT RUN ทั้งหมด** (4A ติดปัญหา auth — ต้องมี JWT token จากการ login จริง ไม่สามารถทดสอบอัตโนมัติได้ทั้งหมด ; Objective 3/4B/C/D ยังไม่เริ่มตามแผนที่ให้เว้นไว้ก่อน)
- **🔧 จุดแบ่ง pre-fix / post-fix (2026-09-23):** ข้อมูล Objective 1 และ Objective 2 ทั้งหมดในเอกสารนี้ (รวม V03_summary rep1 model-mismatch caveat ด้านล่าง) เก็บมาจาก **HEAD `822656f`** (ก่อนแก้) ซึ่งยังมีบั๊ก "429 daily-quota บน `gemini-2.5-flash` ทำให้ข้าม `gemini-3.6-flash` บน key เดิมไปเลย ไม่ลองก่อนสลับ key" — บั๊กนี้ถูกแก้ที่ commit `e136e8a` (2026-09-23 22:40:01 +0700, `fix: try fallback model on same key before exhausting key on daily-quota 429` — ดูรายละเอียดจุดที่แก้ใน commit message) **ข้อมูลใด ๆ ที่เก็บหลังจากนี้ (เช่น การเติม V07 ให้ครบ n=4, Objective 2 should-do tier) จะรันด้วยโค้ดที่แก้แล้ว — ห้ามนำมาเฉลี่ยรวมกับข้อมูล pre-fix โดยไม่ระบุแยก** เพราะโค้ด fallback logic ต่างกัน แม้จะไม่กระทบตรรกะการตัดสินใจของ Gemini เอง แต่กระทบว่า "รันไหนมีโอกาสได้ใช้ 3.6-flash มากกว่า" ซึ่งเป็นตัวแปรที่ควรควบคุมให้คงที่เมื่อเทียบกัน
- **⚠️ ผลการลองรัน post-fix รอบแรก (V07 top-up, 2026-09-23 หลัง `e136e8a`):** ล้มเหลวทั้ง 2 tag — โควตาหมดจริงทั้ง 4 key × ทั้ง 2 โมเดล (`gemini-2.5-flash` 429 ทุก key, `gemini-3.6-flash` 429/503 ทุก key เช่นกัน) ยืนยันว่าบั๊กที่แก้ไปทำงานถูกต้องแล้ว (ลอง 3.6-flash บน key เดิมจริงก่อนข้าม) แต่ครั้งนี้ไม่มีโควตาเหลือให้กู้คืนอะไรได้อีก — **หยุดตามคำสั่งผู้ใช้ ยังไม่ได้เริ่ม Objective 2 should-do tier เลย** ดูรายละเอียดที่ตาราง "Failed run" ด้านล่าง
- evidence ต้นทาง: `eval/final-evaluation/objective1/{rep1,rep2}/`, `metrics_combined.json` · `eval/final-evaluation/objective2/{rep1,rep2}/`, `metrics_combined.json`
- ห้ามใส่ตัวเลขที่ไม่ได้มาจาก evidence จริง (`preview.json`, `metrics.json`, แบบประเมิน/แบบสอบถามที่กรอกแล้ว) — ทุกช่องที่ยังไม่มีข้อมูลให้เขียน `TBD` หรือ `NOT RUN` ไว้ ไม่ใช่เว้นว่างเฉย ๆ (กันสับสนว่า "ยังไม่กรอก" กับ "กรอกแล้วว่าง")
- เมื่อกรอกจริง ให้อ้างอิงไฟล์ evidence ต้นทางไว้ในคอลัมน์/บรรทัดเดียวกันเสมอ (path ไปยัง `metrics.json`/`harness.log`/แบบประเมิน)

---

## 🏁 สรุปผลรวมสุดท้าย (Final Summary) — ปิดรอบเก็บข้อมูลอัตโนมัติ

**การตัดสินใจ (2026-09-23):** หยุดสายทดสอบ Gemini ไว้ที่จุดนี้ตามคำสั่งผู้ใช้ **ไม่รอโควตารีเซ็ตวันถัดไป** ข้อมูลในเอกสารนี้ทั้งหมดคือชุดข้อมูลสุดท้ายที่จะใช้เขียนบทที่ 4 (Objective 1/2) และรายงานสถานะ Functional Test (4A) — Objective 3 และ 4B/C/D ยังไม่เริ่มตามแผนเดิม (ดู `REMAINING-TESTS.md`)

### Objective 1 — AI Cut Detection (Audio+Visual): ข้อมูลเพียงพอสำหรับสรุปผล ✅
- 6/6 case หลักมี n≥3 — 5 case ได้ n=4 ครบ, **V07_full ได้ n=3 (ไม่ครบ 4) เพราะโควตาหมดกลางรันทั้ง 2 ครั้งที่พยายามเติม (pre-fix 1 ครั้ง + post-fix 1 ครั้ง — ดูตาราง Failed run) แต่ recall เท่ากันเป๊ะทุกรัน (100%, SD=0 ทั้ง 3 รัน) จึงถือว่าเพียงพอสำหรับสรุปผลโดยไม่ต้องรันเพิ่มอีก**
- Aggregate (6 case หลัก): Recall **61.65%** / Precision **83.56%** / Outside-GT **4.37s** / F1 ≈ **70.9%**
- ข้อมูลทั้งหมดที่ใช้คำนวณ aggregate เป็น **pre-fix** (HEAD `822656f`) — ความพยายาม top-up หลัง fix (`e136e8a`) ล้มเหลว จึงไม่มีข้อมูล post-fix ปนอยู่ในตัวเลขนี้

### Objective 2 — Audio-only vs Audio+Visual: required tier ครบ, should-do ไม่ได้ทำ ⚠️
- **Required tier (n≥2 ทุก case, audio-only, 9/9 case) ครบสมบูรณ์แล้ว** — เพียงพอสำหรับตอบคำถามเชิงทิศทางของ Objective 2
- **Should-do tier (n=4 สำหรับ 6 case หลัก) ไม่ได้ทำ** — พยายามแล้ว 1 ครั้งหลัง fix (`e136e8a`) ตามลำดับที่วางแผนไว้ (V07 ของ Objective 1 ก่อน แล้วค่อย Objective 2) แต่การพยายามเติม V07 (Objective 1) เจอว่าโควตาหมดทั้งระบบ (4 key × 2 model) จึงต้องหยุดตามเงื่อนไขที่ตกลงไว้ก่อนจะได้เริ่ม Objective 2 should-do แม้แต่รันเดียว
- ผลที่มีอยู่ (n=2–3 ต่อ case) พอบอกทิศทางได้ (audio-only recall ต่ำกว่า audio+visual ~10.1pp) แต่ **n ยังน้อยกว่า Objective 1 และ Gemini variability สูงมาก — ต้องรายงานเป็น "แนวโน้ม" ไม่ใช่ "ข้อสรุปเชิงสถิติที่มั่นใจสูง" ในบทที่ 4**
- Qualitative findings (`reason` field เทียบ audio-only vs audio+visual) **ยังไม่ได้ทำ** — งานนี้ไม่ต้องเรียก Gemini เพิ่ม ใช้ `harness.log`/`preview.json` ที่มีอยู่แล้วได้เลย เป็นงานที่ยังค้างอยู่ ไม่เกี่ยวกับโควตา

### Objective 4A — Functional Test: รอบใหม่หลัง rebuild PASS ระดับ API ตลอดสาย (UI ยังไม่ได้ทดสอบ) ✅⚠️

> **🔴 ผล 4A "รอบเก่า 2026-09-23" (ตารางในหัวข้อ "A. Functional" และรายการ 4 บรรทัดหลังตารางผลรอบใหม่ด้านล่าง) มาจาก "pre-rebuild image" (worker/backend build 2026-09-21 15:09) ซึ่งยังไม่มีการแก้ `5ad3d92`, `6decc1d`, `1612888`, `e136e8a` — ถือเป็นโมฆะ ไม่ใช้เป็นผลทดสอบของระบบที่แก้แล้ว**
> เหตุผล: ยืนยันแล้วว่า job ที่ล้มครั้งที่ 2 เกิดจากบั๊ก VAD-prefilter เดิมใน image เก่า (ไม่ใช่ cache) — ดู `objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md`
> **2026-09-24 14:01:** merge `feat/user-auth` → `main` (fast-forward, `e136e8a`, 51 commit), push ทั้งสอง branch ขึ้น origin, rebuild worker+backend สำเร็จ — ยืนยันใน container ใหม่: `VAD_PREFILTER_MIN_SPEECH` พบ 5 ครั้ง (เดิม 0), มีโค้ดแก้ `e136e8a` ครบ
> **ผล 4A ที่ใช้ได้จริง = รอบใหม่หลัง rebuild (2026-09-24) ด้านล่าง** ; ตารางเดิม (2026-09-23) เก็บไว้เป็นหลักฐานประวัติเท่านั้น

#### ✅ ผล 4A รอบใหม่ (post-rebuild, `main`=`e136e8a`, คลิป V02, ผ่าน endpoint จริง + JWT) — **PASS ระดับ API ตลอดสาย upload → preview → subtitle → edit → render → output**

| ขั้นตอน | ผล | หลักฐานสำคัญ |
|---|---|---|
| Upload | ✅ PASS | HTTP 200, job `c00c222e…` |
| Processing (ffmpeg→VAD→Cache→Gemini) | ✅ PASS | 26.0s ; VAD-prefilter `kept = 7/7` (รอบก่อนทิ้งหมด), `gemini-2.5-flash` key#1 attempt 1 |
| Preview data | ✅ PASS | `GET /preview` 200 |
| Subtitle (`POST /subtitle`) | ✅ PASS | 44 บรรทัด, นอก selection = 0 |
| Edit ซับ + บันทึก | ✅ PASS | `edited_subtitle_phrases` เก็บครบ |
| Render | ✅ PASS | 7.4s |
| Output | ✅ PASS | ความยาว 105.047s = ผลรวมช่วง 105.03s (`tail_pad=0`) ; ซับที่แก้ถูกเบิร์นจริง (ตรวจเฟรม t=3s, job เสริม burn=true) |

**ข้อจำกัดที่ต้องบอกให้ชัด:** (1) ทดสอบผ่าน API เท่านั้น — **พฤติกรรมของหน้าเว็บ (Preview UI, ไทม์ไลน์, ปุ่มดู/seek, select-deselect, split/merge, คืนค่า AI, หน้าแก้ซับ) ไม่ได้ทดสอบ** ต้องทดสอบด้วยมือ/เบราว์เซอร์ ; (2) AI เสนอ 0 ช่วงตัด — selection และการแก้ซับเป็นของที่ผมจำลอง ; (3) transcript เป็น Cache HIT (baseline เดิม) ยังไม่เคยทดสอบ Whisper สดผ่าน pipeline จริง ; (4) ตรวจออฟเซ็ตซับด้วยภาพจุดเดียว (ก่อนรอยตัด) ; (5) error handling ไฟล์เสีย/ผิดชนิดไม่ได้ทดสอบ — รายละเอียดทุกข้อ: `objective4/functional/run2-post-rebuild/checklist_result.md`
**ประวัติรอบเก่า 2026-09-23 (โมฆะ — เก็บไว้เป็นหลักฐาน ไม่ใช้เป็นผลทดสอบ):**
- ยืนยันได้ในรอบนั้น: auth, upload, ffmpeg extract, VAD, Whisper/transcript-cache, keyframe extraction, เรียก Gemini (200 OK), error handling/status reporting
- **ทดลอง 2 ครั้ง ไม่ถึงขั้น preview/edit/render/output ทั้งคู่ (คนละสาเหตุ):** ครั้งแรกล้มเพราะโควตาหมด (429 ทุก key) ; ครั้งที่สองล้มเพราะ **worker รัน image เก่าที่ยังไม่มีการแก้ VAD-prefilter** (ยืนยัน 2026-09-24 — เดิมสรุปผิดว่าเป็น transcript_cache เพี้ยน ถอนแล้ว — ดูหัวข้อ "ข้อจำกัดที่พบระหว่างทดสอบ" ด้านล่าง) — **ยังไม่มีหลักฐานจริงของขั้น preview/edit/render/output เลยแม้แต่ครั้งเดียว**
- รอบเก่าไม่ได้ลองครั้งที่ 3 เพราะสั่งหยุดสายทดสอบ Gemini — ต่อมา (2026-09-24) rebuild แล้วรันใหม่สำเร็จ ดูตารางผลรอบใหม่ด้านบน
- **สถานะสุดท้ายของ 4A (ปัจจุบัน): PASS ระดับ API ตลอดสาย upload→output ; พฤติกรรมหน้าเว็บ (UI) ยังไม่ได้ทดสอบ**

### สิ่งที่ไม่ได้ทำในรอบนี้ (บันทึกไว้ให้ชัดว่า "ตั้งใจหยุด" ไม่ใช่ "ลืมทำ")

| รายการ | สถานะ | เหตุผลที่หยุด |
|---|---|---|
| Objective 1: V07 top-up เป็น n=4 | พยายามแล้ว ไม่สำเร็จ | โควตาหมดทั้งระบบ — ใช้ n=3 (SD=0) แทนได้ |
| Objective 2: should-do tier (n=4, 6 case) | ไม่ได้เริ่มเลย | โควตาหมดทั้งระบบ (พบระหว่างพยายามเติม V07 ของ Objective 1 ก่อนหน้า) |
| Objective 2: qualitative `reason`-field checklist | ยังไม่ได้ทำ | **ไม่เกี่ยวกับโควตา** — เป็นงานวิเคราะห์ log ที่มีอยู่แล้ว ทำต่อได้ทันทีโดยไม่ต้องเรียก Gemini |
| Objective 4A (รอบเก่า 2026-09-23 — โมฆะ, แทนด้วยรอบใหม่ PASS ระดับ API) | ไม่ถึงขั้นนี้ 2 ครั้งติด | ครั้ง 1 โควตาหมด, ครั้ง 2 worker รัน image เก่าก่อนแก้ VAD-prefilter (ยืนยัน 2026-09-24 ไม่ใช่ cache bug) — หยุดตามคำสั่ง ไม่ลองครั้งที่ 3 |
| Objective 3 (subtitle) | ไม่ได้เริ่ม | ตามแผนเดิม ต้องใช้ reference data + คนภายนอก — ดู `objective3/DATA-SETUP.md`, `REMAINING-TESTS.md` |
| Objective 4B/C/D (expert/user/manual-vs-AI) | ไม่ได้เริ่ม | ตามแผนเดิม ต้องใช้ผู้เข้าร่วมจริง — ดู `objective4/PARTICIPANT-PLAN.md`, `REMAINING-TESTS.md` |

---

## Objective 1 — AI Cut Detection (Audio+Visual, `VISUAL_CONTEXT=1`, HEAD `822656f`, `gemini-2.5-flash`)

### Per-case result

| Case | n ที่รันจริง | Recall (เฉลี่ย) | Precision (เฉลี่ย) | Outside-GT (วิ, เฉลี่ย) | Keep-violation (วิ, เฉลี่ย) | Evidence path |
|---|---|---|---|---|---|---|
| V01_full | 2 | N/A (sanity only) — pipeline รันจบสำเร็จทั้ง 2 ครั้ง | N/A | N/A | N/A | `objective1/rep1/{after,control-old}/V01_full/` |
| V02_full | 4 | 50.6% (ทุกรันเท่ากันเป๊ะ, SD=0) | 96.0% | 0.2s | 0.0s | `objective1/{rep1,rep2}/*/V02_full/` |
| V03_full | 2 | N/A (โดยดีไซน์ — ดู objective1/README.md) | N/A (cuts=[] ทั้งคู่) | 0.0s | 0.0s | `objective1/rep1/*/V03_full/` |
| V03_summary | 4 | 63.6% (พิสัย 0–100%) | 92.3% | 2.6s | 0.0s | `objective1/{rep1,rep2}/*/V03_summary/` |
| V04_full | 4 | 27.5% (พิสัย 0–52.4%) | 56.6% | 4.7s | 0.0s | `objective1/{rep1,rep2}/*/V04_full/` |
| V05_full | 2 | N/A (over-cutting control) | N/A | **0.0s** | **0.0s** | `objective1/rep1/*/V05_full/` |
| V06_full | 4 | 66.5% (พิสัย 54.1–82.3%) | 81.8% | 7.2s | 5.7s | `objective1/{rep1,rep2}/*/V06_full/` |
| V06_summary | 4 | 61.7% (พิสัย 32.9–88.3%) | 82.0% | 8.1s | 5.0s | `objective1/{rep1,rep2}/*/V06_summary/` |
| V07_full | 3 (1 run error — โควตาหมดกลางรัน) | 100% (ทุกรันเท่ากันเป๊ะ, SD=0) | 92.7% | 3.4s | 0.0s | `objective1/{rep1,rep2}/*/V07_full/` |

### Aggregate metric (เฉลี่ยของ 6 case-mean เต็มรูปแบบ: V02, V03_summary, V04, V06_full, V06_summary, V07 — ไม่รวม V01/V03_full/V05_full)

| Metric | ค่า | หมายเหตุ |
|---|---|---|
| Recall เฉลี่ย (ข้าม 6 case) | **61.65%** | คำนวณจาก `eval/tools/score_final_eval.py` → `metrics_combined.json` (เฉลี่ยของค่าเฉลี่ยต่อ case ไม่ใช่ pool ทุก run รวมกัน) |
| Precision เฉลี่ย | **83.56%** | |
| Outside-GT เฉลี่ย | **4.37s** | |
| F1 | ยังไม่คำนวณ (ไม่ได้อยู่ใน field ของ `score.py`) — คำนวณเพิ่มได้จาก 2·P·R/(P+R) = 2×0.8356×0.6165/(0.8356+0.6165) ≈ **70.9%** ถ้าต้องการรายงาน |

### Over-cutting signal (V05_full โดยเฉพาะ — คลิปควบคุมที่ GT ไม่มีอะไรควรตัดเลย)

| Metric | ค่า |
|---|---|
| cut_s | **0.0s ทั้ง 2 รัน** |
| outside_gt_s | **0.0s ทั้ง 2 รัน** |
| การตีความ | ระบบไม่ตัดอะไรออกจากคลิปควบคุมนี้เลยทั้ง 2 ครั้งที่รัน — ไม่มี false-positive ที่วัดได้ในคลิปนี้ |

### Failed run

| Case | Run | Error code | ข้อความ | Evidence path |
|---|---|---|---|---|
| V07_full | rep2/after ("new" tag) | 429 RESOURCE_EXHAUSTED | `Quota exceeded ... limit: 20, model: gemini-2.5-flash` (โควตาหมดพอดีที่ run สุดท้ายของวัน) | `objective1/rep2_out.txt` |
| V07_full | **rep3/after + rep3/control-old (POST-FIX, HEAD `e136e8a`)** | ทั้ง 4 key × ทั้ง 2 model หมด/ใช้ไม่ได้จริง | `gemini-2.5-flash`: 429 quota exceeded ทั้ง 4 key ; `gemini-3.6-flash` (หลังแก้บั๊กแล้ว จึงถูกลองจริงบน key เดิมก่อนข้าม): key#1,#2 = 429 quota exceeded เช่นกัน · key#3,#4 = 503 UNAVAILABLE (server overload ชั่วคราว หลัง retry 2 ครั้งแล้วยังไม่หาย) → **สรุปว่าโควตาหมดจริงทั้งระบบ ไม่ใช่บั๊ก fallback อีกต่อไป** (เดิมจะไปไม่ถึง 3.6-flash เลย ตอนนี้ไปถึงแล้วแต่ก็หมด/ไม่ว่างจริง) — หยุดตามคำสั่ง ไม่ retry เอง | `objective1/rep3_out.txt`, `objective1/rep3_stderr.txt`, `objective1/rep3/{after,control-old}/V07_full/harness.log` |
| **Objective 2 should-do tier** | ไม่ได้เริ่มรัน | — | ข้าม (สั่งหยุดหลังพบว่าโควตาหมดทั้งระบบจากการทดสอบ V07 top-up ด้านบน — ยังไม่มีข้อมูล post-fix ของ Objective 2 เลยแม้แต่รันเดียว) | — |

### Variability (ระหว่าง run ของ case เดียวกัน, โค้ดเดียวกันทุกครั้ง)

| Case | recall ต่ำสุด–สูงสุด | พิสัย (pp) | การตีความ |
|---|---|---|---|
| V02_full | 50.6%–50.6% | 0 | เสถียรมาก (Gemini ตอบเหมือนเดิมทุกรัน) |
| V03_summary | 0%–100% | 100 | แปรปรวนสูงมาก ⚠️ ดู caveat ด้านล่าง |
| V04_full | 0%–52.4% | 52.4 | แปรปรวนสูง |
| V06_full | 54.1%–82.3% | 28.2 | แปรปรวนปานกลาง |
| V06_summary | 32.9%–88.3% | 55.4 | แปรปรวนสูงมาก |
| V07_full | 100%–100% | 0 | เสถียรมาก |

**⚠️ Caveat — V03_summary rep1 (ตรวจ log ย้อนหลังพบ model mismatch):** rep1 ของ V03_summary: tag "after" สำเร็จบน `gemini-2.5-flash` แต่ tag "control-old" หลุดไปสำเร็จบน `gemini-3.6-flash` เนื่องจาก 503 server overload ในจังหวะที่ต่างกัน ทำให้การเปรียบเทียบ old-vs-new ของ rep นี้ไม่เป็นไปตามหลักตัวแปรควบคุมครบถ้วน 100% ควรตีความตัวเลข recall ของ rep1 คู่นี้ด้วยความระมัดระวัง (rep อื่นของเคสเดียวกัน และเคสอื่นทั้งหมด ไม่มีปัญหานี้) — รายละเอียดเต็ม (log บรรทัดต่อบรรทัด, root cause 503 ไม่ใช่บั๊ก daily-quota-skip) อยู่ใน session ตรวจสอบวันที่ 2026-09-23

### Limitations
- V03_full/V05_full: recall เป็น N/A โดยดีไซน์ (ไม่ใช่ข้อจำกัดของการรัน) — ดู `objective1/README.md`
- V07_full ได้แค่ n=3 (ไม่ใช่ n=4) เพราะโควตาหมดพอดีที่ run สุดท้าย
- Gemini variability สูงมากในหลายคลิป (V03_summary, V06_summary พิสัยเกิน 50pp) — ตัวเลข aggregate จึงมีความไม่แน่นอนสูง ต้องรายงาน "aggregate ± พิสัยของแต่ละคลิป" ไม่ใช่ตัวเลขเดียวเฉย ๆ ในบทที่ 4
- n=2 (V01, V03_full, V05_full) ไม่ได้อัป n=4 เพราะโควตาหมดก่อน (V01/V05 ไม่มี GT ให้วัดเพิ่มอยู่แล้วจึงไม่จำเป็น ; V03_full ก็ไม่จำเป็นเพราะ recall คงเป็น N/A เสมอ)

---

## Objective 2 — Audio Only vs Audio+Visual (HEAD `822656f`, `gemini-2.5-flash`)

### Audio-only (`VISUAL_CONTEXT=0`)

| Case | n | Recall (เฉลี่ย) | Precision (เฉลี่ย) | Outside-GT (เฉลี่ย) | Evidence path |
|---|---|---|---|---|---|
| V01_full | 2 | N/A (sanity) | N/A | N/A | `objective2/rep1/*/V01_full/` |
| V02_full | 2 | 25.3% | 96.0%* (1 run มี cut, อีก run cuts=[]) | 0.1s | `objective2/{rep1,rep2}/*/V02_full/` |
| V03_full | 2 | N/A (โดยดีไซน์) | N/A | 0.0s | `objective2/rep2/*/V03_full/` |
| V03_summary | 2 | 36.8% | 96.1%* | 0.65s | `objective2/rep2/*/V03_summary/` |
| V04_full | 3 | 27.2% | 75.2%* | 2.7s | `objective2/{rep1,rep2}/*/V04_full/` |
| V05_full | 2 | N/A (over-cutting control) | N/A | **0.0s** | `objective2/rep1/*/V05_full/` |
| V06_full | 2 | 61.5% | 81.3% | 7.25s | `objective2/rep2/*/V06_full/` |
| V06_summary | 2 | 58.3% | 79.8% | 10.35s | `objective2/rep2/*/V06_summary/` |
| V07_full | 2 | 100% | 92.7% | 3.4s | `objective2/rep2/*/V07_full/` |

*precision เฉลี่ยเฉพาะ run ที่มี cuts (run ที่ cuts=[] ให้ precision=null ไม่นับ)

### Aggregate (6 case เต็มรูปแบบ เหมือนเกณฑ์ Objective 1)

| Metric | Audio-only | Audio+Visual (Objective 1) | Δ |
|---|---|---|---|
| Recall เฉลี่ย | **51.5%** | **61.65%** | **-10.1pp** (audio-only ต่ำกว่า) |
| Precision เฉลี่ย | **86.8%** | **83.56%** | **+3.3pp** (audio-only สูงกว่า) |
| Outside-GT เฉลี่ย | 4.07s | 4.37s | -0.3s |

### Comparison (Δ ต่อ case, audio+visual − audio-only)

| Case | Audio-only recall | Audio+Visual recall | Δ | หมายเหตุ |
|---|---|---|---|---|
| V02_full | 25.3% (n=2) | 50.6% (n=4) | +25.3pp | ภาพช่วยให้ตัดตรง GT ได้บ่อยขึ้น |
| V03_summary | 36.8% (n=2) | 63.6% (n=4) | +26.8pp | เช่นกัน |
| V04_full | 27.2% (n=3) | 27.5% (n=4) | ~0 | ใกล้เคียงกันมาก |
| V06_full | 61.5% (n=2) | 66.5% (n=4) | +5.0pp | ใกล้เคียงกัน |
| V06_summary | 58.3% (n=2) | 61.7% (n=4) | +3.4pp | ใกล้เคียงกัน |
| V07_full | 100% (n=2) | 100% (n=3) | 0 | เท่ากันเป๊ะทั้งสองเงื่อนไข |

**⚠️ ข้อควรระวังก่อนสรุป:** n ของสองเงื่อนไขไม่เท่ากัน (audio-only ส่วนใหญ่ n=2, audio+visual ส่วนใหญ่ n=4) และ Gemini มีความแปรปรวนสูงมากอยู่แล้วแม้โค้ด+เงื่อนไขเดียวกัน (ดูตาราง Variability ของ Objective 1) — ความต่างที่เห็น **อาจเป็นความแปรปรวนปกติ ไม่ใช่ผลจากภาพจริง ๆ** โดยเฉพาะ V04/V06 ที่ต่างกันน้อย ; V02/V03_summary ต่างกันมากกว่า 25pp ซึ่งมากกว่าที่เคยเห็นจาก run-to-run variance ของคลิปเดียวกัน (V02 เคย SD=0 ในทุก audio+visual run) จึงเป็นสัญญาณที่น่าสนใจกว่า — **ต้องดู qualitative (`reason` field) ประกอบก่อนสรุปว่าภาพช่วยจริง**

### Qualitative findings (Checklist จาก objective2/PROTOCOL.md)

| Case | อ้างอิงภาพใน reason หรือไม่ | ระบุ outro ถูกไหม | ตัด/เก็บ CTA | false negative เปลี่ยนไหม |
|---|---|---|---|---|
| ทุกเคส | **TBD — ยังไม่ได้ตรวจ** | TBD | TBD | TBD |

**สรุป:** **ยังสรุปไม่ได้ว่า "ภาพช่วยจริงหรือไม่"** — มีตัวเลขเชิงปริมาณครบแล้ว (n=2-4 ต่อคลิป) แต่ยังไม่ได้อ่าน `reason` field ของ Gemini เทียบ 2 เงื่อนไขตาม checklist ที่ออกแบบไว้ (ขั้นตอนนี้ไม่ต้องใช้ Gemini เพิ่ม ทำได้จาก `harness.log`/`preview.json` ที่มีอยู่แล้ว เป็นงานที่ควรทำต่อก่อนเขียนบทที่ 4)

---

## Objective 3 — Subtitle

### Text accuracy

| Case | Metric ที่ใช้ (ยืนยันจาก Test Plan) | ค่า | Reference path | System output path |
|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD |

### Timing

| Case | Timing metric | ค่าเฉลี่ย offset (วิ) | ค่าสูงสุด offset (วิ) |
|---|---|---|---|
| TBD | TBD | TBD | TBD |

### Editability (editable-subtitle test)

| Case | ทำสำเร็จหรือไม่ | ปัญหาที่พบ (ถ้ามี) | Evidence path |
|---|---|---|---|
| TBD | TBD | TBD | TBD |

### Limitations
- TBD

---

## Objective 4 — Functional + Human

### A. Functional — ~~PASS บางส่วน~~ **โมฆะ (pre-rebuild image) — รอรันใหม่หลัง rebuild 2026-09-24** (ตารางเดิมเก็บเป็นประวัติ: ทดสอบด้วย JWT token, 2026-09-23)

| ขั้นตอน | ผล | หมายเหตุ | Evidence path |
|---|---|---|---|
| 1. Upload | ✅ **PASS** | HTTP 200, auth ผ่าน (JWT), job สร้างสำเร็จ | `job_id=95a30f6c...`, `job_id=5ab40c1a...` |
| 2. Processing (ffmpeg extract → VAD → Whisper/cache → keyframe) | ✅ **PASS** (ถึง progress 62%) | ทุกขั้นย่อยทำงานถูกต้อง รวม audio-hash transcript cache (ตามที่ CLAUDE.md §4 อธิบายไว้) | log worker, `extracted_audio.wav` (SHA-256 ตรงกับต้นฉบับ 100%) |
| 3. Gemini call (AI-Correct + Deletion) | ✅ **PASS** (เรียกสำเร็จ ได้ 200 OK จริง) | ระบบ fallback ข้าม key/model ที่โควตาหมดได้ถูกต้อง (ไม่มี backoff ตอน 429 — ดูหมายเหตุ) | worker log, ดูตาราง request sequence ด้านล่าง |
| Error handling / status reporting | ✅ **PASS** | `FAILURE` + ข้อความอ่านได้ชัดเจนทั้ง 2 แบบ (quota exhausted, "AI ไม่สามารถระบุช่วงที่เก็บได้") ส่งกลับ `/status` ถูกต้อง ไม่ค้างเงียบ | — |
| 4-7. Preview/select-deselect/edit/render/output | ⬜ **ไม่ถึงขั้นนี้** | job ทั้ง 2 ครั้งล้มก่อนถึงขั้นนี้ (ครั้งแรก: โควตาหมด ; ครั้งสอง: worker รัน image เก่าก่อนแก้ VAD-prefilter — ยืนยัน 2026-09-24 ไม่ใช่ cache bug) | — |

**⚠️ [แก้ไข 2026-09-24 — ข้อความเดิมด้านล่างนี้ถูกถอนบางส่วนแล้ว ดูหัวข้อ "ข้อจำกัดที่พบระหว่างทดสอบ"]** เดิมรายงานว่า transcript cache เก็บผล Whisper ที่เพี้ยน ("2 segments, 2 chars") — **ตรวจซ้ำพบว่าเนื้อหา cache จริงปกติดี (515 ตัวอักษร, อ่านได้)** ส่วนที่ยังถูกต้อง: ตรวจสอบแล้วว่า**ไม่ใช่ปัญหาไฟล์เสียง** (SHA-256 ตรงกับต้นฉบับ 100%, mean_volume -23.7dB ปกติ) **ไม่ใช่ปัญหา VAD** (พารามิเตอร์เหมือนกันทุกจุด, ผลตรงกับ baseline เป๊ะ: speech 44.8s/silence 50.0s) — เป็นครั้งแรกในรอบทดสอบทั้งวันนี้ที่มีการถอดเสียงสดผ่าน pipeline จริง (Objective 1/2 ทั้งหมดฉีด transcript จาก baseline ไม่เคยเรียก Whisper ใหม่) จึงไม่เคยมีโอกาสเจอปัญหานี้มาก่อน รายละเอียดเต็ม: `objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md`

**Request sequence (job 5ab40c1a, ตอบคำถามเรื่อง backoff):**

| # | Key | Model | ผล | เวลา |
|---|---|---|---|---|
| 1-2 | key#1 | gemini-2.5-flash | 429 (×2 พร้อมกัน) | 12:26:16.6 |
| 3-4 | key#2 | gemini-2.5-flash | 429 (×2) | 12:26:16.7–17.3 |
| 5 | key#3 | gemini-2.5-flash | 429 | 12:26:17.3 |
| 6 | key#3 | gemini-2.5-flash | **200 OK** | 12:26:30.5 |
| 7 | key#3 | gemini-2.5-flash | **200 OK** (call ที่ 2 ใช้เวลา 94 วิ) | 12:28:04.1 |

**ยืนยัน: ไม่มี backoff ระหว่าง 429 ที่ติดกัน** (ช่วง #1→#5 ห่างกัน <1 วินาทีต่อคู่) ตรงกับที่อ่านโค้ดไว้ก่อนรัน (`ai_logic.py:2295-2393` — 429 กรณี PROJECT/DAILY ไม่มี `time.sleep()` เลย ต่างจาก 503 ที่มี backoff 10×(attempt+1) วิ) — ยืนยันด้วยพฤติกรรมจริงแล้ว ไม่ใช่แค่จากการอ่านโค้ด

### เปรียบเทียบกับความแปรปรวนใน Objective 2 (ข้อสังเกต ไม่ใช่ข้อสรุป)
ดูรายละเอียดเต็มใน `objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md` §3 — สรุปสั้น: เหตุการณ์นี้เกิดที่ชั้น **Whisper transcription** (input เสียก่อนถึง Gemini) ซึ่งเป็นคนละชั้นกับความแปรปรวนของ **Gemini decision-making** ที่พบใน Objective 2 (input สมบูรณ์เหมือนกันทุกรอบ) — น่าจะเป็นคนละสาเหตุ แต่มี n=1 เหตุการณ์เท่านั้น ยังฟันธงไม่ได้

### B. Expert

| Participant | Case | มิติ 1 | มิติ 2 | มิติ 3 | มิติ 4 | ความเห็นเปิด |
|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD |

**Inter-rater agreement:** TBD

### C. User

| Participant | Task success | เวลารวม (นาที) | Satisfaction | Perceived control | ความเห็นเปิด |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD |

**Task success rate:** TBD/TBD (TBD%)

### D. Manual vs AI-assisted

| Participant | เวลา Manual (นาที) | เวลา AI-assisted (นาที) | Satisfaction Manual | Satisfaction AI-assisted | ความเห็นเปิด |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD |

### Limitations (รวม Objective 4)
- จำนวนผู้เข้าร่วมจริงเทียบกับแผน: TBD (ยังไม่เริ่ม B/C/D)
- ข้อจำกัดของ within-subject design (ถ้ามี): TBD

### 🐛 ข้อจำกัดที่พบระหว่างทดสอบ / แนวทางพัฒนาต่อในอนาคต

**🔴 แก้ไข (2026-09-24): ข้อสรุปเดิม "transcript_cache เก็บผล Whisper ที่เพี้ยน (2 chars)" ไม่มีหลักฐานรองรับ — ถอนข้อสรุปนี้แล้ว**

ตอนเตรียม pre-deploy check ได้เปิดไฟล์ cache จริง (`transcript_v2_5909864efe5691c3.json`) มาวัด พบว่า
เนื้อหาเป็นข้อความไทยที่อ่านได้ปกติ (515 ตัวอักษร, `avg_logprob` -0.27/-0.25 อยู่ในเกณฑ์ "ได้ใจความ")
และคำนวณ VAD-overlap ซ้ำแล้วพบว่าทั้ง 2 segment **ผ่านเกณฑ์ VAD-prefilter (45%+ ทั้งคู่ จากเกณฑ์ 20%)**
— ไม่ตรงกับที่เคยรายงานไว้ว่า "2 chars, แทบว่างเปล่า" เลย ตอนตรวจสดวันที่ 2026-09-23 อ่าน log
`[Transcript] 0 segments, 2 chars → Gemini` แล้วสรุปโดยไม่ได้เปิดไฟล์ cache จริงมาเทียบ — เป็นข้อผิดพลาด
ของการสรุปตอนนั้น รายละเอียดเต็มอยู่ที่ `objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md`
(หัวข้อ "แก้ไขข้อสรุป" ด้านบนของไฟล์)

**✅ สาเหตุจริง (ยืนยันแล้ว 2026-09-24):** container `worker` ที่ทำ 4A รัน **image เก่า (build 2026-09-21 15:09)
ซึ่งยังไม่มีการแก้ VAD-prefilter (`5ad3d92`, commit 18:05) และการแก้อื่นทั้ง 4 commit** — log ของ job จริงเป็น
รูปแบบเก่า `Removed 2 silent segments, kept 0/2` และ `grep VAD_PREFILTER_MIN_SPEECH` ใน container ได้ 0 ครั้ง
ตัวกรองเก่าทิ้ง V07 ทั้ง 2 ท่อนจนเหลือ 0 → Gemini ได้ `"[]"` (2 chars) → keep=0 → FAILURE — คือ**บั๊ก VAD-prefilter
เดิมที่แก้ในซอร์สแล้ว** ไม่ใช่บั๊ก cache ใหม่ ; job แรกก็เป็น Cache HIT เช่นกัน (cache ลงวันที่ 2026-09-21 =
transcript baseline เดิม ไม่ใช่ Whisper สด) **ข้อสรุป: 4A ยังไม่เคยทดสอบโค้ดที่แก้แล้ว และยังไม่เคยทดสอบ Whisper สด
ผ่าน pipeline จริง — ต้อง rebuild image ก่อนทดสอบ/deploy** ผลนี้ไม่กระทบ Objective 1/2 (harness โหลดโค้ดใหม่จาก /tmp)

**ตรวจ cache ทั้งหมดในระบบเพิ่มเติม (2026-09-24):** สแกน `transcript_v2_*.json` ทั้ง 17 ไฟล์ที่มีอยู่จริง
ด้วยเกณฑ์ "ตัวอักษรรวมต่ำผิดปกติ (<30 ตัว)" — **ไม่พบไฟล์ใดเข้าเกณฑ์นี้เลยสักไฟล์ รวมถึงไฟล์ที่เคยสงสัยด้วย**
ไม่พบสัญญาณของ transcript ที่เพี้ยน/ว่างเปล่าค้างอยู่ใน cache ปัจจุบัน

- **ยังคงเป็นความจริง (ไม่เปลี่ยน):** ไฟล์เสียงไม่เพี้ยน, พารามิเตอร์ VAD เหมือนกันทุกจุด, กลไก cache ผูกกับ
  SHA-256 ของไฟล์เสียงจริง (CLAUDE.md §4) ไม่มี quality gate ก่อนบันทึกจริง (แต่ยังไม่มีหลักฐานว่าเคยเก็บ
  ของเพี้ยนไว้จริง)
- **แนวทางพัฒนาต่อที่เสนอเดิม (เพิ่ม quality gate ก่อน cache) — เลื่อนไว้ก่อน** จนกว่าจะพบเคสที่ยืนยันได้จริงว่า
  cache เก็บของเพี้ยน ไม่ควรรีบใส่ guard ที่เดา threshold โดยไม่มีข้อมูลรองรับ (ผิดหลักการของโปรเจกต์เอง — ดู
  CLAUDE.md ข้อ 0.3)
- **ผลกระทบต่อความถูกต้องของ Objective 1/2 ที่ทำไปแล้ว:** **ไม่มี** — Objective 1/2 ทั้งหมดใช้ transcript ที่
  ฉีดจาก baseline โดยตรง ไม่ผ่าน cache mechanism นี้เลย
- **สิ่งที่ควรทำต่างจากเดิมถ้าจะสืบสาเหตุจริงในอนาคต:** เก็บ raw Gemini response (ไม่ใช่แค่ log ที่ print) ของ
  job ที่ล้มไว้เป็นไฟล์แยกเสมอ — ครั้งนี้ไม่มีไฟล์นี้เก็บไว้ จึงยืนยันจุดที่ transcript หายไปจริง ๆ ไม่ได้

---

## หมายเหตุก่อนกรอกจริง

1. อัปเดตหัวข้อสถานะบนสุดของไฟล์นี้จาก "ว่างเปล่าโดยตั้งใจ" เป็นวันที่/commit ที่ใช้รัน Final Evaluation จริง
2. ทุกตัวเลขต้องอ้าง evidence path ที่ตรวจสอบย้อนกลับได้จริง — ห้ามพิมพ์ตัวเลขลอย ๆ
3. ถ้า Objective ใดยังไม่มีข้อมูลครบ ให้คงคำว่า `NOT RUN`/`TBD` ไว้ ห้ามลบแถวทิ้งหรือใส่ N/A ปนกับ TBD (ความหมายต่างกัน: N/A = วัดไม่ได้โดยดีไซน์, TBD = ยังไม่ได้รัน)
