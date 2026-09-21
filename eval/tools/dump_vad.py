r"""
ดึงผล VAD (voice_segments) ของงานที่รันไปแล้ว — เพื่อ replay ตัวกรอง transcript แบบออฟไลน์

รันใน worker container (PowerShell):
  docker compose cp eval\tools\dump_vad.py worker:/tmp/dump_vad.py
  docker compose exec -T worker python /tmp/dump_vad.py 2> eval\vad-filter-fix\vad_stderr.txt | Out-File -Encoding utf8 eval\vad-filter-fix\vad_raw.txt

อ่านอย่างเดียว: อ่าน storage/<job>/full_audio.wav แล้วพิมพ์ JSON ที่บรรทัดที่ขึ้นต้นด้วย @@VAD_JSON@@
ใช้ get_voice_activity(min_silence_gap=2.0) เหมือน tasks.py:307 ทุกประการ
"""
import json, os, sys
for p in (os.getcwd(), "/app"):
    if p not in sys.path:
        sys.path.insert(0, p)
from core.vad_logic import get_voice_activity

JOBS = {
    "V01": "8e43cd1d-431d-4f98-9e78-0c72946988e1",
    "V02": "0e4c606f-d1e1-42dd-a030-6be1cd904465",
    "V03": "e30793df-0e40-4955-9b4f-c196f0574857",
    "V04": "9590035b-7af5-4e7b-92b9-496ed863a3ba",
    "V05": "4c4597f3-61a4-437d-a420-28d09f6f010b",
    "V06": "0772b3c4-8449-48b6-bbb6-f2631a3aae3a",
    "V07": "cc0db657-a323-4516-9f4c-3e8cf5a23685",
}
out = {}
for clip, job in JOBS.items():
    audio = f"storage/{job}/full_audio.wav"
    if not os.path.exists(audio):
        audio = f"/app/storage/{job}/full_audio.wav"
    print(f"### {clip} {job}", file=sys.stderr)
    out[clip] = {"job": job, "voice_segments": get_voice_activity(audio, min_silence_gap=2.0)}
print("@@VAD_JSON@@" + json.dumps(out, ensure_ascii=False))
