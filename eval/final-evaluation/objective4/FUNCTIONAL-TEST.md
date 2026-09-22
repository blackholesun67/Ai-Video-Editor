# Objective 4.A — Functional Test Checklist

- สถานะ: **เตรียม checklist เท่านั้น ยังไม่ได้รันจริง** (ตามคำสั่งรอบนี้ — ห้ามเรียก Gemini/แก้ backend)
- ขอบเขต: ทดสอบว่า flow ของระบบทำงานได้จริงผ่าน endpoint/UI จริง (ไม่ใช่เรียก `analyze_video_content()` ตรงแบบที่ `analysis_harness.py` ทำ) — ปิดช่องว่างที่ `eval/pre-final-audit.md` §11 พบว่า evidence ทั้งหมดของ 3 fixes จำกัดอยู่ที่ core decision logic เท่านั้น
- คลิปที่แนะนำ: 1–2 คลิปจากชุด V02–V07 (มีไฟล์ต้นฉบับอยู่แล้ว ไม่ต้องเตรียมใหม่)
- ผู้ใช้เป็นคนสั่ง `docker compose up` เอง (ตามข้อตกลงเดิม CLAUDE.md §7) — Claude ตรวจผลจาก response/log ที่เกิดขึ้นจริงเท่านั้น

---

## Checklist

### 1. Upload
- [ ] อัปโหลดไฟล์วิดีโอผ่าน endpoint จริง (ไม่ใช่ฉีด transcript แบบ harness)
- [ ] ได้ `job_id` กลับมาถูกต้อง
- [ ] ไฟล์ถูกเก็บที่ `backend/storage/<job_id>/` ตามที่คาด
- [ ] error handling: อัปโหลดไฟล์ผิดชนิด/ไฟล์เสีย ได้ error message ที่เข้าใจได้ (ไม่ crash เงียบ ๆ)

### 2. Processing
- [ ] `process_video_task` (Celery) เริ่มทำงานหลังอัปโหลดสำเร็จ
- [ ] สถานะ job อัปเดตระหว่างประมวลผล (ตรวจผ่าน endpoint สถานะ ถ้ามี)
- [ ] ffmpeg → VAD → Whisper → Gemini ทำงานครบตามลำดับ (ตรวจจาก log จริงของ worker)
- [ ] job จบสมบูรณ์และมี `preview.json` ที่ `backend/storage/<job_id>/`

### 3. Preview
- [ ] หน้า Preview โหลด `preview.json` ของ job ที่เพิ่งประมวลผลถูกต้อง
- [ ] ช่วงที่ AI เสนอเก็บ/ตัด แสดงผลตรงกับข้อมูลใน `preview.json`
- [ ] ไทม์ไลน์ปูเต็ม `[0, duration]` ต่อกันสนิท (ตาม invariant CLAUDE.md §2.4)
- [ ] ปุ่ม "ดู" seek ไปยังตำแหน่งที่ถูกต้องในคลิปต้นฉบับ (ไม่ใช่คลิปที่ตัดแล้ว — ตาม CLAUDE.md §2.3)

### 4. Select/Deselect
- [ ] ติ๊ก/ยกเลิกติ๊กช่วงในหน้า preview แล้วค่า `on` ของแถวเปลี่ยนถูกต้อง
- [ ] `splitAt`/`applyMerge` (ถ้าทดสอบ) ไม่ทำให้ผลลัพธ์ที่จะ render เปลี่ยนไปจากที่ตั้งใจ
- [ ] ปุ่ม "คืนค่า AI" ทำงานถูกต้องหลังแก้ไข้ selection

### 5. Edit (ซับ)
- [ ] เข้าหน้าแก้ซับได้หลังยืนยัน selection จากหน้า preview
- [ ] หน้าแก้ซับใช้ **`POST /subtitle/{job_id}`** (segments ที่เลือกอยู่จริง) ไม่ใช่ `GET /subtitle` เป็นค่าหลัก (ตาม CLAUDE.md §2.5 — เคยพลาดมาแล้วที่โชว์ทั้งคลิปทั้งที่เลือกไว้บางส่วน)
- [ ] แก้ข้อความ/เวลาซับแล้วบันทึกได้ถูกต้อง

### 6. Render
- [ ] `render_only_task` เริ่มทำงานหลังยืนยันการแก้ซับ
- [ ] ffmpeg ตัด+ต่อ+เบิร์นซับ (ถ้าเปิด) ทำงานจนจบไม่ error
- [ ] `tail_pad=0` ถูกใช้ในเส้นทาง render-from-preview (ตาม CLAUDE.md §6 — ต่างจาก `process_video_task` ที่ใช้ 0.2)

### 7. Output Verification
- [ ] ไฟล์ output (`final_summary.mp4`) มีอยู่จริงและเปิดเล่นได้
- [ ] ความยาวไฟล์ output ตรงกับผลรวมของช่วงที่เลือก (± ความคลาดเคลื่อนที่ยอมรับได้จาก snap/pad)
- [ ] ซับ (ถ้าเปิด burn) ตรงกับข้อความ/เวลาที่แก้ไว้ในขั้นที่ 5 — ไม่มีปัญหา offset (CLAUDE.md §6: เคยพลาดมาแล้ว 0.2 วิ/ช่วง)
- [ ] จำนวนช่วงตัดใน output ตรงกับที่หน้า preview/แก้ซับแสดงไว้ (ไม่ขัดกันระหว่าง 2 หน้าจอ — CLAUDE.md §5)

---

## Evidence ที่ต้องเก็บ (เมื่อรันจริง)

```
eval/final-evaluation/objective4/functional/
  run1/
    upload_response.json
    process_log.txt
    preview_screenshot.png (หรือ preview.json ที่โหลดจริง)
    subtitle_post_payload.json + response.json
    render_log.txt
    output_video_info.txt   (duration, size, ตรวจด้วย ffprobe)
    checklist_result.md     (ติ๊ก checklist ด้านบนพร้อมหมายเหตุ pass/fail ต่อข้อ)
```

## หมายเหตุ

- ไม่นับเป็น Objective 1 (recall/precision) — Objective 4.A วัดแค่ "ระบบทำงานได้ตาม flow ที่ออกแบบไว้หรือไม่" (pass/fail ต่อ endpoint/ขั้นตอน)
- ต้องใช้ Gemini จริงในขั้น Processing (เพราะเป็น endpoint จริง ไม่ใช่ harness ที่ฉีด transcript ได้) — **อยู่นอกเหนือรอบเตรียมความพร้อมนี้ ต้องรอคำสั่งให้เรียก Gemini จริงก่อนรัน checklist นี้**
