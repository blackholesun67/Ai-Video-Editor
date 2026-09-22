# RERUN — รัน V07_full และ V06_summary หลัง Gemini quota รีเซ็ต

เตรียมไว้ล่วงหน้า **ยังไม่ได้รัน** · ห้ามแก้ซอร์ส/เฉลย/threshold/นิยามตัวชี้วัด ระหว่างรัน · รันครั้งเดียว ถ้า Gemini error ให้เก็บ error แล้วหยุด

คำสั่งทั้งหมดรันใน **PowerShell จาก root ของโปรเจกต์** (`ai-video-editor-git`)

---

## 0. ตรวจก่อนรัน (อ่านอย่างเดียว — คำสั่งชุดนี้ทดสอบแล้วว่าใช้ได้ใน PowerShell)

```powershell
# (ก) ซอร์สยังเป็นโค้ดเดียวกับที่ทดสอบ (แฮชแบบตัด BOM และ CR)
git show vad-fix-v1:backend/core/ai_logic.py | Set-Content -Encoding utf8 $env:TEMP\ai_logic_old.py
python -c "import hashlib,os; b=open(os.path.join(os.environ['TEMP'],'ai_logic_old.py'),'rb').read(); b=b[3:] if b[:3]==b'\xef\xbb\xbf' else b; print('control', hashlib.sha256(b.replace(b'\r',b'')).hexdigest())"
python -c "import hashlib; b=open('backend/core/ai_logic.py','rb').read(); print('new    ', hashlib.sha256(b.replace(b'\r',b'')).hexdigest())"
#   control ที่ต้องได้ = aa7b4ccb117f2828c409a867f7fa45eaffe4b84aeda3e0ad44a37040260a6392
#   new     ที่ต้องได้ = e91d487e63ab86571a7a8133209e718d11b55d8b60f9e232e0b2b49981dafd78

# (ข) archive ยังสมบูรณ์ (ต้องได้ "แฮชไม่ผ่าน: 0")
Push-Location eval\silence-gap\archive-before-quota-reset
$bad = 0; $n = 0
Get-Content MANIFEST.sha256 | ForEach-Object {
  $parts = $_ -split '\s+\*?', 2
  $n++
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $parts[1]).Hash.ToLower() -ne $parts[0]) { $bad++; "ผิด: $($parts[1])" }
}
"ตรวจ $n ไฟล์ | แฮชไม่ผ่าน: $bad"
Pop-Location

# (ค) stack ทำงานและ worker ว่าง (ไม่มีงานค้าง)
docker compose ps
docker compose exec -T worker celery -A tasks inspect active --timeout 5
```

> อย่า pipe ข้อความซอร์สเข้า `python` ทาง stdin ใน PowerShell 5.1 (ภาษาไทยเพี้ยน → แฮชผิด) ให้เขียนเป็นไฟล์ก่อนแล้วแฮชจากไฟล์ตามข้างบน

**เช็กโควตา Gemini:** free-tier จำกัด 20 คำขอ/วัน/โมเดล/key (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) ควรยืนยันว่ารีเซ็ตแล้วในหน้า quota ของ Google AI Studio ก่อนรัน (โดยทั่วไปรีเซ็ตเที่ยงคืนตามเวลา Pacific ≈ 14:00 น. เวลาไทย — ยืนยันจากหน้า quota ไม่ใช่จากข้อความนี้)
ปริมาณการใช้ครั้งก่อน: run ที่ล้มใช้ ~8–9 คำขอ, run ที่สำเร็จใช้ ~4–7 คำขอ ; รอบนี้ 4 run (V07 old/new, V06 summary old/new) คาดใช้ราว 20–35 คำขอ

---

## 1. (เฉพาะถ้า container ถูกสร้างใหม่) ส่งไฟล์เข้า `/tmp` ของ worker ใหม่

ตรวจก่อนว่าไฟล์ยังอยู่หรือไม่:
```powershell
docker compose exec -T worker sh -c "ls -la /tmp/ai_logic_old.py /tmp/ai_logic_new.py /tmp/analysis_harness.py"
```
ถ้าไม่มี (หรือ container ถูก `up --build`/`down` ไปแล้ว) ให้ copy ทั้ง 3 ไฟล์ใหม่:

```powershell
# ai_logic_old.py = โค้ดปัจจุบัน "vad-fix-v1" (control) — ไม่ใช่ baseline-ch4
git show vad-fix-v1:backend/core/ai_logic.py | Set-Content -Encoding utf8 $env:TEMP\ai_logic_old.py
docker compose cp $env:TEMP\ai_logic_old.py worker:/tmp/ai_logic_old.py

# ai_logic_new.py = โค้ดใหม่ (working tree ที่ยังไม่ commit)
docker compose cp backend\core\ai_logic.py worker:/tmp/ai_logic_new.py

# analysis_harness.py
docker compose cp eval\tools\analysis_harness.py worker:/tmp/analysis_harness.py
```

ตรวจแฮชในคอนเทนเนอร์ (ต้องตรงกับข้อ 0 ก):
```powershell
docker compose exec -T worker sh -c "sed '1s/^\xEF\xBB\xBF//' /tmp/ai_logic_old.py | tr -d '\r' | sha256sum | cut -c1-64; sed '1s/^\xEF\xBB\xBF//' /tmp/ai_logic_new.py | tr -d '\r' | sha256sum | cut -c1-64"
```

> ถ้าไฟล์ทั้ง 3 ยังอยู่ใน `/tmp` และแฮชตรง ข้ามข้อ 1 ได้

---

## 2. รันเฉพาะ V07_full และ V06_summary

```powershell
docker compose exec -T -e HARNESS_RUNS=V07_full,V06_summary worker python /tmp/analysis_harness.py 2> eval\silence-gap\rerun_stderr.txt | Out-File -Encoding utf8 eval\silence-gap\rerun_out.txt

python eval\tools\harness_unpack.py eval\silence-gap\rerun_out.txt --out eval\silence-gap\rerun
```

ผลจะอยู่ที่:
```
eval/silence-gap/rerun_out.txt , rerun_stderr.txt
eval/silence-gap/rerun/after/<run>/        (โค้ดใหม่)
eval/silence-gap/rerun/control-old/<run>/  (โค้ดปัจจุบัน vad-fix-v1 = control)
```

- `stderr` จะมีบรรทัด `NativeCommandError` เป็นเรื่องปกติของ PowerShell 5.1 (ห่อข้อความ "Using cache found…" ของ Silero) ไม่ใช่ความล้มเหลว
- ถ้าอยากลดความเสี่ยงโควตาไม่พอ: รัน `V07_full` เดี่ยว ๆ ก่อน (ลำดับความสำคัญสูงสุด) แล้วค่อยรัน `V06_summary` — เปลี่ยนเป็น `-e HARNESS_RUNS=V07_full` ในบรรทัดข้างบน และใช้ชื่อไฟล์/`--out` คนละชุดต่อการรัน (เช่น `rerun2_*`) เพื่อไม่ให้ทับกัน

---

## 3. ห้ามทำ (กันเขียนทับหลักฐาน)

| ห้าม | เหตุผล |
|---|---|
| `harness_unpack.py ... --out eval\silence-gap` (ไม่มี `\rerun`) | จะเขียนทับ `harness.log` ของ failed run เดิมใน `after/` และ `control-old/` (run ที่ล้มไม่มี `preview.json` จึงไม่ถูกข้าม) |
| ใช้ `--force` | บังคับเขียนทับ |
| ลบ/ย้ายโฟลเดอร์ `eval/silence-gap/{after,control-old}/*` หรือ `archive-before-quota-reset/` | เป็นหลักฐานของ failed run และรอบปัจจุบัน |
| เขียนผลลง `eval/silence-gap/harness_out.txt` / `harness_stderr.txt` เดิม | เป็นผลดิบของรอบที่แล้ว (ใช้ชื่อ `rerun_*` ตามข้างบน) |
| รัน `python eval\tools\score_silence.py` ก่อนตัดสินใจ | มันเขียนทับ `eval/silence-gap/metrics_three_way.json` (มีสำเนาใน archive แล้ว แต่ไม่ควรทับโดยไม่จำเป็น) |
| แก้ซอร์ส/เฉลย/threshold/Step 5/Snap/guard เทคซ้ำ/พรอมป์/นิยามตัวชี้วัด | ต้องการวัดผลของ Silence Gap แยกจากปัจจัยอื่น |
| รันซ้ำเมื่อ Gemini error | เก็บ error แล้วรายงาน ห้ามรันจนได้ค่าที่ต้องการ |

---

## 4. หลังรัน

1. เก็บสำเนาผลก่อนทำอย่างอื่น (แฮชไว้ตรวจภายหลัง)
2. ตรวจ error ต่อ run: `eval/silence-gap/rerun/{after,control-old}/<run>/harness.log` (รวมโมเดล/key ที่ตอบ, 429/503/404)
3. ให้ **ผม (ผู้ช่วย)** คำนวณคะแนนต่อ: `score_silence.py` ปัจจุบันอ่านเฉพาะ `eval/silence-gap/{after,control-old}/` (ไม่ครอบคลุม `rerun/`) — ผมจะเรียกฟังก์ชัน `score()` เดิมกับไฟล์ใน `rerun/` โดยไม่แก้นิยาม แล้วเติมผลลงรายงานโดยไม่แก้ตัวเลขที่มีอยู่
4. จัดประเภทผลเป็น `improved` / `unchanged` / `regressed` / `inconclusive` โดยแยกระดับ input-level กับ final-output และบันทึกความแปรปรวนของ Gemini ระหว่าง control กับ new
5. ห้าม commit จนกว่าผู้ใช้จะตรวจผลแล้วสั่ง
