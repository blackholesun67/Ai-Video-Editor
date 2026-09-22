# Pre-Final Audit — ก่อน Final Evaluation (บทที่ 4)

- ทำเมื่อ: 2026-09-22 · โหมด: **audit-only** (อ่านหลักฐาน + ตรวจสอบ ไม่แก้อะไร)
- **ไม่มีการแก้ source / เฉลย / threshold / prompt / rerun ใด ๆ ระหว่างทำ audit นี้**
- HEAD ที่ตรวจ: `1612888` (branch `feat/user-auth`)
- git identity ที่ยืนยันแล้ว: `chirat-t <466415241007-st@rmutsb.ac.th>` (local, ไม่ใช่ global)

> **สถานะล่าสุด (อัปเดตหลังรอบเตรียม Final Evaluation):** เอกสารนี้เป็น snapshot ของสถานะ ณ วันที่ทำ audit (Objective 1 final-output มีแค่ 4/7 คลิป ตามที่บันทึกไว้ในหัวข้อ 13–14 ด้านล่าง) — **ตัวเลข "4/7" และ "8 case" ในเอกสารนี้ถูกแทนที่แล้วโดยงานเตรียม Final Evaluation รอบถัดมา**: `eval/tools/analysis_harness.py` ขยายรองรับครบ **9 case** แล้ว (เพิ่ม V01 เข้ามาด้วย เทียบกับ 8 case ที่เอกสารนี้แนะนำไว้) โครงสร้าง/protocol ของทั้ง 4 Objective อยู่ที่ `eval/final-evaluation/` (สถานะล่าสุดดู `eval/final-evaluation/READINESS.md`) — **เอกสารนี้ยังคงไว้เป็นหลักฐานประวัติของการตรวจสอบครั้งนั้น ไม่ได้แก้ตัวเลข/ข้อค้นพบย้อนหลัง**

---

## 1. Current Status

| รายการ | ค่า |
|---|---|
| Branch | `feat/user-auth` |
| HEAD | `1612888` fix: expose VAD-confirmed internal silence gaps |
| Commit ก่อนหน้า | `6decc1d` fix: preserve VAD-confirmed silence boundaries during snapping |
| Commit ก่อนหน้านั้น | `4308882` docs(eval): รายงาน VAD Filter Fix · `5ad3d92` fix(vad): ตัวกรอง VAD |
| `git diff HEAD -- backend/core/ai_logic.py` | **0 บรรทัด** (working tree ตรงกับ HEAD เป๊ะ — ตรวจซ้ำแบบ CRLF-strip แล้ว) |
| `git status --short` | 1 ไฟล์ modified (`eval/vad-filter-fix/metrics.json`, ค้างจากรอบ VAD-fix), 6 รายการ untracked (ดูหัวข้อ 17) |
| Ground Truth (`eval/V0x/ground_truth.txt`) เทียบ `4189548` | **diff = 0 บรรทัด ทุกไฟล์** |
| Baseline evidence เทียบ `cc454df` | **diff = 0 บรรทัด** (ไฟล์ใหม่ที่เห็นตอนเทียบกับ `4189548` คือ `V01/preview_pre-baseline.json` ซึ่งถูกเพิ่มใน `cc454df` เอง ไม่ใช่การแก้ภายหลัง) |
| แหล่งอ้างอิงเดิมของ 3 fixes ตรงกับ commit ที่บันทึกไว้หรือไม่ | **ตรง** — ดูตารางแฮชหัวข้อ 2 |

## 2. ยืนยัน source ตรงกับ commit ที่บันทึกไว้ (SHA-256, LF-normalized)

| Commit/ไฟล์อ้างอิง | แฮช `ai_logic.py` |
|---|---|
| `4189548` / `cc454df` (ก่อนแก้ VAD) | `2632b324…` |
| `5ad3d92` (`vad-fix-v1`) / `4308882` | `aa7b4ccb…` |
| `6decc1d` (Snap fix เดี่ยว ๆ บน `4308882`) | `a5beda43…` |
| `1612888` (HEAD ปัจจุบัน = VAD+SilenceGap+Snap รวมกัน) | `3a67a004…` |
| `eval/silence-gap/code_under_test.sha256` ("new") | `e91d487e…` *(นี่คือ working tree **ก่อน** commit Snap fix — เป็นแค่ Silence Gap Fix บน `4308882`, คนละจุดกับ HEAD ปัจจุบันโดยเจตนา)* |
| `eval/snap-wordbound-fix/code_under_test.sha256` | `3a67a004…` — **ตรงกับ HEAD (`1612888`) เป๊ะ** |
| working tree ปัจจุบัน (CRLF-stripped) | `3a67a004…` — **ตรงกับ HEAD เป๊ะ** |

**สรุป:** โค้ดที่ทดสอบในรอบ Snap/Word-Bound Fix (`e2e/`, unit test, regression) คือโค้ดสถานะ "Silence Gap Fix + Snap Fix รวมกันในต้นไม้เดียว" ซึ่งภายหลังถูกแยก commit เป็น `6decc1d` (เฉพาะ Snap) + `1612888` (เฉพาะ Silence Gap) — ผลรวมของทั้งสอง commit ที่ HEAD ตรงกับแฮชที่ทดสอบจริงเป๊ะ ไม่มีโค้ดตกหล่นหรือเกิน

---

## 3. VAD Fix Assessment

| หัวข้อ | สรุป |
|---|---|
| Root cause | `filter_transcript_by_vad` เดิมเช็คจุดกึ่งกลาง segment แทนสัดส่วนเสียงพูด — ยืนยันด้วย replay โค้ดเดิมตรงกับ log จริงทุกคลิปที่มี log (V02/V05/V06/V07) |
| Fix | เปลี่ยนเป็นสัดส่วนเสียงพูด ≥ 0.20 (`VAD_PREFILTER_MIN_SPEECH`) เกณฑ์มาจากข้อมูลจริง 72 ท่อน (ผลเหมือนกันทุกเกณฑ์ใน (0,0.45]) |
| Input-level result | **PASS/tested** — V02 6/7→7/7, V06 11/12→12/12, V07 0/2→2/2 (replay + dry-run ผ่าน `analyze_video_content` จริง, Gemini ปลอม) ; V01/V03/V04/V05 unchanged โดยโครงสร้าง |
| Final-output result | **รายงานที่ commit ไว้ (`eval/vad-filter-fix-report.md`) ระบุ NOT TESTED** — แต่ **พบหลักฐานที่ขัดกับสถานะนี้** (ดู ⚠️ ด้านล่าง) |
| Regression (input-level) | **PASS** — ท่อนที่ตัวกรองเดิมเก็บ ถูกเก็บครบทุกท่อนใน 72 ท่อน ไม่มีท่อนไหนถูกทิ้งเพิ่ม |

### ⚠️ พบความไม่สอดคล้องระหว่างรายงานกับหลักฐานจริง (เอกสาร ไม่ใช่ source)

`eval/vad-filter-fix-report.md` (คอมมิตแล้วใน `4308882`) เขียนไว้ว่าผลปลายทาง (recall/precision จริงหลัง Gemini) เป็น **NOT TESTED** เพราะ Docker หยุดทำงานตอนเขียนรายงาน (18:11) แต่พบว่า **มีการรัน harness จริงเพิ่มอีก 22 นาทีให้หลัง (18:33–18:34) ในเซสชันเดียวกัน** ได้ผล 3-way (baseline/control/new) ของ V02 full, V06 full, V06 summary, V07 full ครบ — ไฟล์เหล่านี้**มีอยู่จริงแต่ยัง untracked ไม่เคย commit และไม่เคยถูกเขียนกลับเข้ารายงาน**:

- `eval/vad-filter-fix/metrics_final_three_way.json` (untracked)
- `eval/vad-filter-fix/{harness_out.txt,harness_stderr.txt,after/,control-old/}` (untracked)
- แฮชโค้ดที่ใช้รันตรงกับ `5ad3d92`/`4308882` (ยืนยันแล้ว, ไม่มี log บรรทัด `[Silence Gap]` ปนมา — เป็น VAD-fix-only จริง)

**ตัวเลขที่พบ (ยังไม่ผ่านการเขียนรายงานอย่างเป็นทางการ ใช้ประกอบการตัดสินใจเท่านั้น):**

| Clip | baseline recall/prec/outside-GT | control (โค้ดเดิมรันซ้ำ) | new (โค้ด VAD-fix) |
|---|---|---|---|
| V02 full | 45.5% / 15.1% / 28.1s | (503 ทุก key×model) | 0.0% / N/A / 0.0s — Gemini เห็นครบแล้วเลือกไม่ตัดอะไรเลย (ตรงกับที่รายงานเดิมเตือนไว้ล่วงหน้าในหัวข้อ 7.2 ว่า "recall อาจลดลงได้") |
| V06 full | 59.3% / 74.2% / 10.9s | 79.4% / 49.0% / 35.7s | 65.8% / 77.9% / 9.1s — ดีขึ้นกว่า baseline ทั้ง recall/precision/outside-GT และดีกว่า control ชัดเจนในแกน precision/outside-GT |
| V06 summary | 32.9% / 36.1% / 39.6s | 40.7% / 45.2% / 33.6s | 36.1% / 66.3% / 12.5s — precision/outside-GT ดีขึ้นมาก |
| V07 full | 0.0% / N/A / 0s | 0.0% / N/A / 0s | 0.0% / N/A / 0s — ไม่เปลี่ยน (คาดไว้แล้ว: hint ช่วงเงียบยังไม่ถูกส่ง ต้องรอ Silence Gap Fix) |

**นี่คือ MUST FIX (เอกสาร ไม่ใช่ source):** ต้องอัปเดต `eval/vad-filter-fix-report.md` ให้ตรงกับหลักฐานจริงชุดนี้ (เปลี่ยนจาก "NOT TESTED" เป็นผลจริง) และ commit ไฟล์หลักฐานที่ยัง untracked ก่อนอ้างอิงตัวเลขนี้ในบทที่ 4 — ไม่เช่นนั้นรายงานที่มีอยู่จะขัดแย้งกับหลักฐานที่มีอยู่จริงในระบบ

---

## 4. Silence Gap Assessment

| หัวข้อ | สรุป |
|---|---|
| Root cause | `get_silence_gaps()` มีอยู่แล้วแต่ไม่เคยถูกเรียก + hint เดิมวัดจากช่องว่างระหว่างท่อนเท่านั้น ยืนยันด้วย `git grep` = 0 จุดเรียกใช้ที่ `vad-fix-v1` |
| Fix | `_vad_silence_gaps()` ใหม่ + guard คู่ (ไม่มีเสียงพูด VAD และไม่มีคำ Whisper ทับ) รวมเข้า hint เดิมผ่าน `_long_silence_gaps(..., voice_segments=)` |
| Usable silence hints | V02 0→3, V07 0→3, V04 1→2, V06(full/summary) 1→2 ; V01/V03/V05 hint ไม่เปลี่ยนเลยแม้ไบต์เดียว (พรอมป์เหมือนเดิมทุกไบต์) |
| Guard evidence | ช่วงที่เพิ่มใหม่ทับเสียงพูดตาม VAD = 0.00s และทับคำ Whisper = 0.00s **ทุกคลิป** (ตรวจอิสระ, `replay_gaps.txt`) |
| V02/V06/V07 final-output evidence | V02 (n=1, ไม่มี control เพราะ 503): recall 0%→50.6%, precision 96.0%, ตรง hint ถึงทศนิยม · V06 full: Gemini ทำตาม hint ทั้ง 2 ช่วงแต่ถูก **Step 5 (≤5s) ทิ้ง** → ไม่มีผลต่อ final cut (ส่วนต่าง recall มาจากเทคซ้ำ ไม่ใช่ silence hint) |
| **V07 final-output evidence (rerun2, ครบแล้ว)** | Gemini เสนอตัดตรง hint ทั้ง 3 ช่วง (รวม 46.4s) แต่ **ถูกบั๊ก `_word_bound` (คนละบั๊ก มีมาก่อน) ยุบเป็น keep-all** — cuts=[] ทั้ง before/control/new เท่ากันหมด แต่ new "ไม่ได้ไม่ตัดแบบเดียวกับอีก 2 ชุด" คือ Gemini อยากตัดจริงแต่ downstream พังทีหลัง (พิสูจน์แล้วและถูกแก้แล้วในรอบ Snap Fix) |
| **V06 summary final-output evidence (rerun2, ครบแล้ว)** | new recall 42.3%/prec 67.3%/F1 51.9% vs control 78.0%/79.1%/78.6% — log ยืนยัน Gemini **ไม่เลือกใช้ hint เงียบเลยในรอบนี้** (ตัดแค่ REPETITION+TANGENT เหมือน control แต่ขอบเขตต่างกัน) → ส่วนต่างมาจากความแปรปรวนของ Gemini ไม่ใช่ผลของ fix |
| Limitation | เพดานผลอยู่ที่กฎ Step 5 (≤5s ทิ้งเสมอ) ไม่ใช่ที่ hint เอง ; เป็น hint ที่ Gemini อาจเมิน (พิสูจน์แล้วใน V06 summary) ; Gemini แปรปรวนสูงมาก แม้โค้ดเดียวกัน (V06 full baseline→control recall 65.8%→50.6%, V06 summary baseline→control 36.1%→78.0%) — ใหญ่กว่าผลต่างที่คาดจาก fix เอง ทำให้ n=1 ต่อคู่ไม่พอสรุปเชิงสถิติ |

### ⚠️ พบความไม่สอดคล้องระหว่างรายงานกับหลักฐานจริง (เอกสาร ไม่ใช่ source) — คนละจุดกับข้อ 3

`eval/silence-gap-report.md` (คอมมิตแล้วใน `1612888`) ยังเขียนไว้ที่บรรทัดสรุปต้นเรื่องว่า **"NOT TESTED (ปลายทาง): V07 และ V06 summary"** และหัวข้อ 12 (Conclusion) ยังเขียนแบบยังไม่มีผล V07/V06summary — **แต่ผล rerun2 (V07 full, V06 summary ครบทั้ง BEFORE/CONTROL/NEW) มีอยู่แล้วจริงและถูก commit ไปแล้วใน `1612888`** ในไฟล์:
- `eval/silence-gap/STATUS.md` (ข้อค้นพบ 13–15, อัปเดตล่าสุด 2026-09-22 14:15)
- `eval/silence-gap/metrics_rerun.json` (ตัวเลขดิบ, ตรวจแล้วตรงกับ STATUS.md ทุกค่า)
- `eval/silence-gap/rerun/`, `rerun2_out.txt`/`rerun2_stderr.txt`

STATUS.md เองระบุชัดเจนว่านี่เป็น "Next action" ที่**ยังไม่ได้ทำ**: _"เขียนสรุป Final Evaluation ลง `eval/silence-gap-report.md`... ยังไม่ได้ทำ"_ — ดังนั้นนี่ไม่ใช่การลืม แต่เป็นขั้นที่ค้างไว้ตั้งใจรอผู้ใช้ตรวจก่อน

**นี่คือ MUST FIX (เอกสาร ไม่ใช่ source):** ต้องปรับ `eval/silence-gap-report.md` หัวข้อ 7/9/12 ให้ดึงตัวเลขจาก `STATUS.md`/`metrics_rerun.json` เข้ามา (ข้อมูลมีอยู่แล้วครบ ไม่ต้องทดสอบเพิ่ม) ก่อนอ้างอิงในบทที่ 4 ไม่เช่นนั้นจะมีข้อความ "NOT TESTED" ที่ผิดจากความจริงติดอยู่ในรายงานหลักที่ commit แล้ว

---

## 5. Snap/Word-Bound Assessment

| หัวข้อ | สรุป |
|---|---|
| Root cause | `_word_bound()` เดินหาคำใกล้สุดโดยไม่มีเพดานระยะทาง — เมื่อขอบอยู่ติดช่วงเงียบยาว (ไม่มีคำระหว่างทาง) มันเดินข้ามช่วงเงียบทั้งก้อนไปหาคำอีกฝั่ง (12.1–19.7s) แล้ว `merge_close_segments(gap=0.0)` รวมช่วงที่บวมทับกันจนเหลือ 1 ช่วงเต็มคลิป — เป็นบั๊กแฝงที่มีมาก่อน Silence Gap Fix แต่เพิ่งถูกกระตุ้นเพราะเพิ่งมีเคสที่ Gemini เสนอตัดกลางท่อนยาวเป็นครั้งแรก |
| Fix | `_is_silence_boundary()` — probe แบบ epsilon (`pos∓0.05`) ตรวจว่าไม่มีเสียงพูด VAD และไม่มีคำ Whisper ทับฝั่งที่กำลังจะเดิน ถ้าใช่ → ไม่เรียก `_word_bound` เลย (ไม่ขยับ) ; เดินทาง `voice_segments` แบบ optional (default `None` = พฤติกรรมเดิมทุกประการ) |
| V07 unit test | **5/5 PASS** — BUGGY ยุบเป็น keep-all, FIXED-ไม่ส่ง-voice_segments เหมือน BUGGY เป๊ะ (backward-compat), FIXED-ส่ง-voice_segments ได้ 4 ช่วงตรงที่ Gemini เสนอ (คลาดไม่เกิน 0.5s/ขอบ) |
| Synthetic B1–B4 | **10/10 PASS** — คลุม: ตัดช่วงเงียบเดี่ยว, cut ใกล้ขอบ segment, cut ตรงช่องว่างระหว่างท่อนจริง, 2 cuts ในท่อนเดียวกัน (กัน chain-merge) |
| Regression กับ 4 production run จริง (V02 full, V06 full ×2, V06 summary control) | **12/12 PASS** — replay ของ BUGGY ตรงกับค่าที่บันทึกไว้จริง 100% (ยืนยัน harness เองแม่นยำ) และ FIXED ให้ผลเหมือนเดิมทุกกรณีที่ไม่มี silence-boundary — **ไม่มีผลกระทบต่อการตัดเนื้อหาปกติเลย** |
| V07 E2E (Gemini จริง 1 ครั้ง, quota เปิด) | Gemini เสนอตัด 3 ช่วงเดิมอีกครั้งตรง hint เป๊ะ → final keep 4 ช่วง ไม่ยุบเป็น keep-all อีกต่อไป ; ไม่มีบรรทัด `[Snap] ขยับขอบ` เพราะทั้ง 4 ขอบไม่ต้องขยับ — ยืนยันด้วย Gemini call จริง ไม่ใช่ replay |
| Final metric (V07 full) | recall 0%→**100%**, precision N/A→**92.7%**, F1→**96.2%**, ตัดนอกเฉลย 3.4s (sub-second rounding ต่อขอบ ไม่ใช่ตัดผิดตำแหน่ง), ทับ KEEP **0.0s** |
| ปัญหาที่พบระหว่างทาง (เปิดเผยแล้วในรายงาน) | implementation รอบแรกเช็ค `pos` แบบ inclusive ตรง ๆ ไม่ทำงาน (5/15 FAIL) เพราะ boundary จาก silence-gap hint ตกขอบ voice_segment/word พอดีเสมอ — แก้ด้วย epsilon probe |

**สรุป: fix นี้ผ่านครบทุกระดับการทดสอบที่กำหนด (unit/synthetic/regression/E2E) ไม่มี MUST FIX ค้าง** — เอกสาร (`eval/snap-wordbound-fix-report.md`) สอดคล้องกับหลักฐานครบถ้วน ไม่พบความไม่ตรงแบบข้อ 3–4

---

## 6. Step 5 Assessment (กฎ "ตัดขั้นต่ำ 5 วินาที")

โค้ด: `backend/core/ai_logic.py:2688` `if end <= start + 5.0: continue` + กฎในพรอมป์บรรทัด 2538 "แต่ละช่วงที่จะลบต้องยาวอย่างน้อย 5 วินาที"

| คำถาม | คำตอบ |
|---|---|
| ทำหน้าที่อะไร | กรองช่วงตัดที่ Gemini เสนอทิ้งถ้าสั้นกว่า 5 วินาที ก่อนเข้าสู่ `invert_segments` — ป้องกันไม่ให้เกิดรอยตัดถี่ ๆ สั้น ๆ จำนวนมากทั่วคลิป |
| Intended behavior หรือ bug | **Intended** — เป็นกฎที่ตั้งใจตั้งแต่แรก (มีทั้งใน code และ prompt สองชั้น) สอดคล้องกับปรัชญาโปรเจกต์ที่ระบุใน CLAUDE.md ("Guard ที่ยิงกว้างสร้างความเสียหายมากกว่าบั๊กที่มันแก้" และการหลีกเลี่ยงเนื้อหา "กระโดด") ไม่ใช่บั๊ก |
| ขัดกับ objective หรือไม่ | **เป็นเพดานของ Silence Gap Fix โดยตรง** — ช่วงเงียบ 3.0–5.0 วินาทีที่ Silence Gap Fix ตรวจพบและส่งเป็น hint สำเร็จ (V02 4.2s, V06 3.6s/4.3s) **ตัดไม่ได้เสมอ** เพราะกฎนี้ ไม่ใช่ "ขัดกัน" ในแง่ทำให้ผลผิด แต่เป็นข้อจำกัดที่ทำให้ผลของ Silence Gap Fix แสดงออกได้เฉพาะช่วงเงียบที่ยาว ≥5s เท่านั้น (V07 ทุกช่วง ≥12s จึงผ่านได้; V02/V06 ช่วงสั้นกว่านั้นผ่านไม่ได้) |
| มี evidence รองรับค่า 5.0 หรือไม่ | **ไม่มีการวัดเฉพาะเจาะจงเหมือนค่าคงที่อื่นในโปรเจกต์** (ต่างจาก `VAD_PREFILTER_MIN_SPEECH=0.20` และ `SILENCE_HINT_MIN_GAP=3.0` ที่มีตารางวัดข้อมูลจริงรองรับใน CLAUDE.md) — ค่า 5.0 ดูเหมือนเป็นการตัดสินใจเชิง UX/product (กันรอยตัดถี่) ไม่ใช่ค่าที่ผ่านการวัดเชิงประจักษ์ |
| จำเป็นต้องแก้ก่อน Final Evaluation หรือไม่ | **ไม่จำเป็น** — เป็น invariant ที่ใช้กับทุกแหล่งที่มาของการตัด (ไม่ใช่แค่ silence hint) การเปลี่ยนจะเป็นการทดลองแยกที่มี scope และ regression ของตัวเอง และผู้ใช้สั่งห้ามแก้ threshold ในรอบนี้อยู่แล้ว ผลกระทบของมันถูกบันทึกเป็น **LIMITATION** ที่ชัดเจนในทั้ง 2 รายงานแล้ว ไม่ใช่สิ่งที่ซ่อนอยู่ |

**สถานะ: LIMITATION (บันทึกแล้ว) — ไม่ใช่ MUST FIX**

---

## 7. Guard Assessment (Retake/Duplicate Guard)

`_find_retake_cuts()` — ไม่ถูกแตะโดยทั้ง 3 fixes รอบนี้เลย (ยืนยันจาก diff ของทั้ง 3 commit ไม่มีบรรทัดในฟังก์ชันนี้)

| ประเด็น | สถานะ | หลักฐาน |
|---|---|---|
| Guard ยังทำงานเหมือนเดิมหลัง 3 fixes | **PASS** | Snap Fix regression 4/4 คลิป (รวม V06 full ×2, V06 summary control ที่มีเทคซ้ำจริง) ให้ผลตรงกับค่าที่บันทึกไว้จริง 100% — retake guard ไม่ถูกกระทบ |
| Guard ยิงถูกในเคสเทคซ้ำจริง | **PASS** (เท่าที่ทดสอบ) | V06 full/summary หลายรอบมีเทคซ้ำถูกตัดจริงตามที่คาด (regression evidence section 6 ของ snap-wordbound-fix-report.md) |
| False positive ที่พบระหว่างการทดสอบรอบ VAD-fix | **LIMITATION (บันทึกไว้แล้วใน CLAUDE.md 3.8 และ vad-filter-fix-report.md §9.3)** | V06: คู่ที่ตรงกัน 18 ตัวอักษร "มีอะไรได้เพิ่มขึ้น" คนละหัวข้อ — ตรงกับข้อจำกัดที่ CLAUDE.md ระบุไว้แล้ว ("ตัววัดต้องเป็นสายต่อเนื่องยาวสุด", "ไม่แยกคำปฏิเสธ") ไม่ใช่บั๊กใหม่ที่เพิ่งพบ |
| Threshold ≥15 ตัวอักษรผ่านการวัดซ้ำหรือไม่ | **NOT RE-VALIDATED** | CLAUDE.md ระบุเองว่า "ค่า 15 ไม่ได้วัดซ้ำ — ชุดวัด false positive ถูก cleanup ลบไปก่อน" |
| Test suite เฉพาะทาง (unit/synthetic เหมือน Snap Fix) | **NOT TESTED / ไม่มีอยู่** | ไม่พบโฟลเดอร์ `eval/retake-*` หรือสคริปต์ unit test เฉพาะสำหรับ `_find_retake_cuts()` — ถูกทดสอบแค่ "โดยบังเอิญ" ผ่าน V06 ที่มีเทคซ้ำในข้อมูลจริง ไม่มีการวัด precision/recall แยกเฉพาะ retake-cut |
| ประโยคที่พูดถึงการพูดผิดเอง ("ขอโทษครับ") ที่ Whisper ถอดเพี้ยน | **NOT TESTED** (ยอมรับเป็นข้อจำกัดใน CLAUDE.md แล้ว) | |

**สรุปการจำแนก:** PASS (ไม่มี regression จาก 3 fixes) + LIMITATION (false positive แบบที่รู้อยู่แล้ว, threshold ไม่ได้วัดซ้ำ) + NOT TESTED (ไม่มี dedicated test suite, ไม่มี metric แยกเฉพาะ retake) — **ไม่มี MUST FIX ใหม่จากรอบนี้** เพราะ guard นี้อยู่นอก scope ของทั้ง 3 fixes โดยสิ้นเชิง

---

## 8. Gemini Reliability

หลักฐานสะสมจากทั้ง 3 รอบทดสอบ (`vad-filter-fix-report.md` §9.4, `silence-gap-report.md` §9/11, `STATUS.md`, `gemini-quota-check/README.md`, `e2e_stderr.txt`):

| ประเภท error | พบที่ไหน | รายละเอียด |
|---|---|---|
| **429** (quota รายวัน) | Silence Gap rerun รอบแรก, `gemini-quota-check/` | `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit=20/วัน/โมเดล/คีย์ — เกิดกับ `gemini-2.5-flash` ทั้ง 3 คีย์พร้อมกันได้ |
| **503** (overloaded) | V02 control-old (Silence Gap round), V03 (VAD-fix round) | บาง run ยิงซ้ำจนหมดทุก key×model แล้วยัง error (V02) |
| **404** (model not found) | `gemini_quota_matrix.py` (key#2, `gemini-2.5-flash`) | โมเดลไม่ถูกเปิดให้ใช้บนบางคีย์/โปรเจกต์ |
| **ไม่มี timeout** | V03 (VAD-fix, ~8 นาที), Snap Fix E2E (`e2e_stderr.txt`: `new: ok 672.4s` = **11.2 นาที**) | ไม่มีการตัดจบ request ที่ค้างนาน |
| **Variability สูงแม้ input/code เดียวกัน** | V06 full BEFORE→CONTROL recall 65.8%→50.6% ; V06 summary BEFORE→CONTROL 36.1%→78.0% ; V06 summary CONTROL→NEW 78.0%→42.3% (NEW ไม่ได้ใช้ hint เงียบเลย) | ใหญ่กว่าผลต่างที่คาดจาก fix เอง — ทำให้ n=1 ต่อคู่เปรียบเทียบไม่ได้เชิงสถิติ |
| **บั๊กจัดหมวด quota ผิด** (deferred, ไม่แก้รอบนี้ตามคำสั่งผู้ใช้) | `call_gemini_with_retry()` ai_logic.py:2308 | เจอ 429 ระดับโมเดลแล้วเข้าใจผิดว่าหมดทั้งคีย์ (คำว่า "Project" ปนอยู่ใน quotaId ที่จริงเป็นรายโมเดล) ข้าม `gemini-3.6-flash` ที่ยังมีโควตาเหลือไปเฉย ๆ — ยืนยันด้วย `gemini_quota_matrix.py` ยิงตรงแยกคู่ key×model |

**Protocol ที่ต้องกำหนดสำหรับ Final Evaluation เพื่อให้อธิบายผลได้:**
1. **บันทึก error code ทุกครั้งที่เกิด** (429/503/404) พร้อม key/model ที่ตอบ ต่อทุก run — อย่ารันซ้ำเงียบ ๆ จนกว่าจะสำเร็จ
2. **กำหนด n ต่อ clip/mode ล่วงหน้า** (แนะนำ ≥2–3 ถ้าเวลา/โควตาพอ) เพราะ variability สูงกว่าที่คาด — n=1 ใช้สรุปได้แค่ "เชิงกลไก" (mechanism-level) ไม่ใช่ "เชิงสถิติ"
3. **ตรึงตัวแปรโมเดลตลอดการทดลองเดียว** (`gemini-2.5-flash` ตามที่ใช้มาตลอด) — อย่าสลับโมเดลกลางรอบแม้จะมีทางลัดที่ใช้ได้ (บทเรียนจากรอบนี้)
4. **บันทึกเวลาที่ใช้ต่อ request** — พบค่าตั้งแต่ 11.6s ถึง 672.4s (11.2 นาที) ในรอบเดียวกัน ต้องมี timeout/retry policy ที่ระบุไว้ล่วงหน้าในโปรโตคอล ไม่ใช่ปล่อยรอไม่จำกัด
5. **แยกรายงานผลที่ "error"/"NOT TESTED" ออกจากผลที่วัดได้จริงเสมอ** อย่านับ error เป็นค่า 0 หรือ N/A ปนกับผลจริง

---

## 9. Visual Test Readiness (Objective 2 — Multimodal)

| หัวข้อ | สถานะ |
|---|---|
| Dataset | **ไม่ตรงกับชุด V01–V07 ที่มีเฉลย** — หลักฐาน A/B ที่มีอยู่ (CLAUDE.md §3.7) ใช้ "คลิปฟิตเนส 7 นาที" และ "คลิปนำเสนอ 6 นาที" ซึ่งเป็นคลิปคนละชุดกับ `eval/V01–V07` (ไม่มีชื่อ/ID ตรงกัน ไม่มีอยู่ใน `eval/`) |
| Method | A/B: เปิด/ปิด `VISUAL_CONTEXT`, ปิด `ai_correct` เพื่อตัดตัวแปร — เป็นวิธีที่ถูกต้อง แต่ n=2 เท่านั้น |
| Metric | เชิงคุณภาพ (อ่านผลลัพธ์เทียบกันด้วยตา) ไม่ใช่ recall/precision/F1 แบบที่ใช้กับ V01–V07 |
| Evidence ที่มี | ตารางใน CLAUDE.md §3.7: ชนะชัด 1 เคส (เก็บคำเชิญชวน + ระบุ outro ถูก) ก้ำกึ่ง 1 เคส (ตัดปัญหาเทคนิคดีขึ้นแต่เก็บ filler 18.8s เกิน) |
| Evidence ที่ขาด | ไม่มีการรัน Audio-only vs Audio+Visual บนชุด V01–V07 มาตรฐานเลย ; ไม่มี metric เชิงปริมาณ (recall/precision) สำหรับ multimodal โดยเฉพาะ ; ไม่มีการวัดผลกระทบของ VISUAL_CONTEXT ต่อผลลัพธ์ของ 3 fixes ที่เพิ่งทำ (V02/V06/V07 e2e runs ทั้งหมดรันด้วย `VISUAL_CONTEXT` เปิดตามค่า default แต่ไม่เคยเทียบกับปิด) |
| **พร้อมหรือไม่** | **ยังไม่พร้อม** — ต้องออกแบบการทดลอง audio-only vs audio+visual บนชุด V01–V07 (หรือชุดที่มีเฉลยเทียบเท่า) ก่อน ถึงจะตอบ Objective 2 ได้ด้วย metric เดียวกับ Objective 1 |

---

## 10. Subtitle Test Readiness

| หัวข้อ | สถานะ |
|---|---|
| Accuracy | **NOT TESTED ในรอบนี้** — `srt_utils.py` ไม่ถูกแตะโดยทั้ง 3 fixes (ยืนยันจาก diff ทั้ง 3 commit) จึงไม่มี regression risk แต่ก็ไม่มี evidence ใหม่เกี่ยวกับความแม่นยำของซับเลย |
| Timing | **NOT TESTED** — ไม่มีการวัด `tail_pad`/`remap_edited_phrases` behavior ในรอบนี้ (เป็น invariant ที่มีอยู่แล้วตาม CLAUDE.md §6 ไม่ได้ถูกทดสอบซ้ำ) |
| Editable subtitle (หน้า `SubtitleEditScreen.jsx`) | **NOT TESTED** — ไม่พบ eval evidence ใด ๆ เกี่ยวกับหน้านี้ |
| Metric ตาม Test Plan | ไม่พบเอกสาร Test Plan ในโค้ด repo (ไม่มีไฟล์ `*test*plan*` ใน repo) — ไม่สามารถยืนยันว่า metric ที่ Test Plan กำหนดไว้สำหรับซับคืออะไรจากในนี้ ต้องอ้างอิงจากเอกสารภายนอก (วิทยานิพนธ์) |
| **พร้อมหรือไม่** | **ไม่พร้อม** เพราะยังไม่มี evidence ใด ๆ ในรอบทดสอบนี้เลย (ทั้งที่ไม่มี regression risk ก็ตาม) |

---

## 11. Functional Test Readiness

| Flow | สถานะ |
|---|---|
| Upload/Process (`process_video_task`) | ทดสอบทางอ้อมผ่าน `analysis_harness.py` (เรียก `analyze_video_content` ตรง ไม่ผ่าน Celery/FastAPI) — **ครอบคลุมเฉพาะ core logic ไม่ใช่ endpoint จริง** |
| Preview (`GET/POST /subtitle`, หน้า `PreviewScreen.jsx`) | **NOT TESTED** — ไม่พบ evidence ใน `eval/` |
| Edit selection (ผู้ใช้แก้ช่วงในหน้า preview) | **NOT TESTED** |
| Render (`render_only_task`, ffmpeg ตัด+ต่อ+เบิร์นซับ) | **NOT TESTED ในรอบนี้** — `test_core.py` (integration test เดิม) ครอบคลุม pipeline คล้ายกันแต่เป็นสคริปต์แยก ไม่ได้ถูกรันเป็นส่วนหนึ่งของ 3 fixes รอบนี้ |
| **พร้อมหรือไม่** | **ไม่พร้อม** — evidence ทั้งหมดของ 3 fixes นี้จำกัดอยู่ที่ `analyze_video_content()` (การตัดสินใจตัด) เท่านั้น ไม่ครอบคลุม endpoint/UI/render จริง |

---

## 12. Human Evaluation Readiness

| หัวข้อ | สถานะ |
|---|---|
| Expert evaluation | **NOT SET UP** — ไม่พบ protocol, rubric, หรือ evidence ใด ๆ ใน repo |
| User evaluation | **NOT SET UP** |
| Manual vs AI-assisted comparison | **NOT SET UP** |
| ย้ำ (ตามที่ผู้ใช้กำชับ) | การทดสอบที่ต้องใช้คนจริงต้องไม่แทนด้วย Claude — **ไม่มีส่วนใดของ audit นี้หรือรอบทดสอบที่ผ่านมาใช้ Claude แทนการประเมินของมนุษย์จริง** ทั้ง 3 fixes ใช้ metric อัตโนมัติ (`score()`) เทียบเฉลยที่มนุษย์ทำไว้ล่วงหน้าเท่านั้น ไม่มีการให้ AI ตัดสิน "คุณภาพ" แทนคน |
| **พร้อมหรือไม่** | **ไม่พร้อมเลย** — ต้องออกแบบ protocol และเตรียมผู้เข้าร่วมก่อน ไม่ใช่งานที่ทำได้ในรอบ audit หรือ dev นี้ |

---

## 13. Dataset/Ground Truth

| ตรวจ | ผล |
|---|---|
| Ground Truth ไม่ถูกแก้ | **ยืนยันแล้ว** — `git diff 4189548 -- '*/ground_truth.txt'` = 0 บรรทัด ทุกไฟล์ (V02–V07; V01 ไม่มี ground_truth.txt มาตั้งแต่ต้น ใช้เป็น "unchanged input" check เท่านั้น) |
| Baseline evidence ไม่ถูกเขียนทับ | **ยืนยันแล้ว** — `git diff cc454df -- eval/V0x eval/logs.sha256` = 0 บรรทัด |
| ไม่มี timestamp hard-code เพื่อทำให้ผ่าน | **ยืนยันแล้ว** — `grep` หา "V01".."V07"/"ground_truth" ใน `ai_logic.py`/`vad_logic.py`/`tasks.py` เจอเฉพาะ**คอมเมนต์อธิบาย root cause** (บรรทัด 882-884, 1824, 1852) ไม่มีเงื่อนไข `if` ใดอิงชื่อคลิปหรือ timestamp ของเฉลย |
| Risk ของ overfitting | **มีความเสี่ยงระดับหนึ่งที่ต้องระวัง ไม่ใช่ตรวจพบว่าเกิดแล้ว:** threshold ทั้งหมด (`VAD_PREFILTER_MIN_SPEECH=0.20`, `SILENCE_HINT_MIN_GAP=3.0`) วัดจากชุดข้อมูล **เดียวกัน** กับที่ใช้ประเมินผล (7 คลิป, V01–V07) — ไม่มีชุด held-out แยกต่างหาก ; รายงานเองก็ยอมรับข้อจำกัดนี้ (เช่น "ชุดข้อมูลไม่มีท่อนความเงียบล้วนเลย" ในทั้ง VAD fix และ Silence Gap fix reports) |
| Dataset coverage ของผลปลายทาง | **ไม่ครบ 7 คลิป** — final-output evidence (recall/precision จริง) มีเฉพาะ V02, V06(full+summary), V07 ; **V01, V03, V04, V05 ไม่เคยมีผลปลายทางเลยตลอดทั้ง 3 รอบ fix** (มีแค่ input-level check ว่า transcript ที่ส่ง Gemini ไม่เปลี่ยน) |
| Final Evaluation ควรใช้ชุดใด | แนะนำใช้ **V01–V07 ชุดเดิม** (มี GT อยู่แล้ว, เป็นชุดเดียวที่ทุก fix ผ่านการตรวจ input-level ครบ) แต่ **ต้องรันปลายทางให้ครบทั้ง 7 คลิปเป็นครั้งแรก** (ปัจจุบันมีแค่ 4/7) เพื่อไม่ให้ข้อสรุปอิงกับคลิปที่เคย "เห็น" ระหว่างพัฒนา threshold เท่านั้น ; ถ้าเป็นไปได้ควรมีคลิปใหม่อย่างน้อย 1–2 คลิปที่ไม่เคยถูกใช้วัด threshold เลยเพื่อลด overfitting risk |

---

## 14. Metric Readiness

| Objective (อนุมานจากหลักฐานที่มี — ไม่พบเอกสาร Test Plan ในโค้ด repo) | Test | Dataset | Ground Truth | Metric | Evidence | Ready? |
|---|---|---|---|---|---|---|
| Obj.1 ความแม่นยำการตัด (VAD Filter) | input-level replay+dryrun | V01–V07 (72 ท่อน) | ใช้เทียบผล ไม่ผูกโค้ด | ท่อนที่เก็บ/ทิ้ง | `replay_results.*`, `dryrun_pipeline_input.txt` | **Ready** (input-level) |
| Obj.1 ความแม่นยำการตัด (VAD Filter, ปลายทาง) | E2E harness | V02,V06(full),V06(sum),V07 | `ground_truth.txt` | recall/precision/F1/outside-GT/keep-violation (`score.py`) | `metrics_final_three_way.json` (**untracked, ไม่อยู่ในรายงาน**) | **NEEDS FIX (เอกสาร)** ก่อน Ready |
| Obj.1 (Silence Gap, input) | replay+dryrun | V01–V07 | เทียบผล | usable hints, overlap กับเสียงพูด | `replay_gaps.*`, `before/after hint_*.txt` | **Ready** |
| Obj.1 (Silence Gap, ปลายทาง) | E2E harness | V02,V06(full),V06(sum),V07 | `ground_truth.txt` | recall/precision/F1 (`score.py`/`score_silence.py`) | `metrics_three_way.json`, `metrics_rerun.json` | **มีข้อมูลครบ 4/7 แล้ว — Ready เพื่อเขียนสรุป แต่รายงานหลักยังไม่ได้อัปเดต (ดูข้อ 4)** |
| Obj.1 (Snap/Word-Bound) | unit+synthetic+regression+E2E | V02,V06×2,V06sum,V07 | `ground_truth.txt` | เหมือนข้างบน + assertion เทียบค่าที่บันทึกไว้จริง | ครบทุกไฟล์ใน `eval/snap-wordbound-fix/` | **Ready** |
| Obj.1 คลิปที่เหลือ (V01,V03,V04,V05) | — | — | มี GT (V03,V04,V05); V01 ไม่มี | — | **ไม่มีเลย** | **NOT TESTED** |
| Obj.2 Multimodal (Visual) | A/B VISUAL_CONTEXT | คลิปนอกชุด V01–V07 (n=2) | ไม่มี GT เชิงปริมาณ | เชิงคุณภาพ | CLAUDE.md §3.7 เท่านั้น | **Not Ready** |
| Obj.3 Subtitle | — | — | — | — | ไม่มี | **Not Ready** |
| Obj.4 (สมมุติ: การใช้งานได้จริง/Human) | — | — | — | — | ไม่มี | **Not Ready** |
| Functional (upload/preview/edit/render) | — | — | — | — | ไม่มี evidence ในรอบนี้ | **Not Ready** |

**หมายเหตุ:** ตารางนี้ตั้งชื่อ Objective 1–4 แบบทั่วไปตามที่ผู้ใช้อ้างถึง ("Objective ทั้ง 4 ข้อ") เพราะ**ไม่พบเอกสาร Test Plan ในโค้ด repo นี้** (ค้นด้วย `find`/`grep` ทั่ว repo ไม่เจอไฟล์ที่ชื่อเกี่ยวกับ test plan หรือคำว่า "Objective") — ถ้ามีเอกสาร Test Plan ที่ระบุ Objective ไว้ชัดเจนอยู่นอก repo (เช่นในวิทยานิพนธ์) ควรใช้เอกสารนั้นตรวจทานตารางนี้ซ้ำอีกครั้งก่อนใช้จริง

---

## 15. Regression Summary

| Fix | Known Bug | Fixed? | Evidence | Regression Status |
|---|---|---|---|---|
| VAD Filter | midpoint แทนสัดส่วนเสียงพูด → ทิ้งท่อนที่มีเสียงพูดจริง | **Yes** (input-level) | `replay_results.txt` 72 ท่อน | **PASS** (input) / **มีหลักฐานปลายทางแล้วแต่ยังไม่เขียนรายงาน** (ดูข้อ 3) |
| Silence Gap | `get_silence_gaps()` ไม่เคยถูกเรียก → ความเงียบกลางท่อนมองไม่เห็น | **Yes** (input-level + guard) | `replay_gaps.txt` (0.00s ทับเสียงพูด/คำทุกคลิป) | **PASS** (input+guard) / **ปลายทางมีข้อมูลครบ 4/7 คลิปแล้ว แต่ยังตีความไม่ได้ว่า "recall ดีขึ้น" เพราะติดอุปสรรค 3 กลไกแยกกัน (Step5/Snap-bug/Gemini เลือกไม่ใช้ hint)** |
| Snap/Word-Bound | `_word_bound` ไม่มีเพดานระยะทาง → กลืนช่วงเงียบยาวกลับเข้ามาจนยุบเป็น keep-all | **Yes** | unit 5/5, synthetic 10/10, regression 12/12, E2E 1/1 (จริงกับ Gemini) | **PASS ครบทุกระดับ** — regression กับ V02/V06 full×2/V06summary control = 0 การเปลี่ยนแปลงพฤติกรรมสำหรับเนื้อหาปกติ |

- **unit**: Snap fix เท่านั้นที่มี dedicated unit test (`snap_fix_unit_test.py`) — VAD fix และ Silence Gap fix ไม่มี unit test แยก ใช้ replay กับข้อมูลจริงแทน
- **synthetic**: Snap fix B1–B4 (10 cases) ; VAD fix มีกรณีขอบสังเคราะห์ §6.3 ; Silence Gap fix มีกรณีขอบสังเคราะห์ 9 กรณี
- **pipeline** (dry-run ผ่าน `analyze_video_content` จริง, Gemini ปลอม): ทำครบทั้ง VAD fix และ Silence Gap fix (7 คลิป/8 run)
- **E2E** (Gemini จริง): VAD fix มีแล้วแต่ยัง untracked/ไม่ในรายงาน (ข้อ 3) ; Silence Gap fix มี 4/7 คลิป ; Snap fix มี V07 ครบ 1 คลิป

---

## 16. Final Readiness Matrix

| Area | Status | Must Fix Before Final? | Reason |
|---|---|---|---|
| VAD Filter | **NEEDS FIX (เอกสาร)** | **ใช่ (เอกสาร ไม่ใช่ source)** | มีหลักฐานปลายทางจริงแล้ว (`metrics_final_three_way.json`) แต่ยัง untracked และรายงานยังเขียนว่า NOT TESTED |
| Silence Gap | **NEEDS FIX (เอกสาร)** | **ใช่ (เอกสาร ไม่ใช่ source)** | ผล rerun2 (V07, V06summary) มีครบแล้วใน `STATUS.md`/`metrics_rerun.json` (คอมมิตแล้ว) แต่รายงานหลัก `silence-gap-report.md` ยังไม่ได้อัปเดตตาม |
| Snap/Word-Bound | **PASS** | ไม่ | ครบทุกระดับการทดสอบ ไม่มีความไม่สอดคล้อง |
| Step 5 | **LIMITATION** (บันทึกแล้ว) | ไม่ | intended behavior, เป็นเพดานของ Silence Gap Fix แต่ไม่ใช่บั๊ก และผู้ใช้ห้ามแก้ threshold รอบนี้ |
| Duplicate/Retake | **LIMITATION + NOT TESTED (dedicated suite)** | ไม่ (อยู่นอก scope 3 fixes) | ไม่มี regression จาก 3 fixes แต่ไม่มี test suite เฉพาะทางเลย และ false positive ที่รู้อยู่แล้วยังไม่ re-validate |
| Gemini reliability | **LIMITATION** (ต้องมี protocol) | ไม่ต้องแก้โค้ด แต่ **ต้องกำหนด protocol ก่อนรัน Final Evaluation** | variability สูง, ไม่มี timeout, บั๊กจัดหมวด quota (deferred ตามคำสั่งผู้ใช้) |
| Visual | **NOT READY** | ใช่ (ถ้าจะรายงาน Objective 2) | ไม่มี evidence บนชุด V01–V07 เลย ของเดิมเป็นคลิปคนละชุด n=2 |
| Subtitle | **NOT TESTED** | ใช่ (ถ้าจะรายงาน) | ไม่มี evidence ใด ๆ ในรอบทดสอบนี้ |
| Functional | **NOT TESTED** | ใช่ (ถ้าจะรายงาน) | evidence จำกัดที่ core decision logic ไม่ครอบคลุม endpoint/UI/render |
| User/Expert | **NOT SET UP** | ใช่ (ถ้าจะรายงาน) | ยังไม่มี protocol ใด ๆ — ต้องใช้คนจริง ห้ามใช้ Claude แทน |

---

## 17. Remaining Actions (ระบุ MUST FIX แต่ยังไม่แก้)

### MUST FIX (เอกสาร/หลักฐาน — ไม่ใช่ source code)
1. อัปเดต `eval/vad-filter-fix-report.md` หัวข้อ 6.4/7.2/8/10 ด้วยผลจริงจาก `metrics_final_three_way.json` แล้ว commit ไฟล์หลักฐานที่ยัง untracked (`metrics_final_three_way.json`, `harness_out.txt`, `harness_stderr.txt`, `after/`, `control-old/`) — ปัจจุบันไฟล์เหล่านี้ untracked อยู่จริง
2. อัปเดต `eval/silence-gap-report.md` หัวข้อ 7/9/10/12 ด้วยผล V07 full และ V06 summary จาก `STATUS.md`/`metrics_rerun.json` (ข้อมูลมีอยู่แล้วและ commit แล้ว ไม่ต้องทดสอบเพิ่ม)
3. อัปเดต `eval/vad-filter-fix/metrics.json` ที่ยังเป็น "before/after: NOT TESTED" (ปัจจุบัน modified ค้างอยู่ใน git status) ให้ตรงกับข้อมูลจริง หรือระบุเหตุผลที่ไม่อัปเดตอย่างชัดเจน

### ไฟล์ที่ยังค้างอยู่ (untracked/modified — ไม่ได้ลบ รอคำสั่ง)
| ไฟล์/โฟลเดอร์ | หมายเหตุ |
|---|---|
| `eval/vad-filter-fix/metrics.json` (M) | ต้องอัปเดตตาม MUST FIX ข้อ 3 |
| `eval/vad-filter-fix/{after,control-old,harness_out.txt,harness_stderr.txt,metrics_final_three_way.json}` | หลักฐานปลายทางจริงของ VAD fix ที่ยังไม่ commit — เกี่ยวกับ MUST FIX ข้อ 1 |
| `eval/gemini-quota-check/`, `eval/tools/{gemini_ping,gemini_quota_matrix}.py` | บั๊ก `call_gemini_with_retry` จัดหมวด quota ผิด — เก็บไว้แก้ตอนรอบปรับปรุงระบบตามคำสั่งผู้ใช้ |
| `eval/silence-gap/archive-before-quota-reset/` | สำเนาป้องกันเขียนทับช่วง quota freeze — ซ้ำซ้อนกับหลักฐานที่ commit แล้ว |

### ที่เก็บเป็น LIMITATION ได้ (ไม่ต้องแก้ก่อน Final Evaluation)
- Step 5 (กฎ 5 วินาที) เป็นเพดานของ Silence Gap Fix
- Retake guard false positive แบบที่รู้อยู่แล้ว + threshold ไม่ได้ re-validate
- Gemini variability สูง (ต้องมี protocol คุม ไม่ใช่แก้โค้ด)
- ช่องว่างระหว่างท่อนแบบเดิมใน V04/V05/V06 ทับเสียงพูดตาม VAD 3.2–4.3s (Silero ไวต่อ noise)
- ไม่มีท่อน "ความเงียบล้วน" ในชุดข้อมูลจริงเลย (VAD_PREFILTER_MIN_SPEECH ด้านที่ต้องทิ้งวัดไม่ได้กับของจริง)

### ต้องทำเพิ่มก่อน Final Evaluation เต็มรูปแบบ (นอกเหนือจาก MUST FIX เอกสาร)
- รันปลายทางให้ครบ 7/7 คลิป (ปัจจุบันมีแค่ 4/7: V02, V06 full, V06 summary, V07)
- ออกแบบการทดลอง Visual (Objective 2) บนชุด V01–V07 มาตรฐาน
- เตรียม protocol + evidence สำหรับ Subtitle, Functional (endpoint/UI), Human evaluation — ทั้งหมดยังไม่มีจุดเริ่มต้นในรอบทดสอบนี้เลย

---

## หยุดรอคำสั่ง

ตาม PRE-FINAL AUDIT ที่กำหนดไว้ — **ไม่มีการแก้ source/เฉลย/threshold/prompt และไม่มี commit ใหม่จาก audit นี้** รอผู้ใช้ตรวจรายงานนี้และสั่งขั้นต่อไป
