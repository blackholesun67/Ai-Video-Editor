# ผลทดสอบ API ที่ไม่ต้องใช้ JWT — รันโดย Claude 2026-10-06 18:29 +0700

- เครื่อง: `http://localhost/api` (ผ่าน nginx) ; HEAD = `4774fde` (tag `thesis-test-v1`)
- ไม่ได้ส่ง token/X-API-Key ใด ๆ ; ไม่เรียก Gemini ; ไม่สร้าง job

| คำขอ | HTTP | ข้อความ | ผล |
|---|---|---|---|
| GET /health | 200 | `{"status":"ok"}` | ✅ backend ทำงาน |
| GET /jobs | 401 | ต้องล็อกอินก่อน (ไม่มี token) | ✅ |
| GET /status/x | 401 | 〃 | ✅ |
| GET /preview/x | 401 | 〃 | ✅ |
| GET /subtitle/x | 401 | 〃 | ✅ |
| POST /subtitle/x | 401 | 〃 | ✅ |
| POST /render/x | 401 | 〃 | ✅ |
| POST /cancel/x | 401 | 〃 | ✅ |
| GET /jobs/x/media-token | 401 | 〃 | ✅ |
| POST /upload | 401 | 〃 | ✅ |
| GET /download/x | 400 | job_id ผิดรูปแบบ | ✅ |
| GET /media/x/thumbnail.jpg | 400 | job_id ผิดรูปแบบ | ✅ |
| GET /download/{uuid ที่ไม่มีจริง} | 403 | token ไม่ถูกต้องหรือหมดอายุ | ✅ |
| GET /media/{uuid}/thumbnail.jpg | 403 | 〃 | ✅ |
| GET /download/{uuid}?token=bad | 403 | 〃 | ✅ |

สรุป: ทุก endpoint ที่แตะข้อมูลงานปฏิเสธคำขอที่ไม่มีสิทธิ์ ข้อความเป็นภาษาไทย ไม่มี stack trace หลุด
ข้อจำกัด: ข้อนี้ **ไม่อยู่ใน 18 ข้อเดิม** (เป็นข้อเสริมด้านสิทธิ์เข้าถึง) และไม่ได้ทดสอบกรณี "token ของคนอื่น" (ต้องมี 2 บัญชี)
