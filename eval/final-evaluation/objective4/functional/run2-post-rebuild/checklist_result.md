# 4A Functional Test — รอบใหม่หลัง rebuild (2026-09-24) — ผลตาม FUNCTIONAL-TEST.md

- โค้ดที่ทดสอบ: `main` = `e136e8a` (merge แล้ว, push แล้ว) ; worker/backend rebuild 2026-09-24 14:01 ; `VAD_PREFILTER_MIN_SPEECH` ใน container = 5 ครั้ง
- คลิป: V02 (`V2_________.mp4`, 112.8s) ; โหมด `full`, prompt เดียวกับ baseline ; ผ่าน endpoint จริงด้วย JWT (ใช้ในหน่วยความจำ ไม่บันทึกลงไฟล์ — ตรวจแล้วไม่พบ token ในไฟล์ใดเลย)
- Job หลัก: `c00c222e-bbe2-4112-8f6c-ea1b2e2c8c57` (burn_subtitle=false) ; Job เสริม: `31c41c8e-6892-4505-ac1f-29c3263a95ac` (burn_subtitle=true, ผ่านขั้นตอนเดียวกันทั้งหมด)
- **ข้อจำกัดของการทดสอบ:** ทดสอบผ่าน **API ที่หน้าเว็บเรียกจริง** เท่านั้น — ไม่ได้เปิดเบราว์เซอร์ (ไม่มีเครื่องมือควบคุม UI และไม่มี frontend test ในโปรเจกต์) ข้อที่เป็นพฤติกรรมของหน้าจอจึงระบุ "ไม่ได้ทดสอบ" ไม่ใช่ PASS
- **ข้อจำกัดของ selection:** AI เสนอเก็บทั้งคลิป (0 ช่วงตัด) ผมจึง **จำลองผู้ใช้เอาช่วงเงียบ 84.43–90.23 ออกเอง** และ **จำลองแก้ข้อความซับบรรทัดแรก** — ไม่ใช่ผลของ AI/ผู้ใช้จริง
- transcript มาจาก **Cache HIT** (hash `8b2382e167446a03`, baseline เดิม) ไม่ใช่ Whisper สด

## ผลต่อข้อ

| # | ข้อ | ผล | หลักฐาน |
|---|---|---|---|
| 1 | Upload ผ่าน endpoint จริง / ได้ job_id | ✅ PASS | HTTP 200 `upload_response.json` |
| 1 | ไฟล์เก็บที่ `storage/<job_id>/` | ✅ PASS | V2_________.mp4, full_audio.wav, preview.json, thumbnail.jpg, final_summary.mp4 |
| 1 | error handling ไฟล์ผิดชนิด/เสีย | ⬜ ไม่ได้ทดสอบรอบนี้ | — |
| 2 | Celery `process_video_task` เริ่ม + สถานะอัปเดต | ✅ PASS | `/status` progress 62 → 100 ; `process_log.txt` |
| 2 | ffmpeg → VAD → (Cache) → Gemini ตามลำดับ | ✅ PASS | `process_log.txt`: VAD Pre-filter `original segments = 7 | kept = 7` (รูปแบบใหม่ ไม่ทิ้งท่อน), Silence Gap 3 ช่วง, `gemini-2.5-flash` key#1 attempt 1, 26.0s |
| 2 | จบสมบูรณ์ มี preview.json | ✅ PASS | `preview_response.json` (HTTP 200) |
| 3 | หน้า Preview โหลด/แสดงช่วง/ไทม์ไลน์ปูเต็ม/ปุ่มดู seek | ⬜ **ไม่ได้ทดสอบ (UI)** | ตรวจได้แค่ข้อมูล: `segments` = `[0,110.83]` เต็มความยาวส่วนที่มีเสียง |
| 4 | Select/Deselect, splitAt/applyMerge, คืนค่า AI | ⬜ **ไม่ได้ทดสอบ (UI)** | จำลอง deselect ที่ระดับ API เท่านั้น (ข้อ 6) |
| 5 | หน้าแก้ซับใช้ `POST /subtitle/{job_id}` | ✅ PASS (ระดับ API) | HTTP 200, ซับ 44 บรรทัด **นอก selection = 0**, ฟิลด์ `orig_start/orig_end` ครบ (CLAUDE.md §2.3/§2.5) ; หน้าจอเรียก endpoint นี้จริงหรือไม่ = ไม่ได้ตรวจ (UI) |
| 5 | แก้ข้อความซับแล้วบันทึกได้ | ✅ PASS | `preview.json` เก็บ `edited_subtitle_phrases` 44 บรรทัด, `GET /subtitle` คืนข้อความที่แก้ |
| 6 | `render_only_task` เริ่มหลังยืนยัน | ✅ PASS | HTTP 200 → SUCCESS ใน 7.4s |
| 6 | ffmpeg ตัด+ต่อ+เบิร์นซับจบไม่ error | ✅ PASS | `render_log.txt` (`filter_complex 2 segments`) ; job เสริม burn=true ก็ SUCCESS |
| 6 | `tail_pad=0` ใน render-from-preview | ✅ PASS (ทางอ้อม) | ความยาว output 105.047s เทียบผลรวมช่วง 105.03s (ต่าง 0.02s ถ้ามี pad 0.2×2 จะเป็น ~105.4s) |
| 7 | `final_summary.mp4` มีจริงและเปิดได้ | ✅ PASS | ffprobe: h264 1280×720 + aac, `output_video_info.txt` |
| 7 | ความยาว output = ผลรวมช่วงที่เลือก | ✅ PASS | 105.047s vs 105.03s |
| 7 | ซับที่เบิร์นตรงข้อความที่แก้ | ✅ PASS | `burn/frame_t3s.jpg`: เฟรม t=3s เห็น "วี 02 ทดสอบสวัสดีครับ [แก้ไขโดยเทสต์ 4A]" |
| 7 | ซับไม่มี offset | ⚠️ ตรวจบางส่วน | ซับบรรทัดสุดท้ายหลัง remap จบที่ 105.03s = ความยาวรวมพอดี ; ตรวจภาพเฉพาะ t=3s จุดเดียว (ก่อนรอยตัด) ยังไม่ได้ตรวจซับหลังรอยตัดที่ 84.4s |
| 7 | จำนวนช่วงตัดตรงกันระหว่าง 2 หน้าจอ | ⬜ ไม่ได้ทดสอบ (UI) | — |

## ข้อสังเกต (ไม่ฟันธง)
- Gemini ใน pipeline จริงรอบนี้เสนอ **0 ช่วงตัด** สำหรับ V02 ทั้งที่ harness (audio+visual) ตัด 84.4–90.2 ทุกรัน (n=4, SD=0) — n=1 ครั้งใน pipeline จริง ยังสรุปไม่ได้ว่าต่างกันเพราะอะไร (ความแปรปรวนของ Gemini เอง หรือต่างที่ prompt/พารามิเตอร์) ; ไม่ได้สืบเพิ่มในรอบนี้
- ยังไม่เคยทดสอบ **Whisper สด** ผ่าน pipeline จริง (ทั้ง 3 job ที่ผ่านมา Cache HIT)
