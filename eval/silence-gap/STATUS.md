# STATUS — Silence Gap Fix (ข้อมูล final-output ครบทั้ง 4 run แล้ว — รอผู้ใช้ตรวจก่อน commit)

- บันทึกเมื่อ: 2026-09-21 ~19:35 (เวลาเครื่อง) · อัปเดต 2026-09-22 ~09:35 หลัง rerun ครั้งที่ 1 · **อัปเดตล่าสุด 2026-09-22 ~14:15 หลัง rerun2 สำเร็จครบ**
- สาเหตุที่หยุดครั้งแรก: Gemini free-tier โควตารายวันหมด — `GenerateRequestsPerDayPerProjectPerModel-FreeTier` (`limit: 20`, `model: gemini-2.5-flash`) ทำให้ผลปลายทางของ V07 และ V06 summary ไม่ครบ
- **rerun รอบที่ 1 (2026-09-22 09:33):** สำเร็จ 1 จาก 4 คำขอ (`V06_summary control-old`) ก่อนโดน 429 ที่เหลือ — เก็บ error แล้วหยุด ไม่ได้รันซ้ำทันที
- **rerun2 (2026-09-22 14:06, หลัง quota เปิด, ใช้ `gemini-2.5-flash` ตามที่ผู้ใช้ยืนยันให้คงตัวแปรเดิม ไม่ใช้ `gemini-3.6-flash`):** สำเร็จครบทั้ง 3 คำขอที่เหลือ (`V06_summary after`, `V07_full after`, `V07_full control-old`) — **ข้อมูล final-output ของทั้ง 4 run (V02 full, V06 full, V06 summary, V07 full) ครบตามที่กำหนดไว้ใน RERUN.md แล้ว**
- ระหว่างการวิเคราะห์ผล V07 full พบบั๊กใหม่ที่ไม่เกี่ยวกับ Silence Gap Fix โดยตรง (อยู่ใน `_snap_bounds`/`_word_bound` ซึ่งมีมาก่อนแล้ว) — บันทึกไว้ที่ [`snap-wordbound-gap-bug.md`](snap-wordbound-gap-bug.md) ตามคำสั่งผู้ใช้ให้ **เก็บไว้แก้ตอนรอบปรับปรุงระบบ ไม่แก้ตอนนี้**
- **ไม่มีการแก้ซอร์ส ไม่มีการแก้เฉลย/threshold/Step 5/Snap/guard/พรอมป์/นิยามตัวชี้วัด และไม่มีการ commit ตั้งแต่บันทึกสถานะนี้ครั้งแรก** (เพิ่มเฉพาะไฟล์หลักฐาน/บันทึกใหม่ทั้งหมด — ดูหัวข้อ "แผนที่หลักฐาน")

## Git ณ ตอนนี้

| รายการ | ค่า |
|---|---|
| branch | `feat/user-auth` |
| HEAD | `4308882` (docs(eval): รายงานและหลักฐานการแก้ filter_transcript_by_vad) |
| tag `vad-fix-v1` | → `5ad3d92` (โค้ดปัจจุบัน / control ของรอบ Silence Gap) |
| tag `baseline-ch4` | → `0f9cb7d` |
| ซอร์สที่แก้แล้วแต่ **ยังไม่ commit** | `backend/core/ai_logic.py` (+96/−5), `CLAUDE.md` (+17, หัวข้อ 3.4.1) |
| ไฟล์ค้างจากรอบ VAD-fix | `eval/vad-filter-fix/metrics.json` (ถูก `score.py` เขียนใหม่ตามคำสั่ง), หลักฐาน e2e ของรอบนั้นยัง untracked |

**แฮชโค้ด (LF):**
- control `vad-fix-v1` = `aa7b4ccb117f2828c409a867f7fa45eaffe4b84aeda3e0ad44a37040260a6392`
- new (working tree, ยังไม่ commit) = `e91d487e63ab86571a7a8133209e718d11b55d8b60f9e232e0b2b49981dafd78`
- ตรวจแล้ว ณ เวลาบันทึก: ไฟล์ปัจจุบันแฮชตรงกับ new และ `git diff -- backend` ตรงกับ `fix.diff` ทุกไบต์

## Current state

| หัวข้อ | สถานะ |
|---|---|
| VAD Fix (`5ad3d92`, `vad-fix-v1`) | **completed** |
| Silence Gap implementation | **completed** (ยังไม่ commit) |
| Input-level verification | **completed** (7 คลิป / 8 run, Gemini ปลอมสำหรับอินพุต) |
| V02 full — final-output | **available** (n=1, ไม่มี control เพราะ Gemini 503) |
| V06 full — final-output | **available** (BEFORE + CONTROL + NEW) |
| V06 summary — final-output | **available ครบ** (BEFORE + CONTROL + NEW, rerun2 14:06 สำเร็จหลัง quota เปิด) |
| V07 full — final-output | **available ครบ** (BEFORE + CONTROL + NEW, rerun2 14:06) — **เจอบั๊กใหม่ที่ทำให้ NEW เท่ากับ 0 cuts ทั้งที่ Gemini เสนอตัดจริง** ดู [`snap-wordbound-gap-bug.md`](snap-wordbound-gap-bug.md) |
| Final Evaluation | **ข้อมูลครบทั้ง 4 run ที่กำหนดไว้แล้ว** — พร้อมสรุปผล (ดูหัวข้อ Confirmed findings ข้อ 13-15) |

## Confirmed findings (พิสูจน์แล้วจากข้อมูล/โค้ด — ไม่มีข้อสรุปเกินหลักฐาน)

1. `get_silence_gaps()` ([vad_logic.py:108](../../backend/core/vad_logic.py#L108)) **ไม่ถูกเรียกใช้เลย** ที่ tag `vad-fix-v1` (`git grep` = 0 จุดเรียกใช้)
2. hint ช่วงเงียบเดิมวัดจากช่องว่างระหว่างท่อนเท่านั้น → V02 และ V07 มี hint ว่าง (วัดจริง `before/measure_silence_sources.txt`)
3. Silence Gap Fix ทำให้ usable hints เพิ่มขึ้น: **V02 0 → 3 · V07 0 → 3 · V04 1 → 2 · V06 (full และ summary) 1 → 2** · V01, V03, V05 เท่าเดิม (พรอมป์ของ 3 คลิปนี้เหมือนเดิมทุกไบต์)
4. ช่วงเงียบที่เพิ่มใหม่ **ไม่ทับเสียงพูดตาม VAD (0.00 วินาที)** และ **ไม่ทับคำ Whisper (0.00 วินาที)** ทุกคลิป (ตรวจอิสระบนข้อมูลจริง, `replay_gaps.txt`)
5. ไม่ส่ง `voice_segments` ⇒ ผลเท่ากับโค้ดเดิมเป๊ะทั้ง 7 คลิป · กรณีขอบสังเคราะห์ 9 กรณี PASS
6. จำนวนท่อนที่ส่งให้ Gemini เท่า `vad-fix-v1` ทุกคลิป (ตัวกรอง VAD ไม่ถูกแตะ)
7. threshold 3.0 วินาทีไม่ต้องเปลี่ยน: ความยาวช่วงเงียบของ VAD แยกเป็น 2 กลุ่ม (≤ 2.8 วิ: 5 ช่วง · ≥ 4.3 วิ: 9 ช่วง) ไม่มีช่วงที่อยู่ระหว่างนั้น
8. **V02 (ปลายทาง, n=1):** Gemini สั่งตัดเพียง `84.43 → 90.23` ซึ่งตรงกับช่วงใน hint ที่เพิ่มใหม่ถึงทศนิยม · recall 50.6% · precision 96.0% · F1 66.3% · ตัดนอกเฉลย 0.2 วิ · ทับ KEEP 0.0 วิ (BEFORE รอบก่อน recall 0.0%, control ล้ม)
9. **V06 full (ปลายทาง):** Gemini ทำตาม hint ทั้ง 2 ช่วงแต่ Step 5 ทิ้งเพราะ ≤ 5 วิ → ไม่มีการตัดช่วงเงียบ · ตัดนอกเฉลยและทับ KEEP เท่า CONTROL (ไม่พบ regression) · recall/F1 ที่ต่างจาก CONTROL มาจากช่วงเทคซ้ำ ไม่ใช่ช่วงเงียบ
10. Gemini แปรปรวนแม้โค้ดเดียวกัน: V06 full BEFORE เทียบ CONTROL recall 65.8% → 50.6%
11. **V06 summary CONTROL (rerun, โค้ดเดิม `vad-fix-v1`, สำเร็จ 09:33):** recall 78.0% · precision 79.1% · F1 78.6% · ตัดนอกเฉลย 14.0 วิ · ทับ KEEP 5.0 วิ — เทียบกับ BEFORE (โค้ดเดิมเช่นกัน, รอบ VAD-fix) recall 36.1% · precision 66.3% · F1 46.7% ⇒ **เป็นหลักฐานเพิ่มเรื่องความแปรปรวนของ Gemini ด้วยโค้ดเดียวกัน ไม่ใช่ผลของ Silence Gap Fix** (โค้ดที่รันคือ control ไม่ใช่ new) ; log ยืนยันไม่มีบรรทัด `[Silence Gap]` ใน run นี้ ตรงกับที่คาดสำหรับโค้ดเดิม
12. **ยันสิ่งที่วัดไว้แล้ว (input-level) ซ้ำอีกครั้งจาก log ของ rerun (โค้ดใหม่, แม้ Gemini deletion จะ error):** `[Silence Gap] detected = 3 (between-segments 0, VAD 3) | usable = 3` สำหรับ V07_full และ `detected = 2 (between-segments 1, VAD 1) | usable = 2` สำหรับ V06_summary — ตรงกับตัวเลขในข้อ 3 เป๊ะ ยืนยันว่าโค้ดยังทำงานเหมือนที่วัดไว้
13. **V07 full (ปลายทาง, rerun2 หลัง quota เปิด 14:06, ใช้ `gemini-2.5-flash` เหมือนรอบอื่น):** BEFORE/CONTROL/NEW **ทั้ง 3 ชุด cuts=[] recall 0.0%** เท่ากันหมด แต่ **NEW ไม่ได้ "ไม่ตัด" แบบเดียวกับอีก 2 ชุด** — log ยืนยันว่า Gemini เสนอตัดช่วงเงียบทั้ง 3 ตรง hint เป๊ะ (รวม 46.4s) แล้วถูก `_snap_bounds`/`_word_bound` (บั๊กที่เพิ่งพบ ไม่เกี่ยวกับ Silence Gap Fix โดยตรง — มีมาก่อนแล้ว) ยืดข้ามช่วงเงียบทั้ง 3 จนช่วงที่เก็บทับกันแล้วถูก `merge_close_segments` รวมเป็น 1 ช่วงเต็มคลิป รายละเอียดเต็ม + การสืบสวนทีละขั้นด้วยฟังก์ชันจริง: [`snap-wordbound-gap-bug.md`](snap-wordbound-gap-bug.md)
14. **V06 summary (ปลายทาง, rerun2):** NEW recall 42.3% / precision 67.3% / F1 51.9% (cuts: `[(33.6,48.0),(82.6,105.9),(111.2,116.3)]`) เทียบ CONTROL recall 78.0% (cuts: `[(32.8,48.0),(59.1,105.9),(111.2,116.3)]`) — log ยืนยัน **Gemini ไม่เลือกใช้ hint ช่วงเงียบทั้ง 2 จุดเลยในรอบนี้** (เสนอตัดแค่ REPETITION + OFF_TOPIC_TANGENT เหมือน CONTROL แต่ขอบเขตต่างกัน) ⇒ ส่วนต่างของ recall มาจาก**ความแปรปรวนปกติของ Gemini ในการเลือกขอบเขตตัดซ้ำ/นอกประเด็น ไม่เกี่ยวกับ Silence Gap Fix** (เหมือนที่เคยพบใน V06 full BEFORE vs CONTROL ข้อ 10)
15. **สรุปสาเหตุที่ผลปลายทางไม่ขยับตามที่คาด พบครบ 3 กลไกแยกกันแล้ว (คนละคลิป คนละจุดในโค้ด):** (ก) V06 full — Step 5 ทิ้งช่วง ≤5 วิ (ช่องว่าง 3.6/4.3 วิ) (ข) V07 full — บั๊ก `_word_bound` ไม่มีเพดานระยะทาง กลืนช่วงเงียบยาว >5 วิกลับเข้ามา (ค) V06 summary — Gemini เลือกไม่ใช้ hint เอง ไม่มีกลไกใดในโค้ดขวางไว้ **ไม่มีกรณีใดเลยที่ hint เงียบไปถึงผลปลายทางได้สำเร็จโดยไม่ติดอุปสรรค ยกเว้น V02 (n=1, ไม่มี control คู่)**

## Current limitations

- **บั๊กใหม่ที่เพิ่งพบ (ไม่เกี่ยวกับ Silence Gap Fix โดยตรง แต่บล็อกผลของมันใน V07):** `_word_bound()` ไม่มีเพดานระยะทางตอนเดินหาคำที่ใกล้ที่สุด ทำให้กลืนช่วงเงียบยาว (>5 วิ, เกิน Step 5) กลับเข้ามาได้ทั้งหมดเมื่อช่วงเงียบนั้นอยู่กลางท่อน Whisper ยาว ๆ — ดูรายละเอียด [`snap-wordbound-gap-bug.md`](snap-wordbound-gap-bug.md) (เก็บไว้แก้ตอนรอบปรับปรุงระบบ)
- **Step 5 ทิ้งช่วงตัด ≤ 5.0 วินาที** ([ai_logic.py:2638](../../backend/core/ai_logic.py#L2638)) + กฎในพรอมป์ "ต้องยาวอย่างน้อย 5 วินาที" → ช่วงเงียบ 3–5 วินาทีตรวจพบแล้วแต่ตัดไม่ได้ (V02 4.2 วิ, V06 3.6/4.3 วิ) — ไม่ได้แก้
- **Gemini output แปรปรวนสูง แม้โค้ดเดียวกัน:** V06 full BEFORE→CONTROL recall 65.8%→50.6% ; V06 summary BEFORE→CONTROL recall 36.1%→78.0% ; V06 summary CONTROL→NEW recall 78.0%→42.3% (ทั้งที่ NEW ไม่ได้ใช้ hint เงียบเลย) — ความแปรปรวนระดับนี้ใหญ่กว่าผลต่างที่คาดจาก Silence Gap Fix เอง ทำให้เทียบ n=1 ต่อคู่ไม่น่าเชื่อถือพอจะสรุป
- **ยังไม่มีกรณีใดที่ hint เงียบไปถึงผลปลายทางได้สำเร็จแบบไม่ติดอุปสรรคเลย ยกเว้น V02 (n=1, ไม่มี control คู่กัน)** — อุปสรรคที่พบแยกกัน 3 กลไก (Step 5 / บั๊ก `_word_bound` / Gemini ไม่เลือกใช้ hint) ดูข้อ 15 ด้านบน
- V02 ไม่มี control ในเซสชันเดียวกัน (503 ตอนรัน) → ผลยังเป็น "ชั่วคราว" ไม่มีคู่เทียบ
- V01/V03/V04/V05 ปลายทาง NOT TESTED (นอกขอบเขต harness ที่กำหนดไว้สำหรับรอบนี้)
- hint อาจชี้ไปที่การเว้นจังหวะตั้งใจ (V02 30.4–33.7 ตรง SHOULD_KEEP) · ช่องว่างระหว่างท่อนแบบเดิมใน V04/V05/V06 ทับเสียงพูดตาม VAD 3.2/4.1/4.3 วินาที (ไม่ได้แก้)
- **สรุปโดยรวม: ห้ามอ้างว่า Silence Gap Fix ทำให้ Recall ปลายทางดีขึ้น** — ข้อมูลที่มีแสดงว่า fix ทำงานถูกต้องที่ "ระดับ input และการตัดสินใจของ Gemini" (ข้อ 3, 4, 8, 13) แต่ยังไม่มีหลักฐานว่าไปถึงผลปลายทางได้จริงในทางปฏิบัติ เพราะติดอุปสรรคอื่นที่ไม่เกี่ยวกับตัว fix เองทุกกรณีที่ทดสอบ (ยกเว้น V02 ซึ่ง n=1)

## ห้ามแก้ต่อ (frozen จนกว่าผู้ใช้สั่ง)

ซอร์สโค้ดทุกไฟล์ · เฉลย (`eval/V0x/ground_truth.txt`) · threshold (`SILENCE_HINT_MIN_GAP`, `VAD_PREFILTER_MIN_SPEECH`) · Step 5 · Snap · guard เทคซ้ำ · พรอมป์ Gemini · visual · ซับ · render · นิยามตัวชี้วัด (`score.py`, `score_silence.py`) · หลักฐานที่มีอยู่ (รวม failed run เดิมและ `archive-before-quota-reset/`)

## แผนที่หลักฐาน

| ที่ | เนื้อหา |
|---|---|
| `eval/silence-gap-report.md` | รายงานหลัก 12 หัวข้อ |
| `eval/silence-gap/` | หลักฐานรอบนี้ทั้งหมด (39 ไฟล์) — `before/`, `after/`, `control-old/` (= control; โฟลเดอร์ `control/` ว่างเปล่า ไม่ได้ใช้) |
| `eval/silence-gap/archive-before-quota-reset/` | สำเนาป้องกันการเขียนทับ + `MANIFEST.sha256` (63 ไฟล์) รวมหลักฐาน e2e ของรอบ VAD-fix ที่ยังไม่ commit |
| `eval/silence-gap/fix.diff`, `code_under_test.sha256` | diff ซอร์สและแฮชโค้ดที่ทดสอบ |
| `eval/tools/silence_{measure,replay,dryrun}.py`, `score_silence.py`, `analysis_harness.py`, `harness_unpack.py` | เครื่องมือทำซ้ำ (รอบก่อน) |
| `eval/silence-gap/rerun/` | ผล rerun ครบทั้ง 4 run: `control-old/{V06_summary,V07_full}/{preview.json,harness.log}`, `after/{V06_summary,V07_full}/{preview.json,harness.log}` |
| `eval/tools/score_silence_rerun.py`, `eval/silence-gap/metrics_rerun.json` | สคริปต์และผลคะแนนเฉพาะไฟล์ใน `rerun/` (เรียก `score()` เดิมจาก `score.py` ไม่แก้นิยาม ไม่ทับ `metrics_three_way.json`) |
| `eval/silence-gap/rerun_out.txt`/`rerun_stderr.txt`, `rerun2_out.txt`/`rerun2_stderr.txt` | log ดิบของการรัน harness รอบที่ 1 (09:33, สำเร็จ 1/4) และ rerun2 (14:06, สำเร็จ 3/3 ที่เหลือ) |
| `eval/gemini-quota-check/README.md`, `matrix_2026-09-22_1008.json` | บั๊ก `call_gemini_with_retry` เข้าใจ error โควตารายโมเดลผิดเป็นหมดทั้งคีย์ (เก็บไว้แก้รอบปรับปรุงระบบ) |
| `eval/silence-gap/snap-wordbound-gap-bug.md`, `eval/tools/trace_v07_collapse.py` | บั๊ก `_word_bound` ไม่มีเพดานระยะทาง (พบจากผล V07 full NEW) พร้อมสคริปต์สืบสวนทีละขั้น (เก็บไว้แก้รอบปรับปรุงระบบ) |
| `eval/tools/gemini_ping.py`, `gemini_quota_matrix.py` | เครื่องมือเช็คโควตา Gemini แบบเบา ไม่แตะไฟล์หลักฐาน |

## Next action

**เก็บข้อมูล final-output ครบตามที่ RERUN.md กำหนดไว้แล้วทั้ง 4 run** ขั้นต่อไปคือ **รอผู้ใช้ตรวจผลและสั่งขั้นต่อไป** — ทางเลือกที่รออยู่ (ยังไม่ได้ทำ ไม่ได้ตัดสินใจเอง):
1. เขียนสรุป Final Evaluation ลง `eval/silence-gap-report.md` (หัวข้อ "ผลปลายทาง" และ "การตีความ") จากตัวเลขที่มีอยู่แล้ว ไม่เพิ่มการทดสอบใหม่
2. รอผู้ใช้ตรวจรายงาน + บั๊กทั้ง 2 รายการที่พบ ก่อนตัดสินใจว่าจะ commit ซอร์ส Silence Gap Fix (`ai_logic.py`, `CLAUDE.md`) และหลักฐานทั้งหมดเมื่อไหร่
3. บั๊กทั้ง 2 รายการ (`gemini-quota-check`, `snap-wordbound-gap-bug`) รอ "รอบปรับปรุงระบบ" แยกต่างหากตามที่ผู้ใช้สั่งไว้ชัดเจนแล้ว ไม่ใช่งานของรอบทดสอบนี้

**ประวัติการตัดสินใจเรื่องโควตา (2026-09-22):** ตรวจพบว่า `gemini-3.6-flash` ใช้ได้จริงบน key#1/key#3 ตอน `gemini-2.5-flash` ยังหมดโควตา (10:08) แต่ผู้ใช้เลือก **ไม่ใช้ทางลัด `GEMINI_MODELS=gemini-3.6-flash`** เพื่อคงตัวแปรโมเดลให้ตรงกับรอบทดสอบก่อนหน้า (V02, V06 full ใช้ `gemini-2.5-flash`) แล้วรอโควตาจริงรีเซ็ตแทน ซึ่งเปิดใช้ได้จริงตอน 14:05 น. ตามที่คาดไว้
