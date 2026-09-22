# Objective 2 — Audio Only vs Audio + Visual

- สถานะเอกสารนี้: **เตรียมความพร้อมเท่านั้น ยังไม่มีการเรียก Gemini จริง**
- ใช้ **ชุดคลิปเดียวกับ Objective 1 ทั้ง 9 case ทุกประการ** (ไม่ใช่คลิปนอกชุดแบบที่ CLAUDE.md §3.7 เคยทำด้วย n=2 คนละคลิป) — ปิดช่องว่างที่ `eval/pre-final-audit.md` §9 พบว่าหลักฐาน multimodal เดิมใช้ dataset คนละชุดกับ V01–V07 จึงเทียบกับ Objective 1 ด้วย metric เดียวกันไม่ได้

---

## ตัวแปรที่เปลี่ยน — เฉพาะ `VISUAL_CONTEXT`

ยืนยันจากโค้ดจริง (`backend/core/ai_logic.py:1107`):
```python
VISUAL_CONTEXT = os.getenv("VISUAL_CONTEXT", "1").strip().lower() not in ("0", "false", "no", "off")
```
เป็นค่าคงที่ระดับโมดูล อ่านจาก env ตอน import — toggle ได้ด้วย environment variable ล้วน ๆ **ไม่ต้องแก้โค้ด** ผ่าน:
```
docker compose exec -T -e VISUAL_CONTEXT=0 -e HARNESS_RUNS=<case> worker python /tmp/analysis_harness.py ...
```
(ค่า default ไม่ใส่ env = `VISUAL_CONTEXT=1` = เงื่อนไข B)

## ตรึงทุกอย่างอื่น (identical กับ Objective 1)

| ตัวแปร | ค่า |
|---|---|
| Video/audio | เหมือน Objective 1 ทุก case (job ID เดียวกัน, `backend/storage/<job>/` เดียวกัน) |
| Ground Truth | เหมือน Objective 1 ทุกไฟล์ (`eval/V0x/ground_truth.txt`) |
| โค้ด (HEAD) | `1612888` เดียวกัน ล็อกตลอดทั้ง Objective 1 และ 2 |
| Gemini model | `gemini-2.5-flash` เดียวกัน |
| Prompt | ไม่แก้ — เหมือน Objective 1 |
| n | เท่ากับ Objective 1 (n=2–3 ต่อ case ต่อ condition) |
| harness/scoring tool | ใช้ `eval/tools/analysis_harness.py` (9 case ที่เพิ่มแล้วในรอบนี้) + `eval/tools/score_final_eval.py` ตัวเดียวกับ Objective 1 — ต่าง root path เท่านั้น |

---

## Test Matrix

| Condition | env | ใช้ผลจาก Objective 1 ได้เลยหรือไม่ |
|---|---|---|
| **B. Audio + Visual** | `VISUAL_CONTEXT=1` (default) | **ได้ — ไม่ต้องรันซ้ำ** ถ้า Objective 1 รันด้วยค่า default อยู่แล้ว (ระบบ default เปิด visual อยู่แล้ว) ใช้ผลชุดเดียวกันเป็นเงื่อนไข B ของ Objective 2 ได้ทันที |
| **A. Audio Only** | `VISUAL_CONTEXT=0` | ต้องรันเพิ่ม (ไม่เคยมีข้อมูลนี้บนชุด V01–V07 มาก่อนเลย) |

รวม 9 case × n(2–3) สำหรับเงื่อนไข A เท่านั้นที่ต้องรันเพิ่มจริง (เงื่อนไข B ใช้ร่วมกับ Objective 1)

## Metrics

เหมือน Objective 1 ทุกตัว (Recall/Precision/F1/outside-GT/keep-violation จาก `score()` เดิม) **บวก** การเปรียบเทียบเชิงคุณภาพ:

### Qualitative Review Checklist (ต้องตกลงก่อนรัน — ไม่ใช่ตีความหลังเห็นผล)

ต่อคู่ (case, condition=A) vs (case, condition=B) อ่าน field `reason` ของทุกช่วงที่ Gemini เสนอตัด แล้วตอบคำถามต่อไปนี้ (บันทึกเป็นตาราง, ไม่ใช่ความเห็นอิสระ):

| # | คำถาม | A (audio-only) | B (+visual) |
|---|---|---|---|
| 1 | `reason` อ้างอิงเนื้อหาภาพหรือไม่ (เช่น "ฉาก", "ภาพ", "outro card", "จอแสดง...") | ใช่/ไม่ใช่ | ใช่/ไม่ใช่ |
| 2 | ถ้ามีช่วง outro/การ์ดจบคลิปในวิดีโอ — ระบุถูกไหมว่าเป็น outro ไม่ใช่ "เงียบ/ตัดจบ" | ใช่/ไม่ใช่/ไม่มีช่วงนี้ | ใช่/ไม่ใช่/ไม่มีช่วงนี้ |
| 3 | ตัดคำเชิญชวน/CTA ที่มีภาพประกอบ (เช่นจอโชว์ช่องทางติดต่อ) ทิ้งหรือเก็บ | ตัด/เก็บ | ตัด/เก็บ |
| 4 | มี filler/เนื้อหาที่ควรตัดแต่ไม่ถูกตัด (false negative) เพิ่มขึ้นหรือลดลงเทียบอีกเงื่อนไข | เพิ่ม/ลด/เท่าเดิม | เพิ่ม/ลด/เท่าเดิม |

**กฎการสรุป:** ห้ามสรุปว่า "visual ดีกว่า/แย่กว่า" จากตัวเลข recall/precision อย่างเดียว (บทเรียนจาก CLAUDE.md §3.7: ผลเคยก้ำกึ่ง 1 ใน 2 เคส) ต้องอ่าน checklist เชิงกลไกข้างต้นประกอบเสมอ ก่อนเขียนข้อสรุปในรายงาน

## วิธีเก็บ evidence

```
eval/final-evaluation/objective2/
  PROTOCOL.md                      (ไฟล์นี้)
  audio_only/rep1/after/<case>/{preview.json,harness.log}   ← VISUAL_CONTEXT=0, HEAD, tag "new"
  audio_only/rep1/control-old/<case>/...                     ← VISUAL_CONTEXT=0, HEAD เดียวกัน, tag "old" (run ซ้ำ)
  audio_only/rep2/... (ถ้าต้องการ n เพิ่ม)
  metrics_audio_only.json          ← score_final_eval.py --root audio_only/rep1 --root audio_only/rep2
  qualitative_review.md            ← ตาราง checklist ด้านบน กรอกครบทุก case หลังมีผลทั้ง A และ B
```
เงื่อนไข B (audio+visual) **ไม่ต้องสร้างโฟลเดอร์ซ้ำ** — อ้างอิงตรงไปที่ `eval/final-evaluation/objective1/rep*/` เพราะเป็นข้อมูลชุดเดียวกัน (default `VISUAL_CONTEXT=1`)

---

## Visual Dataset Readiness (ตรวจแล้ว — ไม่ใช่การสร้างข้อมูลเทียม)

ตรวจ `backend/storage/<job>/preview.json` ของทั้ง 9 case พบว่า **ทุกไฟล์มีคีย์ `"visual"` อยู่แล้ว** (จากการรัน `get_visual_signals()` จริงตอนประมวลผลครั้งแรกของแต่ละงาน) — ยืนยันว่า `get_visual_signals()` เคยรันสำเร็จกับวิดีโอทั้ง 9 ไฟล์มาแล้วจริง ไม่ใช่แค่คาดว่าไฟล์วิดีโอมีอยู่:

```
V01 8e43cd1d... ✓   V02 0e4c606f... ✓   V03(full) 9eb88221... ✓   V03(summary) e30793df... ✓
V04 9590035b... ✓   V05 4c4597f3... ✓   V06(full) 0772b3c4... ✓   V06(summary) 20692075... ✓   V07 cc0db657... ✓
```

**ข้อควรทราบ:** `analysis_harness.py` เรียก `get_visual_signals(base["video_path"])` **ใหม่ทุกครั้งที่รัน** (ไม่ใช้ค่า `"visual"` ที่แคชไว้ใน `preview.json`) ดังนั้นค่าที่ใช้จริงตอน Final Evaluation จะคำนวณสดเสมอ — การตรวจนี้ยืนยันแค่ "ไฟล์วิดีโอใช้กับ `get_visual_signals()` ได้จริง" (feasibility) ไม่ใช่ค่าที่จะถูกใช้ตรง ๆ

**สรุป: Visual dataset พร้อมสำหรับทั้ง 9 case ไม่ต้องเตรียมข้อมูลใหม่ ไม่ต้องอัปโหลดวิดีโอเพิ่ม** — สิ่งที่ยังขาดมีแค่ระดับ "โปรโตคอลการรัน/วิเคราะห์ผล" (checklist เชิงคุณภาพ) ไม่ใช่ระดับ dataset

## สิ่งที่ต้องเตรียมเพิ่มก่อนรันจริง

1. เพิ่ม `-e VISUAL_CONTEXT=0` ในคำสั่ง `docker compose exec` ตอนรัน harness สำหรับเงื่อนไข A (ไม่ต้องแก้ source ใด ๆ — เป็น env var ที่มีอยู่แล้ว)
2. ตกลง Qualitative Review Checklist ล่วงหน้า (ตารางด้านบน) ก่อนเห็นผลจริง เพื่อไม่ให้เกิด confirmation bias ตอนอ่านผล
3. รัน Objective 1 (เงื่อนไข B) และ Objective 2 เงื่อนไข A ด้วย `HARNESS_RUNS` ชุดเดียวกันทุกครั้งเพื่อให้ n ตรงกัน
