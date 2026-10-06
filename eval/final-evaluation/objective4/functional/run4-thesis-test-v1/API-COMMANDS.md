# 4A API — คำสั่งให้ผู้ทดสอบรันเอง (ต้องใช้ JWT) · รุ่น `thesis-test-v1`

รันใน **Git Bash** ที่โฟลเดอร์ repo ทีละบล็อก ; คำสั่ง `docker compose exec` ที่มี path `/app/...` ต้องมี `MSYS_NO_PATHCONV=1` นำหน้า
(ไม่งั้น Git Bash แปลง `/app/...` เป็น path Windows `C:/Program Files/Git/app/...` ก่อนส่งเข้า container) ; ผลดิบทุกไฟล์ลง `api/` ของโฟลเดอร์นี้
**Gemini:** ทั้งชุดเรียกแค่ตอนวิเคราะห์ (ขั้น 1) **1 งาน ≈ 1–2 คำขอ** (รอบ 2026-10-06 จริง = 1 เพราะขั้นแก้คำข้ามเมื่อ transcript ไม่มีอักษรละติน) (แก้คำ 1 + เลือกช่วงตัด 1 ทำขนานกัน ;
V04 อยู่ใน transcript cache จึงไม่รัน Whisper) — ถ้าเจอ 429/503 จะ retry/สลับ key เพิ่มเอง ดูได้จาก log ขั้น 2
ขั้นแก้ซับ/เรนเดอร์/ไฟล์เสีย **ไม่เรียก Gemini** · ใช้งาน burn=true งานเดียว (รอบเก่าใช้ 2 งาน) จึงไม่ต้องอัปซ้ำ

## 0. เตรียม (token ไม่ถูกเขียนลงไฟล์)

```bash
cd /c/Users/nine0/Desktop/ai-video-editor-git
R=eval/final-evaluation/objective4/functional/run4-thesis-test-v1; mkdir -p $R/api; A=$R/api
B=http://localhost/api
VID=backend/storage/33893d21-07f3-4d6e-bf9d-2f8e329a6a4d/V04___________________________________.mp4
ls -la "$VID"        # ต้องมีไฟล์ 61.6MB (ถ้าถูก cleanup ไปแล้ว ใช้สำเนา V04 ของคุณแทน)
read -rs TOKEN       # วาง: เปิดเว็บ ล็อกอิน → F12 Console → localStorage.getItem('aive_token') (ไม่เอาเครื่องหมาย ")
H=(-H "Authorization: Bearer $TOKEN")
# ไม่ต้องส่ง X-API-Key: API_KEYS ใน backend/.env เป็นค่าว่าง → require_api_key เป็น no-op
# ตรวจได้ด้วย: docker compose exec backend printenv API_KEYS   (ไม่แสดงอะไร = ไม่ตรวจ)
# ถ้าวันหนึ่งตั้ง API_KEYS แล้ว ให้เพิ่ม: read -rs AK; H+=(-H "X-API-Key: $AK")
curl -s "${H[@]}" $B/jobs -o /dev/null -w "jobs HTTP:%{http_code}\n"   # ต้องได้ 200
```

## ข้อ 1–2 อัปโหลด (← จุดเดียวที่ใช้ Gemini)

```bash
P='ตัดเฉพาะช่วงเงียบ ช่วงหยุดคิดนาน คำติดปาก (อืม เอ่อ อ่อ) เสียงรบกวน ปัญหาเทคนิค และช่วงพูดซ้ำโดยไม่มีข้อมูลใหม่ — เก็บเนื้อหาที่พูดไว้ให้ครบ ไม่ตัดใจความ ดูแล้วต้องเข้าใจว่าพูดเรื่องอะไร'
date '+%F %T %z' > $A/upload_time.txt
curl -s "${H[@]}" -F video=@"$VID" -F prompt="$P" -F edit_mode=full -F preview_mode=true -F burn_subtitle=true \
  -w "\nHTTP:%{http_code}\n" $B/upload | tee $A/upload_response.json
JOB=$(grep -o '"job_id":"[^"]*"' $A/upload_response.json | cut -d'"' -f4); echo $JOB | tee $A/job.txt
```
(prompt คือข้อความเดียวกับที่หน้าเว็บส่งในโหมด "เก็บเนื้อหาครบ")

## ข้อ 4 ติดตามสถานะจนจบ

```bash
until curl -s "${H[@]}" $B/status/$JOB | tee -a $A/status_poll.txt | grep -q '"SUCCESS"\|"FAILURE"'; do echo >> $A/status_poll.txt; sleep 5; done; echo; tail -c 300 $A/status_poll.txt
```
ผ่าน = เห็น progress เพิ่มขึ้นหลายค่า แล้วจบด้วย `SUCCESS`

## ข้อ 2, 5 ไฟล์ใน storage + ลำดับใน log

```bash
ls -la backend/storage/$JOB | tee $A/storage_files.txt
docker compose logs worker --since 15m --no-color > $A/process_log.txt
grep -n "Cache HIT\|VAD Pre-filter\|Silence Gap\|Trying gemini\|HTTP/1.1\|Retake\|succeeded\|ERROR" $A/process_log.txt | tee $A/process_log_key_lines.txt
```
ผ่านข้อ 5 = เห็นตามลำดับ Cache HIT → VAD Pre-filter → Silence Gap → Trying gemini → `200 OK` ; **นับบรรทัด `Trying gemini` = จำนวนคำขอ Gemini จริง** จดลง api_result.md

## ข้อ 6–7 preview

```bash
curl -s "${H[@]}" $B/preview/$JOB -w "\nHTTP:%{http_code}\n" > $A/preview_response.json; tail -1 $A/preview_response.json
python $R/check.py preview $A/preview_response.json | tee $A/preview_check.txt
python $R/check.py payload $A/preview_response.json > $A/subtitle_post_payload.json
```
ถ้าขึ้น ⚠️ "AI เสนอแค่ 1 ช่วง" → เปิด `subtitle_post_payload.json` แก้ให้มีรอยตัด 1 จุดเอง (เช่นตัดช่วงเงียบที่เห็นใน preview_check) **และจดว่าเป็นการจำลอง**

## ข้อ 9 ซับต้องตาม selection (POST /subtitle)

```bash
curl -s "${H[@]}" -H "Content-Type: application/json" --data-binary @$A/subtitle_post_payload.json \
  -w "\nHTTP:%{http_code}\n" $B/subtitle/$JOB > $A/subtitle_response.json; tail -1 $A/subtitle_response.json
python $R/check.py subtitle $A/subtitle_post_payload.json $A/subtitle_response.json | tee $A/subtitle_check.txt
```
ผ่าน = HTTP 200, `ไม่มี orig_* = 0`, `นอก selection = 0`

## ข้อ 10–12 แก้ซับ 2 บรรทัด (บรรทัดแรก + บรรทัดแรกหลังรอยตัด) แล้ว render

```bash
python $R/check.py render $A/subtitle_post_payload.json $A/subtitle_response.json > $A/render_payload.json   # จด "แก้บรรทัด #..." ที่ขึ้นมา
curl -s "${H[@]}" -H "Content-Type: application/json" --data-binary @$A/render_payload.json \
  -w "\nHTTP:%{http_code}\n" $B/render/$JOB | tee $A/render_response.json
until curl -s "${H[@]}" $B/status/$JOB-render | tee -a $A/render_status_poll.txt | grep -q '"SUCCESS"\|"FAILURE"'; do echo >> $A/render_status_poll.txt; sleep 3; done; echo
curl -s "${H[@]}" $B/subtitle/$JOB > $A/subtitle_get_after_edit.json; grep -c "4A-v1" $A/subtitle_get_after_edit.json   # ข้อ 10: ต้องได้ 1 (บรรทัดเดียวของ JSON) และมีข้อความที่แก้
docker compose logs worker --since 5m --no-color > $A/render_log.txt
```

## ข้อ 13–15 ไฟล์ผลลัพธ์ + ความยาว

```bash
MSYS_NO_PATHCONV=1 docker compose exec -T worker ffprobe -v error -show_entries stream=codec_name,codec_type,width,height:format=duration,size \
  -of default=nw=1 /app/storage/$JOB/final_summary.mp4 > $A/output_video_info.txt; cat $A/output_video_info.txt
python $R/check.py duration $A/render_payload.json $A/output_video_info.txt | tee $A/duration_check.txt
```
ผ่าน = มี h264+aac ; ต่างไม่เกิน ~0.1 วิ (ถ้ามี tail_pad 0.2 ต่อช่วง จะยาวเกิน ≈ 0.2×จำนวนช่วง)

## ข้อ 16–17 ซับที่เบิร์น (ก่อน + หลังรอยตัด) — ปิดช่องที่รอบเก่าตรวจได้แค่บางส่วน

ใช้เวลา output ของบรรทัดที่แก้ (จาก "แก้บรรทัด #... → output A–B") แทน `T1`/`T2` (จุดใดก็ได้ในช่วง A–B)
รอบ 2026-10-06 ใช้ `T1=2.2` (บรรทัด #0 output 1.09–3.35) และ `T2=70.96` (บรรทัด #30 output 70.29–71.63 ; รอยตัดอยู่ที่ 69.91) → `api/frame_2.2.jpg`, `api/frame_70.96.jpg`
```bash
for T in T1 T2; do MSYS_NO_PATHCONV=1 docker compose exec -T worker ffmpeg -v error -y -ss $T -i /app/storage/$JOB/final_summary.mp4 -frames:v 1 /app/storage/$JOB/frame_$T.jpg; cp backend/storage/$JOB/frame_$T.jpg $A/; done
```
ผ่าน = ทั้งสองภาพเห็นข้อความลงท้าย `[แก้ไขโดยเทสต์ 4A-v1]` ; ภาพ T2 (หลังรอยตัด) คือหลักฐานว่าซับไม่เหลื่อม

## ข้อ 3 ไฟล์ผิดชนิด/ไฟล์เสีย (ไม่ใช้ Gemini)

```bash
printf 'not a video' > $A/fake.txt; cp $A/fake.txt $A/fake.mp4
curl -s "${H[@]}" -F video=@$A/fake.txt -F prompt="$P" -w "\nHTTP:%{http_code}\n" $B/upload | tee $A/bad_ext_response.json      # คาด 400 "ไฟล์ .txt ไม่รองรับ"
curl -s "${H[@]}" -F video=@$A/fake.mp4 -F prompt="$P" -w "\nHTTP:%{http_code}\n" $B/upload | tee $A/fake_mp4_upload.json        # คาด 200 ได้ job_id
FJ=$(grep -o '"job_id":"[^"]*"' $A/fake_mp4_upload.json | cut -d'"' -f4)
until curl -s "${H[@]}" $B/status/$FJ | tee $A/fake_mp4_status.json | grep -q '"SUCCESS"\|"FAILURE"'; do sleep 3; done; echo; cat $A/fake_mp4_status.json
```
ผ่าน = ไฟล์ .txt ได้ 400 ; fake.mp4 จบ `FAILURE` พร้อม "ไฟล์วิดีโอเปิดไม่ได้หรือเสียหาย กรุณาตรวจไฟล์แล้วลองใหม่" (ไม่มีคำว่า ffmpeg/Traceback/path)

## ข้อ 8, 18 เป็นพฤติกรรมหน้าจอ → ดู UI-CHECKLIST ข้อ 8–15 และ 17, N1–N2

## ปิดท้าย
```bash
unset TOKEN AK H
grep -rl "eyJ" $A && echo "⚠️ มี token หลุดในไฟล์ ลบก่อน commit" || echo "ไม่มี token ในไฟล์"
```
