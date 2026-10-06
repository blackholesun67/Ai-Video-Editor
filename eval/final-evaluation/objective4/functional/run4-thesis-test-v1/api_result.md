# 4A API — ผลรอบ thesis-test-v1

- โค้ด: `4774fde` (tag `thesis-test-v1`) · เวลา commit `2026-10-06 16:30:54 +0700` (`git log -1 --format=%ci 4774fde`)
- เวลา rebuild image: frontend `2026-10-06 16:32:58 +0700` · backend และ worker `2026-10-06 16:32:57 +0700`
  (ผู้ทดสอบจด จาก `docker ps --format "{{.Names}}  {{.CreatedAt}}"`) → **หลังเวลา commit 2 นาที 3–4 วินาที**
  ข้อจำกัด: `CreatedAt` ของ `docker ps` คือเวลาสร้าง container ไม่ใช่หลักฐานโดยตรงว่า image build จาก 4774fde
  แต่ 4774fde เป็น commit สุดท้ายก่อนเวลานั้น และหลังจากนั้นไม่มี commit แก้โค้ดระบบ
- รันโดยผู้ทดสอบเองตาม `API-COMMANDS.md` ; Claude อ่านไฟล์ใน `api/` แล้วกรอกตารางนี้ (2026-10-06)
- อัปโหลด 2026-10-06 19:09:14 +0700 (`api/upload_time.txt`) · job `22bc1a90-1798-4a9d-ab24-5fb972cd4ba9` (`api/job.txt`)
- คลิป V04 · โหมด full · preview_mode=true · burn_subtitle=true · ไม่ได้ส่ง X-API-Key (`API_KEYS` ว่าง ดู README)
- **คำขอ Gemini จริง = 1** (`Trying gemini` 1 บรรทัด, `api/process_log.txt:73` → `200 OK` บรรทัด 75) ;
  ขั้นแก้คำไม่เรียก Gemini เพราะ `[AI-Correct] Skipped — no Latin chars` (`process_log.txt:70`) — ต่ำกว่าที่ประเมินไว้ ≈ 2
- selection: **ตามที่ AI เสนอ ไม่ได้จำลอง** — AI เก็บ 2 ช่วง `0.00–69.91`, `75.72–143.24` (ตัด 69.91–75.72 = 5.81 วิ ;
  log บรรทัด 80: ช่วง 51.0–56.0 ที่ Gemini ระบุว่าเป็น self-correction)

สถานะ: ✅ ผ่าน · ⚠️ บางส่วน · ❌ ไม่ผ่าน · ⬜ ไม่ได้ทดสอบที่ระดับ API

| # | ข้อ | ผล | หลักฐาน |
|---|---|---|---|
| 1 | Upload ผ่าน endpoint จริง / ได้ job_id | ✅ | `upload_response.json`: HTTP 200 `{"job_id":"22bc1a90-…","preview_mode":true}` |
| 2 | ไฟล์เก็บที่ `storage/<job_id>/` | ✅ | `storage_files.txt` (ตรวจหลังวิเคราะห์): `V04_….mp4` 61,647,288 B, `full_audio.wav`, `preview.json` ; หลัง render Claude ตรวจโฟลเดอร์เดียวกันซ้ำ พบ `final_summary.mp4`, `thumbnail.jpg`, `frame_2.2.jpg`, `frame_70.96.jpg` เพิ่ม |
| 3 | error handling ไฟล์ผิดชนิด/เสีย | ✅ | `.txt` → HTTP 400 `ไฟล์ .txt ไม่รองรับ (ต้องเป็น {...})` (`bad_ext_response.json`) ; `fake.mp4` (11 B) → อัปได้ HTTP 200 job `d627980b-…` แล้ว `/status` = `FAILURE` ข้อความ "ไฟล์วิดีโอเปิดไม่ได้หรือเสียหาย กรุณาตรวจไฟล์แล้วลองใหม่" ไม่มีคำว่า ffmpeg/Traceback/path (`fake_mp4_status.json`) — ข้อนี้รอบ 822656f/e136e8a "ยังไม่ทดสอบ" |
| 4 | Celery `process_video_task` เริ่ม + สถานะอัปเดต | ⚠️ | task เริ่มและจบ `succeeded in 67.30s` (`process_log.txt:92`) ; `/status` คืน `SUCCESS` progress 100 (`status_poll.txt`) **แต่ไฟล์ poll มีแค่ 2 ค่า ทั้งคู่ SUCCESS** — เริ่ม poll หลังงานจบ (งานจบ 19:10:22, ไฟล์ poll 19:11) จึงไม่เห็นค่า progress ระหว่างทาง ; รอบเก่าเห็น 62 → 100 |
| 5 | ffmpeg → VAD → (Cache) → Gemini ตามลำดับ | ✅ | `process_log_key_lines.txt`: 12:09:24.197 Cache HIT (9 segments) → .197 `VAD Pre-filter original = 9 \| kept = 9` → .198 `Silence Gap detected = 2 \| usable = 2` → .780 `Trying gemini-2.5-flash` key#1 attempt 1 → 12:10:22.333 `200 OK` (57.6 วิ) ; transcript มาจาก cache ไม่ใช่ Whisper สด |
| 6 | จบสมบูรณ์ มี preview.json | ✅ | `preview_response.json` HTTP 200 ; `preview.json` 130,054 B ใน storage |
| 7 | หน้า Preview / ไทม์ไลน์ปูเต็ม / ปุ่มดู seek | ⬜ | ระดับข้อมูล: 2 ช่วงเรียงกัน ไม่ทับกัน (`preview_check.txt`) ; หน้าจอ → UI ข้อ 1–6 |
| 8 | Select/Deselect, split/merge, คืนค่า AI | ⬜ | → UI ข้อ 8–15 |
| 9 | หน้าแก้ซับใช้ `POST /subtitle/{job_id}` | ✅ (ระดับ API) | HTTP 200 ; `subtitle_check.txt`: ซับ 64 บรรทัด, ไม่มี `orig_*` = 0, **นอก selection = 0** ; หน้าจอเรียก endpoint นี้จริงหรือไม่ = ไม่ได้ตรวจ |
| 10 | แก้ข้อความซับแล้วบันทึกได้ | ✅ | `render_payload.json` แก้ 2 บรรทัด (#0 orig 1.09–3.35, #30 orig 76.10–77.44 → output 70.29–71.63) ; `GET /subtitle` หลัง render พบ `4A-v1` 2 ครั้ง (`subtitle_get_after_edit.json`) |
| 11 | `render_only_task` เริ่มหลังยืนยัน | ✅ | `render_response.json` HTTP 200 task `…-render` ; `render_status_poll.txt` จบ `SUCCESS` mode `final` ; `render_log.txt:95` `succeeded in 11.29s` |
| 12 | ffmpeg ตัด+ต่อ+เบิร์นซับจบไม่ error | ✅ | `render_log.txt:9` `[filter_complex] 2 segment(s), audio=True` ; ไม่พบ ERROR/Traceback ใน log ; `burn_subtitle: true` ใน edit_summary |
| 13 | `tail_pad=0` ใน render-from-preview | ✅ (ทางอ้อม) | output 137.433 vs ผลรวมช่วง 137.43 ต่าง 0.003 วิ ; ถ้ามี pad 0.2×2 จะยาว ≈ 137.83 (`duration_check.txt`) |
| 14 | `final_summary.mp4` มีจริงและเปิดได้ | ✅ | ffprobe: h264 1280×720 + aac, 37,807,861 B (`output_video_info.txt`) |
| 15 | ความยาว output = ผลรวมช่วงที่เลือก | ✅ | 137.433 vs 137.43 (ต่าง 0.003) |
| 16 | ซับที่เบิร์นตรงข้อความที่แก้ | ✅ | `frame_2.2.jpg` (ก่อนรอยตัด, บรรทัด #0 output 1.09–3.35): เห็น "V 04 คิดวิโลทศอบผู้สำพาด [แก้ไขโดยเทสต์ 4A-v1]" |
| 17 | ซับไม่มี offset (หลังรอยตัด) | ✅ | `frame_70.96.jpg` (หลังรอยตัด 69.91 อยู่ 1.05 วิ ; บรรทัด #30 output 70.29–71.63): เห็น "เราซื้อคือ 100 [แก้ไขโดยเทสต์ 4A-v1]" = ซับขึ้นตรงช่วงเวลา output ที่ remap แล้ว ; **ข้อจำกัด:** ภาพนิ่งยืนยันได้ว่าซับอยู่ในหน้าต่าง 70.29–71.63 (ความคลาดไม่เกินช่วงนั้น) แต่วัดความตรงกับเสียงละเอียดกว่านี้ไม่ได้ → ยืนยันด้วยหูใน UI ข้อ 27 ; รอบเก่าข้อนี้ "ผ่านบางส่วน" (ตรวจแค่ก่อนรอยตัด) |
| 18 | จำนวนช่วงตัดตรงกันระหว่าง 2 หน้าจอ | ⬜ | ระดับ API: preview 2 ช่วง = `edit_summary.segments_kept` 2 ; หน้าจอ → UI ข้อ 4, 17 |

**สรุป:** ✅ **14** (1,2,3,5,6,9,10,11,12,13,14,15,16,17) · ⚠️ **1** (4) · ❌ **0** · ⬜ **3** (7,8,18 — พฤติกรรมหน้าจอ) · รวม 18

เทียบรอบเดิม (e136e8a, V02): ✅13 ⚠️1 ⬜4 → รอบนี้ข้อ 3 และ 17 เปลี่ยนเป็น ✅ ; ข้อ 4 ลดเป็น ⚠️ เพราะ poll ไม่ทันช่วงประมวลผล (ไม่ใช่ระบบผิด — แก้ได้ด้วยการเริ่ม poll ทันทีหลังอัปโหลด)

**หลักฐานเสริมข้อ 4 (จาก UI ไม่เปลี่ยนสถานะในตาราง):** รอบ UI 2026-10-06 19:31 ผู้ทดสอบเห็นเปอร์เซ็นต์บนหน้าประมวลผลขยับหลายค่า → สถานะอัปเดตระหว่างทางจริง ; ระดับ API ยังคง ⚠️ เพราะไฟล์ poll ไม่มีค่าระหว่างทาง (ดู `UI-CHECKLIST.md`)

ข้อเสริม (นอก 18 ข้อ): ปฏิเสธคำขอไม่มีสิทธิ์ — ✅ ดู `api_no_jwt_result.md`
ตรวจ token หลุด: Claude grep `eyJ` ในทุกไฟล์ `api/*.json *.txt` = ไม่พบ
