# รายงาน: แก้บั๊ก `_word_bound` กลืนช่วงเงียบ (snap-wordbound-gap-bug)

- อ้างอิง root cause: [`eval/silence-gap/snap-wordbound-gap-bug.md`](silence-gap/snap-wordbound-gap-bug.md)
- หลักฐานทั้งหมดของรอบนี้: [`eval/snap-wordbound-fix/`](snap-wordbound-fix/)
- **ยังไม่ commit** — รอผู้ใช้ตรวจผลก่อน

---

## 1. โค้ดที่แก้และวิธีที่ boundary ไหลผ่านแต่ละฟังก์ชัน (ก่อนแก้)

Pipeline เดิม (ai_logic.py บรรทัด 2634-2690) ส่งขอบผ่านลำดับนี้:

```
Gemini cut (start,end)
  → snap_to_sentence_boundary()          [จุด, tolerance 2.0s, หา segment.end ที่ใกล้ที่สุด]
  → invert_segments()                     [แปลง "ช่วงลบ" → "ช่วงเก็บ"]
  → merge_close_segments(gap=2.0)
  → _protect_outro()
  → _snap_segments_to_sentences()
        └─ ต่อ keep-segment → _snap_bounds(start, end, tr, total_duration)
              ├─ front: ถ้าห่างจากขอบ segment ≤ SNAP_MAX_SENTENCE(6.0s) → snap ตรงไปขอบ segment
              │         ถ้าไกลกว่านั้น → _word_bound(seg, pos, before=True)  ⚠️ ไม่มีเพดาน
              └─ back : เหมือนกัน ฝั่ง before=False
        └─ merge_close_segments(gap=0.0)  [รวมช่วงที่ snap แล้วทับกัน]
  → _subtract_spans(retake_cuts)
  → _finish_last_sentence()
```

**`_word_bound(seg, pos, before)`** รับ Whisper segment เดียว + ตำแหน่ง แล้วเดิน `seg["words"]`
หาคำที่ใกล้ที่สุดในทิศที่กำหนด **ไม่มีเพดานระยะทาง** — ถ้าไม่มีคำระหว่าง `pos` กับคำที่ใกล้ที่สุด (เพราะเป็น
ช่วงเงียบ) มันจะเดินข้ามช่วงเงียบทั้งก้อนไปหาคำที่อยู่อีกฝั่ง แล้ว `merge_close_segments(gap=0.0)` รวมช่วงที่
บวมทับกันจนกลายเป็น keep-all (รายละเอียดเต็มดู `snap-wordbound-gap-bug.md`)

---

## 2. การออกแบบ integration กับ VAD

**ก่อนแก้:** `_snap_bounds`/`_snap_segments_to_sentences` ไม่รับ `voice_segments` เลย ทั้งที่
`analyze_video_content` มี `voice_segments` อยู่ในสโคปแล้ว (ใช้กับ `_protect_outro` บรรทัดก่อนหน้าพอดี)

**การเชื่อม (minimal coupling):**
- เพิ่มพารามิเตอร์ `voice_segments: list[dict] | None = None` ให้ `_snap_bounds` และ
  `_snap_segments_to_sentences` (ไม่บังคับ, default `None` = พฤติกรรมเดิมทุกประการ)
- เพิ่มฟังก์ชันเล็ก ๆ ใหม่ **1 ฟังก์ชัน**: `_is_silence_boundary(pos, seg, voice_segments, before)` —
  ตรวจจุดเดียวว่า "ฝั่งที่กำลังจะเดินไป" (`pos∓0.05` ตามทิศ `before`) มีเสียงพูดตาม VAD หรือมีคำ Whisper
  ทับหรือไม่ **ไม่ได้คำนวณ silence gap ใหม่ซ้ำกับ `get_silence_gaps()`/`_vad_silence_gaps`** — แค่ตรวจจุด
  โดยใช้ `voice_segments` และ `seg["words"]` ที่มีอยู่แล้วในมือ (ไม่มี state ใหม่ ไม่มี dependency ใหม่)
- นิยาม "อยู่ใน VAD-confirmed silence": **ไม่มี** voice_segment ใดครอบตำแหน่งที่ probe **และ** **ไม่มี**
  Whisper word ใดครอบตำแหน่งที่ probe — ตรงกับ guard เดียวกับที่ `_vad_silence_gaps` ใช้ตอนสร้าง hint
  (VAD ไม่เห็นเสียงพูด "และ" Whisper ไม่มีคำทับ) เพียงแต่ที่นี่เป็นการตรวจจุด ไม่ใช่การคำนวณช่วง

**เหตุผลที่ต้อง probe แบบ epsilon (ไม่ใช่เช็ค `pos` ตรง ๆ):** รอบแรกที่ลองแก้ เช็ค `pos` แบบ inclusive
ตรง ๆ (`v["start"] <= pos <= v["end"]`) แล้ว **ไม่ทำงาน** — วัดจริงพบว่า boundary ที่มาจาก silence-gap hint
ตกอยู่ **พอดีขอบ** ของ voice_segment/word เสมอ (เพราะคำนวณมาจากขอบช่องว่างเดียวกัน) การเช็คแบบ inclusive
ที่ `pos` เป๊ะจึงชนขอบ "ฝั่งเสียงพูด" ทุกครั้งและ return False เสมอ (ดูหัวข้อ 9 "ปัญหาที่พบระหว่างทาง") แก้โดย
probe จุดที่ "กำลังจะเดินไป" (`pos - 0.05` สำหรับ `before=True`, `pos + 0.05` สำหรับ `before=False`) แทน —
epsilon 0.05 ใช้ค่าเดียวกับที่ `_snap_bounds` เทียบขอบ segment อยู่แล้ว ไม่ใช่ค่าใหม่ที่เดาขึ้นมา

---

## 3. สิ่งที่ implement จริง

**กรณีปกติ (ไม่มี silence-boundary):** เส้นทางเดิมทุกจุด — `_word_bound` ถูกเรียกเหมือนเดิมทุกประการ
(regression 4/4 คลิปยืนยันแล้ว ดูหัวข้อ 6)

**กรณี VAD-confirmed silence:** แทรก `elif` ก่อนเรียก `_word_bound` ทั้ง 2 จุด (front และ back) —
ถ้า `_is_silence_boundary(...)` เป็น True → **ไม่เรียก `_word_bound` เลย ไม่ขยับตำแหน่งเลย** (คง
`pos` ดิบไว้ตามที่ Gemini/Step5-snap ให้มา) ไม่ใช่การคำนวณ boundary ใหม่ใด ๆ — เป็นการ "ไม่ทำอะไร"
ซึ่งปลอดภัยที่สุดเพราะไม่มีคำให้ป้องกันอยู่แล้วในช่วงเงียบ

**เรื่อง sentence snapping / `SENTENCE_PAUSE` / `THOUGHT_GRACE` ที่ทำต่อจากนั้น:** ตรวจแล้วว่า
**ไม่ต้องแก้เพิ่ม** — ลูปทั้งสองใช้ `j = i` (index ของ Whisper segment ที่ล้อมรอบ ไม่ใช่ตำแหน่งคำ) ซึ่ง
**ไม่เปลี่ยนไม่ว่า boundary จะมาจาก `_word_bound` หรือจากการ bypass** ดังนั้นพฤติกรรมของลูปเหล่านี้
เหมือนเดิมทุกประการหลังแก้ (ยืนยันด้วย unit test: V07 case ไม่มี "ชั้นเพิ่ม"/`THOUGHT_GRACE` ทำงานทั้งก่อน
และหลังแก้ เพราะ `_ends_incomplete(segment.text)=False` ทั้งคู่)

---

## 4. Unit test (V07 จริง, ไม่เรียก Gemini ใหม่)

สคริปต์: [`eval/tools/snap_fix_unit_test.py`](snap-wordbound-fix/../tools/snap_fix_unit_test.py) ·
ผลเต็ม: [`eval/snap-wordbound-fix/unit_test_output.txt`](snap-wordbound-fix/unit_test_output.txt)

ใช้ cuts จริงจาก `harness.log` ของ rerun2 (`16.83→31.49`, `37.12→49.20`, `62.97→82.63`) วิ่งผ่าน
pipeline จริง (Step5 snap → invert → merge → `_snap_segments_to_sentences`) ด้วย 2 โมดูล:

| ชุด | ผล |
|---|---|
| BUGGY (Silence Gap Fix อย่างเดียว) | `[{0.0→94.87}]` — ยุบเป็น keep-all (ยืนยันสภาพก่อนแก้ซ้ำ) |
| FIXED, ไม่ส่ง `voice_segments` | `[{0.0→94.87}]` — **เหมือน BUGGY เป๊ะ** (backward-compatible) |
| **FIXED, ส่ง `voice_segments` (โค้ดที่จะใช้งานจริง)** | **`[{0.0→16.83}, {31.49→37.12}, {49.2→62.97}, {82.63→94.87}]`** — 4 ช่วง ตรงกับที่ Gemini เสนอ คลาดไม่เกิน 0.5s/ขอบ |

**5/5 assertion PASS**

---

## 5. B1–B4 synthetic regression (ไม่เรียก Gemini)

อ้างอิง behavior ก่อนแก้จาก `snap-wordbound-gap-bug.md` — ผลตรงกับเกณฑ์ที่กำหนดไว้ทุกข้อ:

| เคส | BUGGY | FIXED(+VAD) | เกณฑ์ | ผล |
|---|---|---|---|---|
| **B1** ตัดช่วงเงียบเดี่ยว ๆ | ยุบเป็น keep-all | `[{0→16.83},{31.49→94.87}]` | ต้องไม่ยุบเป็น keep-all | **PASS** |
| **B2** cut ใกล้ขอบ segment (<6.0s) | `[{0→2.61},{7.91→94.87}]` | เหมือนเดิมเป๊ะ | ต้องยังทำงานแบบเดิม | **PASS** |
| **B3** cut ตรงช่องว่างระหว่าง 2 ท่อนจริง | `[{0→52.58},{55.15→94.87}]` | เหมือนเดิมเป๊ะ | ต้องยังทำงานแบบเดิม | **PASS** |
| **B4** 2 cuts ในท่อนเดียวกัน | ยุบเป็น keep-all | `[{0→16.83},{31.49→37.12},{49.2→94.87}]` | ต้องไม่เกิด chain-merge เป็น keep-all | **PASS** |

**10/10 assertion PASS** (รวม assertion ที่ตรวจว่า "ไม่ส่ง `voice_segments` = เหมือน BUGGY เป๊ะ" ทุกเคส)

**รวม unit + synthetic: 15/15 PASS**

---

## 6. Regression กับผลจริงที่เคยบันทึกไว้ (V02 full, V06 full ×2, V06 summary control)

สคริปต์: [`eval/tools/snap_fix_regression.py`](../tools/snap_fix_regression.py) (ใช้
[`eval/tools/parse_regression_cases.py`](../tools/parse_regression_cases.py) แยก cuts/final จริงจาก
`harness.log` ที่มีอยู่แล้วล่วงหน้า) · ผลเต็ม: [`eval/snap-wordbound-fix/regression_output.txt`](snap-wordbound-fix/regression_output.txt)

| Run | AI cuts จริง | Final ที่บันทึกไว้จริง (โค้ด buggy) | FIXED(+VAD) replay | ตรงกัน? |
|---|---|---|---|---|
| V02 full (new) | 1 cut, 84.43→90.23 | `[0→84.43],[90.23→110.83]` | เหมือนเดิมเป๊ะ | ✅ |
| V06 full (new) | 3 cuts (เทคซ้ำ + 2 hint เงียบ ≤5s) | `[0→25.87],[35.74→82.64],[105.91→111.23],[116.28→176.79]` | เหมือนเดิมเป๊ะ | ✅ |
| V06 full (control-old) | 2 cuts (เทคซ้ำ + พูดผิด) | `[0→25.87],[33.46→82.64],[105.91→111.23],[116.28→176.79]` | เหมือนเดิมเป๊ะ | ✅ |
| V06 summary (control-old) | 3 cuts (ซ้ำ + นอกประเด็น + hint เงียบ ≤5s) | `[0→32.82],[48.02→59.12],[105.91→111.23],[116.28→176.79]` | เหมือนเดิมเป๊ะ | ✅ |

**4/4 คลิป ไม่มีอะไรเปลี่ยน (12/12 assertion PASS)** — content cut ปกติ (retake, ตัดนอกประเด็น) และเคสที่
hint เงียบถูก Step 5 ทิ้งไปก่อนแล้ว (≤5s) **ไม่ได้รับผลกระทบจากการแก้ครั้งนี้เลย** ตรงตามที่ควรจะเป็น
(สังเกต: replay ของ BUGGY ตรงกับค่าที่บันทึกไว้จริง 100% ในทั้ง 4 เคส — ยืนยันว่า replay harness เองแม่นยำ
ก่อนจะเชื่อผลเทียบ FIXED)

---

## 7. V07 E2E (เรียก Gemini จริง — 1 ครั้ง, quota เปิด ณ 2026-09-22 ~15:00)

รันผ่าน harness ปกติ (`HARNESS_RUNS=V07_full`, `ai_logic_old.py`=`vad-fix-v1`, `ai_logic_new.py`=โค้ดหลังแก้
รอบนี้) — ไม่ได้แก้ prompt/threshold ใด ๆ เพื่อให้ได้ผล ผลดิบ: [`eval/snap-wordbound-fix/e2e/`](snap-wordbound-fix/e2e/),
log เต็ม: `after/V07_full/harness.log`, `control-old/V07_full/harness.log`

**Gemini (จริง, `gemini-2.5-flash`) เสนอตัด 3 ช่วงเดิมอีกครั้ง** (ตรง hint เป๊ะ เหมือน rerun2 ก่อนแก้):
```
16.83s → 31.49s (14.7s) — ช่วงเงียบยาวไม่มีเสียงพูดระหว่างการพูดอธิบาย
37.12s → 49.2s  (12.1s) — ช่วงเงียบยาวไม่มีเสียงพูดระหว่างการพูดอธิบาย
62.97s → 82.63s (19.7s) — ช่วงเงียบยาวไม่มีเสียงพูดระหว่างการยกตัวอย่างเนื้อหา
```

**Final keep segments (หลังแก้, 4 ช่วง — ไม่ยุบเป็น keep-all อีกต่อไป):**
```
0.0s   → 16.83s
31.49s → 37.12s
49.2s  → 62.97s
82.63s → 94.87s
```
ไม่มีบรรทัด `[Snap] ขยับขอบ...` เลย เพราะทั้ง 4 ขอบไม่ต้องขยับ (ตรงกับที่ `_is_silence_boundary`
ออกแบบไว้ — ไม่ทำอะไรกับขอบที่อยู่ในช่วงเงียบยืนยันแล้ว) **ยืนยัน end-to-end ว่าฟิกซ์ทำงานจริงกับ Gemini
call จริง ไม่ใช่แค่ replay ข้อมูลเก่า**

---

## 8. Metrics (V07 full) — คำนวณด้วย `score()` เดิมจาก `score.py` (ไม่แก้นิยาม)

สคริปต์: [`eval/tools/score_e2e.py`](../tools/score_e2e.py) · ผลเต็ม: [`eval/snap-wordbound-fix/e2e_metrics.txt`](snap-wordbound-fix/e2e_metrics.txt)

| ชุด | Cuts | Recall | Precision | F1 | นอกเฉลย | ทับ KEEP |
|---|---|---|---|---|---|---|
| before (VAD-fix baseline) | [] | 0.0% | N/A | N/A | 0.0s | 0.0s |
| control-old (rerun2, vad-fix-v1) | [] | 0.0% | N/A | N/A | 0.0s | 0.0s |
| control-old (E2E รอบนี้, vad-fix-v1) | [] | 0.0% | N/A | N/A | 0.0s | 0.0s |
| **new ก่อนแก้ (Silence Gap Fix อย่างเดียว, บั๊กเดิม)** | [] | **0.0%** | N/A | N/A | 0.0s | 0.0s |
| **new หลังแก้ (Silence Gap Fix + snap-wordbound fix, E2E จริง)** | `[(16.8,31.5),(37.1,49.2),(63.0,82.6)]` | **100.0%** | **92.7%** | **96.2%** | **3.4s** | **0.0s** |

**ห้ามดู recall อย่างเดียวตามที่กำหนด — ตรวจ precision/outside-GT/keep-violation ด้วย:**
- Precision 92.7% (ไม่ใช่ 100%) เพราะขอบที่ระบบตัดกว้างกว่าเฉลยเล็กน้อยทั้ง 3 ช่วง (เฉลยมนุษย์ปัดเป็นวินาที
  เต็ม ส่วนระบบใช้ขอบ VAD/Whisper จริง) รวมส่วนเกิน 3.4 วินาทีจาก 3 ช่วง (0.7s + 2.1s + 0.6s) — เป็นความ
  คลาดเคลื่อนระดับ sub-second ต่อขอบ ไม่ใช่การตัดผิดตำแหน่ง
- **KEEP-violation = 0.0s** — ช่วง SHOULD_KEEP (0:59-1:01, เว้นจังหวะสั้น ๆ ที่ตั้งใจเก็บ) ไม่ถูกแตะเลย
- สาเหตุที่ recall/precision ดีขึ้นมาจาก **downstream bug ที่ถูกแก้** ตามที่ trace ยืนยันไว้แล้ว (หัวข้อ 4, 7)
  ไม่ใช่ผลจากการเปลี่ยน threshold/prompt/Silence Gap Fix เอง (ทั้งสองอย่างไม่ถูกแตะในรอบนี้)

---

## 9. ปัญหาที่พบระหว่างทาง (รายงานตามกฎข้อ 9 — ไม่ขยาย scope)

ระหว่าง implement รอบแรก ใช้เงื่อนไข `_is_silence_boundary` แบบเช็ค `pos` ตรง ๆ (inclusive ทั้ง 2 ด้าน)
โดยไม่ probe ทิศทาง — ทดสอบแล้ว **ไม่ทำงาน** (unit test 5/15 FAIL, V07 case ยังยุบเป็น keep-all เหมือนเดิม)
สาเหตุ: boundary ที่มาจาก silence-gap hint ตกที่ขอบ voice_segment/word พอดีเสมอ (คำนวณมาจากขอบช่วง
เงียบเดียวกัน) การเช็คแบบ inclusive จึงตีความว่า "มีเสียงพูด/มีคำ" ผิดพลาดทุกครั้ง — แก้โดยเปลี่ยนเป็น
probe จุดที่กำลังจะเดินไป (`pos∓0.05` ตามทิศ) แทน ไม่ใช่ปัญหาใหม่ที่อยู่นอก scope ของรอบนี้ (เป็นรายละเอียด
ทาง implementation ของ `_is_silence_boundary` เอง) จึงแก้ต่อในรอบเดียวกันได้ ไม่ต้องหยุดรายงาน

ไม่พบปัญหาอื่นนอกเหนือจากนี้ระหว่างการ implement และทดสอบ

---

## 10. สรุปตามที่ผู้ใช้ขอ

ดูข้อความตอบท้ายบทสนทนา (ข้อ 1–12)
