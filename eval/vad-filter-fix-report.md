# รายงานการแก้ `filter_transcript_by_vad`

- โค้ดที่แก้: commit `5ad3d92` (tag `vad-fix-v1`) — โค้ดเดิม: tag `baseline-ch4` (`0f9cb7d`) ยังอยู่ครบ
- หลักฐาน baseline (ไม่ถูกแก้/ลบ): commit `cc454df` (preview.json ทุกคลิป + `logs.sha256`), เฉลย: commit `4189548`
- โฟลเดอร์หลักฐานของรอบนี้: `eval/vad-filter-fix/` · เครื่องมือ: `eval/tools/`

> **สถานะการทดสอบ (สรุปก่อนอ่านส่วนอื่น)**
> ทดสอบแล้ว: ตัวกรอง (replay บนข้อมูลจริง), อินพุตที่ส่งให้ Gemini (dry-run ผ่าน `analyze_video_content` จริง โดย Gemini ถูกแทนด้วยตัวปลอม), กรณีขอบสังเคราะห์
> **NOT TESTED: ผลการตัดปลายทางหลังผ่าน Gemini จริง (recall/precision หลังแก้)** — ต้องรันใน worker ซึ่งตอนนี้ Docker stack หยุดอยู่ (ดูหัวข้อ 6.4)

---

## 1. Problem

ตัวกรองก่อนส่ง Gemini ทิ้ง transcript segment ที่มีเสียงพูดจริง ผลจากการทดสอบ baseline:

| คลิป | อาการ | ผลกระทบ |
|---|---|---|
| V02 | ท่อน 34.4–65.4 ถูกทิ้ง | Gemini สั่งตัด 34.9–68.0 (33 วินาที) ตัดเนื้อหานอกเฉลย 28.1 วินาที |
| V06 summary | ท่อน 128.9–151.9 ถูกทิ้ง | Gemini สั่งตัด 124.6–155.0 ("DETECTED_SILENCE, MISSING_CONTENT") ผลตัดจริง 124.6–152.3 (27.7 วินาที) |
| V07 | ทั้ง 2 ท่อนถูกทิ้ง | Gemini ได้ transcript 0 ท่อน (2 ตัวอักษร) รอบแรกสั่งตัดทั้งคลิปจนงานล้มเหลว รอบสองตอบ `[]` |

ปัญหาเกิด **ก่อน** ขั้น Gemini จึงต้องแก้ที่ preprocessing ก่อน

## 2. Root Cause

`filter_transcript_by_vad` (โค้ดเดิม) เก็บท่อนก็ต่อเมื่อ **จุดกึ่งกลางของท่อน** ตกในช่วงเสียงพูดของ VAD:

```python
seg_mid = (seg["start"] + seg["end"]) / 2
if v["start"] <= seg_mid <= v["end"]:  # เก็บ
```

Whisper segment ไม่ใช่ประโยค (CLAUDE.md 3.2.1: p75 = 11.3 วิ, สูงสุด 31.5 วิ) ท่อนยาวจึงมีความเงียบอยู่กลางท่อนได้ ถ้าจุดกึ่งกลางบังเอิญตกในความเงียบ ทั้งท่อนถูกทิ้ง

| ท่อน | ช่วง | จุดกึ่งกลาง | ความเงียบที่ครอบจุดกึ่งกลาง | เสียงพูดจริงของท่อน (VAD) |
|---|---|---|---|---|
| V02 seg 1 | 34.4–65.4 | 49.9 | 47.4–51.6 | **85%** |
| V06 seg 7 | 128.9–151.9 | 140.4 | 139.2–142.8 | **81%** |
| V07 seg 0 | 0.0–52.6 | 26.3 | 16.8–31.6 | **46%** |
| V07 seg 1 | 55.1–94.9 | 75.0 | 62.9–82.6 | **45%** |

**การยืนยัน root cause** (ไม่ใช่การเดา): replay ตัวกรองเดิม (ซอร์สจาก tag `baseline-ch4` ตรง ๆ) กับ transcript และ VAD จริง ได้ผลตรงกับ log ตอนรันจริงทุกคลิปที่มี log:

| คลิป | log จริง | replay ตัวกรองเดิม |
|---|---|---|
| V02 | ทิ้ง 1 · `6 segments, 983 chars` | ทิ้ง 1 · `6 / 983` ตรงเป๊ะ |
| V05 | ทิ้ง 0 · `12 / 1,923` | ทิ้ง 0 · `12 / 1,923` ตรงเป๊ะ |
| V06 | ทิ้ง 1 · `11 / 2,113` | ทิ้ง 1 · `11 / 2,110` (ต่าง 3 ตัวอักษร: preview เก็บข้อความหลัง AI-correct) |
| V07 | ทิ้ง 2 · `0 / 2` | ทิ้ง 2 · `0 / 2` ตรงเป๊ะ |

และผล VAD ที่ dump ใหม่ (Silero ตัวเดิม พารามิเตอร์เดียวกับ `tasks.py:307`) ตรงกับ log ตอนรันจริงถึงทศนิยม 1 ตำแหน่งทุกคลิป (speech/silence: V02 90.8/18.4, V03 105.5/0.0, V04 132.7/9.6, V05 123.0/0.0, V06 169.6/7.1, V07 44.8/50.0)

## 3. Previous Behavior

Pipeline และตำแหน่งของตัวกรอง:

```
Video ─ffmpeg→ full_audio.wav
        ├─ get_voice_activity (Silero, threshold 0.5, ผสานช่วงห่าง ≤ 2 วิ)   ← tasks.py:307
        ├─ get_visual_signals
        └─ analyze_video_content
             ├─ Whisper 3 pass → transcript (words[] + segment)
             ├─ ★ filter_transcript_by_vad(transcript, voice_segments)      ← ai_logic.py (จุดที่แก้)
             │     log: [VAD Pre-filter] … ; [Transcript] N segments, C chars → Gemini
             ├─ _slim_for_gemini → Gemini (โหมด summary: outline ก่อน)
             ├─ invert → merge → outline check → _protect_outro
             ├─ Snap (_snap_segments_to_sentences) → guard เทคซ้ำ → _finish_last_sentence
             └─ preview.json
```

ตัวกรองมีจุดเรียกใช้จุดเดียว และผล VAD ถูกใช้ที่อื่นด้วย (`_protect_outro`, `_spare_unreadable_speech`) แต่ **ไม่มีที่ใดใช้ `get_silence_gaps`** — ไม่แตะในรอบนี้

## 4. New Behavior

เก็บท่อนเมื่อ **สัดส่วนที่ VAD บอกว่าเป็นเสียงพูด ≥ 0.20** (`VAD_PREFILTER_MIN_SPEECH`, ตั้งผ่าน env ได้, `0` = ไม่กรอง) ไม่ดูจุดกึ่งกลางอีก

log ใหม่ (ไม่พิมพ์ข้อความของผู้ใช้ — พิมพ์เฉพาะลำดับ/เวลา/สัดส่วน ท่อนที่ถูกทิ้งและท่อนที่เก็บ "บางส่วน" < 90% พิมพ์เสมอ ท่อนอื่นพิมพ์เมื่อ `DEBUG=1`):

```
[VAD Pre-filter] original segments = 7 | kept = 7 | removed = 0 | min speech overlap = 20%
  segment 1 34.4-65.4 speech overlap = 85% KEEP
```

## 5. Implementation

- ไฟล์ที่แก้ในโค้ดระบบ: `backend/core/ai_logic.py` เพียงไฟล์เดียว, ฟังก์ชัน `filter_transcript_by_vad` + ค่าคงที่ `VAD_PREFILTER_MIN_SPEECH` (diff เต็ม: `eval/vad-filter-fix/fix.diff`, 48 บรรทัดเพิ่ม/13 ลบ)
- **reuse** `_voiced_ratio` ที่มีอยู่แล้ว (ใช้ใน `_spare_unreadable_speech`) ไม่สร้างตรรกะ overlap ใหม่
- ท่อนไม่มีความยาว (start = end) ใช้ตำแหน่งจุดเดียวเหมือนตรรกะเดิม · ไม่มีข้อมูล VAD → คืน transcript ทั้งหมดเหมือนเดิม
- ไม่มีเงื่อนไขเฉพาะชื่อไฟล์หรือ timestamp ของเฉลย
- เอกสาร: `CLAUDE.md` (หัวข้อ 3.4 + แถวกับดักใหม่)
- **ไม่ได้แตะ** (ตามที่กำหนด): Snap, guard เทคซ้ำ, พรอมป์ Gemini, visual, ซับ, render

**เหตุผลของเกณฑ์ 0.20** (จากการวัด `eval/tools/vad_measure.py` บนทุกท่อนของ 7 คลิป):
- ทั้ง **72 ท่อน** ไม่มีท่อนที่ overlap ต่ำกว่า **45%** (ต่ำสุดที่พบ: V07 seg 1 = 45.3%) — 60 ท่อนอยู่ที่ 95–100%
- ตารางความไวต่อเกณฑ์ (`replay_results.txt`): ผลการตัดสินเหมือนกันทุกค่าเกณฑ์ตั้งแต่ 0.00 ถึง 0.45 และเปลี่ยนที่ 0.46 (V07 เหลือ 0 ท่อนอีก) → 0.20 อยู่ห่างจากค่าต่ำสุดที่พบราว 2 เท่า
- ⚠️ **ข้อจำกัดที่ต้องรู้:** ชุดข้อมูลไม่มีท่อน "ความเงียบล้วน" (overlap ≈ 0) เลย ด้านที่ต้องทิ้งจึง **วัดกับของจริงไม่ได้** เกณฑ์ 0.20 เป็นการเลือกแบบระวัง (ทิ้งเสียงพูดผิดเสียหายกว่าเก็บความเงียบเกิน) ไม่ใช่ค่าที่ผ่านการปรับจูนกับกรณีเงียบล้วน

## 6. Test Cases

### 6.1 Replay ตัวกรอง — ข้อมูลจริง (`vad_filter_replay.py` → `replay_results.txt/json`)
เรียกฟังก์ชันจริงจาก `ai_logic.py` เทียบกับตรรกะเดิมจาก tag บน transcript + VAD จริง 7 คลิป (72 ท่อน)

### 6.2 Dry-run ผ่าน `analyze_video_content` จริง (`harness_dryrun.py` → `dryrun_pipeline_input.txt`)
โหลด `ai_logic` ทั้งเวอร์ชันเดิมและใหม่, ฉีด transcript จาก baseline, รันจนถึงจุดเรียก Gemini (**Gemini ถูกแทนด้วยตัวปลอมที่ตอบ `[]`**) — ตรวจว่า "สิ่งที่ส่งให้ Gemini" เปลี่ยนตามที่คาด **ไม่ใช่การวัดคุณภาพการตัด**
โค้ดเดิมทำซ้ำ log จริงได้ตรงตัว (V02 `6 / 983`, V07 `0 / 2`)

### 6.3 กรณีขอบสังเคราะห์ (ข้อมูลสังเคราะห์ — ตรวจพฤติกรรมโค้ด ไม่ใช่คุณภาพ): PASS ทั้งหมด
ท่อนเงียบล้วน → ทิ้ง · ท่อนอยู่ในเสียงพูดเต็ม → เก็บ · คร่อมขอบ speech 25% → เก็บ · speech 10% → ทิ้ง · ท่อนไม่มีความยาวในเสียงพูด → เก็บ / นอกเสียงพูด → ทิ้ง · ไม่มีข้อมูล VAD → คืนทั้งหมด

### 6.4 ทดสอบปลายทางใน worker (`analysis_harness.py`) — **NOT TESTED**
ตัวสคริปต์เขียนและตรวจโครงสายงานด้วย 6.2 แล้ว แต่ **ยังไม่ได้รันกับ Gemini จริง** เพราะ Docker stack หยุดทำงานเมื่อ 17:57:50 (log `Warm shutdown` ทุกบริการ หลังผมรัน VAD dump ผ่านเพียงไม่กี่วินาที; สาเหตุที่หยุดยืนยันไม่ได้) ตามที่ตกลงกันว่าคุณรัน Docker เอง ผมจึงไม่สั่งเริ่ม stack
คำสั่งที่ต้องรัน (PowerShell, จาก root โปรเจกต์ — ไม่ต้อง `--build`):
```
docker compose up -d
git show baseline-ch4:backend/core/ai_logic.py | Set-Content -Encoding utf8 $env:TEMP\ai_logic_old.py
docker compose cp $env:TEMP\ai_logic_old.py worker:/tmp/ai_logic_old.py
docker compose cp backend\core\ai_logic.py worker:/tmp/ai_logic_new.py
docker compose cp eval\tools\analysis_harness.py worker:/tmp/analysis_harness.py
docker compose exec -T worker python /tmp/analysis_harness.py 2> eval\vad-filter-fix\harness_stderr.txt | Out-File -Encoding utf8 eval\vad-filter-fix\harness_out.txt
python eval\tools\harness_unpack.py
python eval\tools\score.py
```
สคริปต์รันโค้ดเดิม (control) คู่กับโค้ดใหม่ในรันเดียวกัน เพราะ Gemini ให้ผลไม่เหมือนกันทุกครั้ง (หลักฐาน: V07 สองรอบใน baseline อินพุตเหมือนกันแต่ผลต่างกัน — รอบแรกสั่งตัดทั้งคลิป รอบสองตอบ `[]`) ผลจะเขียนที่ `eval/vad-filter-fix/after/` และ `control-old/` โดยไม่แตะไฟล์ baseline

## 7. Before vs After

**7.1 อินพุตที่ตัวกรองส่งให้ Gemini — ทดสอบแล้ว (replay + dry-run, ข้อมูลจริง)**

| Clip | ท่อนที่ส่งให้ Gemini ก่อน → หลัง | ตัวอักษร ก่อน → หลัง | เสียงพูดที่ถูกกันไว้ (วินาที) ก่อน → หลัง | สถานะ |
|---|---|---|---|---|
| V02 | 6/7 → **7/7** | 983 → 1,294 | 26.2 → 0.0 | improved (อินพุต) |
| V06 full | 11/12 → **12/12** | 2,110 → 2,421 | 18.7 → 0.0 | improved (อินพุต) |
| V06 summary | 11/12 → **12/12** | 2,105 → 2,415 (dry-run) | 18.7 → 0.0 | improved (อินพุต) |
| V07 | 0/2 → **2/2** | 2 → 581 | 42.1 → 0.0 | improved (อินพุต) |
| V01 | 22/22 → 22/22 | 2,376 → 2,376 | 0.0 → 0.0 | unchanged |
| V03 | 8/8 → 8/8 | 1,576 → 1,576 | 0.0 → 0.0 | unchanged |
| V04 | 9/9 → 9/9 | 1,819 → 1,819 | 0.0 → 0.0 | unchanged |
| V05 | 12/12 → 12/12 | 1,923 → 1,923 | 0.0 → 0.0 | unchanged |

**7.2 ผลการตัดปลายทาง (recall / precision) — After = NOT TESTED**
Before คำนวณจากไฟล์ baseline ด้วย `eval/tools/score.py` (`metrics_before.txt`) นิยามเดียวกับที่จะใช้กับ After: recall นับเฉพาะ SHOULD_CUT ประเภทที่โหมดนั้นอนุญาต (full: SILENCE/RETAKE/FILLER/TECH · summary: รวม TANGENT), precision นับเทียบ SHOULD_CUT ทุกประเภท

| Clip | Before Recall | After Recall | Before Precision | After Precision | Transcript Before | Transcript After |
|---|---|---|---|---|---|---|
| V02 full | 45.5% | NOT TESTED | 15.1% | NOT TESTED | 6/7 (983 ตัวอักษร) | 7/7 (1,294) |
| V06 full | 59.3% | NOT TESTED | 74.2% | NOT TESTED | 11/12 (2,110) | 12/12 (2,421) |
| V06 summary | 32.9% | NOT TESTED | 36.1% | NOT TESTED | 11/12 (2,105) | 12/12 (2,415) |
| V07 full | 0.0% | NOT TESTED | N/A (ไม่มีการตัด) | NOT TESTED | 0/2 (2) | 2/2 (581) |

คอลัมน์ Transcript เป็นผล replay/dry-run จริง (ไม่ใช่ตัวเลขสมมติ) ส่วน After Recall/Precision ยังไม่มีเพราะยังไม่ได้รันปลายทาง

**สิ่งที่ "คาด" แต่ยังไม่ได้วัด (ห้ามอ่านเป็นผลลัพธ์):**
- เนื้อหาที่หายเพราะบั๊กนี้ควรกลับมา (V02 ~28 วินาที, V06 summary ~27.7 วินาที) แต่ Gemini ไม่แน่นอน
- **recall ของ V02 อาจลดลงได้**: recall 45.5% ใน baseline เกิดจากช่วงเงียบ 46–51 ถูกครอบในการตัดผิด 33 วินาทีโดยบังเอิญ ถ้า Gemini เห็นท่อนครบ มันอาจไม่ตัดอะไรเลย (ปัญหาช่วงเงียบกลางท่อนยังอยู่ ดูหัวข้อ 9) เมตริกบางตัวจึงอาจแย่ลงทั้งที่การเก็บเนื้อหาดีขึ้น — ต้องอ่านค่า "นอกเฉลย" กับ "ทับ KEEP" ประกอบ ไม่ใช่ดู recall ตัวเดียว
- **V07 น่าจะยังได้ recall ต่ำ** เพราะ hint ช่วงเงียบวัดจากช่องว่างระหว่างท่อน (2.5 วินาที < 3.0) และ Gemini เห็นแค่เวลาระดับท่อน

## 8. Regression Check

| ข้อตรวจ | ผล | หลักฐาน |
|---|---|---|
| transcript ที่ควรอยู่ยังอยู่ | **PASS** | ท่อนที่ตัวกรองเดิมเก็บ ถูกเก็บโดยตัวใหม่ครบทุกท่อนใน 72 ท่อน (`ทิ้งเพิ่ม = []` ทุกคลิป) |
| ท่อนความเงียบจริงไม่ถูกส่งต่อทั้งหมด | **inconclusive** | ข้อมูลจริงไม่มีท่อนเงียบล้วนเลย (ต่ำสุด 45%) ตรวจได้เฉพาะข้อมูลสังเคราะห์ (PASS) |
| Gemini ได้ transcript สมบูรณ์ขึ้น | **PASS (ระดับอินพุต)** | 7.1 · NOT TESTED ระดับผลปลายทาง |
| คลิปที่อินพุตไม่เปลี่ยน (V01, V03, V04, V05) | **unchanged โดยโครงสร้าง** | ท่อนและตัวอักษรที่ส่งเหมือนเดิมทุกตัว จึงไม่ควรมีผลต่างจากโค้ด (ผลปลายทางต่างได้แต่จากความไม่แน่นอนของ Gemini) |
| ระบบเริ่มตัดเนื้อหาที่ไม่ควรตัดเพราะ transcript เปลี่ยน | **NOT TESTED** | ต้องรันปลายทางและดูตัวชี้วัด "นอกเฉลย"/"ทับ KEEP" |
| regression ที่พบ | **ไม่พบ** ในสิ่งที่ทดสอบ | ข้อจำกัด: ทดสอบระดับอินพุตเท่านั้น |

## 9. Remaining Issues (แยกจาก VAD fix — ไม่ได้แก้ในรอบนี้)

1. **ช่วงเงียบกลางท่อนมองไม่เห็น** — hint ช่วงเงียบวัดจากช่องว่างระหว่างท่อน และ `get_silence_gaps` (VAD) ไม่ถูกเรียกใช้เลย (V02, V07)
2. **ขั้น Snap ทำให้ช่วงตัดของ Gemini หด** — V04: 53.6→61.91 เหลือ 58.69→61.91 · V06 summary: 41.3→57.0 เหลือ 42.11→48.02
3. **guard เทคซ้ำยิงผิดกลไกใน V06** — คู่ที่ตรงกัน 18 ตัวอักษร «มีอะไรได้เพิ่มขึ้น» คนละหัวข้อ, ไม่แยกคำปฏิเสธ, จับการซ้ำภายในวรรคเดียวไม่ได้ (นับ V06 เป็นผลของ guard ไม่ใช่ VAD)
4. **Gemini ไม่เสถียร** — 503/429/404, ไม่มี timeout (V03 รอนานสุด ~8 นาที), ผลไม่แน่นอนแม้อินพุตเดียวกัน, โมเดลที่ตอบต่างกันระหว่างคลิป
5. ตัวกรองยังไม่ได้ตรวจกับท่อนที่เป็นความเงียบล้วน (ดู 5)
6. ตัวกรองยังพึ่ง `voice_segments` ที่ผสานช่วงห่าง ≤ 2 วิ (ตั้งใจของ `get_voice_activity`) ความเงียบสั้นกว่านั้นจึงนับเป็นเสียงพูด

## 10. Conclusion

- **ยืนยันด้วยข้อมูลแล้ว:** root cause คือการใช้จุดกึ่งกลาง (replay ตรงกับ log จริงทุกคลิป) และตัวกรองใหม่เก็บท่อนที่เคยถูกทิ้งครบ 4 ท่อน (V02 1, V06 1, V07 2) โดยไม่ทิ้งท่อนใดเพิ่มใน 72 ท่อน → **improved ในระดับอินพุตของ Gemini** สำหรับ V02, V06, V07 และ **unchanged** สำหรับ V01, V03, V04, V05
- **ยังสรุปไม่ได้ว่า "ระบบดีขึ้น":** ผลปลายทาง (recall/precision/เนื้อหาที่หายจริง) = **NOT TESTED / inconclusive** และตัวชี้วัดบางตัว (เช่น recall ของ V02) อาจลดลงได้ทั้งที่เนื้อหาถูกเก็บดีขึ้น
- ปัญหา Snap, ช่วงเงียบกลางท่อน, guard เทคซ้ำ และ Gemini ไม่ได้ถูกแก้และไม่ควรถูกนับเป็นผลของ VAD fix
- ขั้นต่อไปที่ต้องทำเพื่อปิดรายงานนี้: รันคำสั่งในหัวข้อ 6.4 แล้วอ่านผลจาก `eval/vad-filter-fix/after/` เทียบ `control-old/` (n = 1 ต่อ run — ความแปรปรวนของ Gemini ทำให้ผลต่างเล็กน้อยไม่ควรตีความเป็นผลของการแก้)

## ไฟล์หลักฐาน

| ไฟล์ | เนื้อหา |
|---|---|
| `eval/vad-filter-fix/fix.diff` | git diff โค้ดที่แก้ (baseline-ch4 → 5ad3d92) |
| `eval/vad-filter-fix/vad_segments.json`, `vad_raw.txt`, `vad_stderr.txt` | ผล VAD จริง (Silero) ของ 7 คลิป — ตรวจตรงกับ log ตอนรันจริง |
| `eval/vad-filter-fix/replay_results.txt/json` | replay ตัวกรองเดิม/ใหม่ + ความไวต่อเกณฑ์ + กรณีขอบ |
| `eval/vad-filter-fix/dryrun_pipeline_input.txt` | อินพุตที่ส่งให้ Gemini ผ่าน `analyze_video_content` จริง (Gemini ปลอม) |
| `eval/vad-filter-fix/metrics_before.txt`, `metrics.json` | recall/precision ก่อนแก้ (After = NOT TESTED) |
| `eval/vad-filter-fix/code_under_test.sha256` | แฮชของโค้ดเดิม/ใหม่ที่ใช้ทดสอบ |
| `eval/tools/` | `dump_vad.py`, `vad_measure.py`, `vad_filter_replay.py`, `score.py`, `analysis_harness.py`, `harness_dryrun.py`, `harness_unpack.py` |
| baseline เดิม | `eval/V0x/preview*.json` + `eval/logs.sha256` (commit `cc454df`) — ไม่ถูกแก้ |

คำสั่งที่รันจริงในรอบนี้ (จาก root โปรเจกต์): `python eval/tools/vad_measure.py` · `python eval/tools/vad_filter_replay.py` · `python eval/tools/score.py` · `python eval/tools/harness_dryrun.py` (VAD dump: `docker compose exec -T worker python -` ด้วย `eval/tools/dump_vad.py` ก่อน stack หยุด)
