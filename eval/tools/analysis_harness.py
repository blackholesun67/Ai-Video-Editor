r"""
ทดสอบ "ขั้นวิเคราะห์" (tasks.py Step 2-3) ด้วย ai_logic.py สองเวอร์ชัน โดยไม่ rebuild worker

ทำซ้ำสิ่งที่ tasks.process_video_task ทำ: get_voice_activity → get_visual_signals → analyze_video_content
ด้วยพารามิเตอร์เดิมจาก preview.json ของงาน baseline (user_prompt / edit_mode / output_mode / target_length)
ต่างจากรันจริงข้อเดียว: transcript ถูก "ฉีด" จาก preview.json เดิมแทนการถอด Whisper ใหม่
  → อินพุตของ Gemini ต่างกันเฉพาะที่ตัวกรอง VAD เปลี่ยน (ตัดความแปรปรวนของ Whisper ออก)
  → ยังเรียก Gemini จริง (ผลไม่แน่นอน ดังนั้นรันโค้ดเดิม = "control" คู่กันทุกครั้ง)

ไม่แตะโค้ด/สตอเรจของ worker: อ่าน storage อย่างเดียว, ai_logic ทั้งสองเวอร์ชันโหลดจาก /tmp ของ container
ที่ส่งเข้าไปด้วย `docker compose cp` (โมดูลที่ celery worker โหลดอยู่ไม่ถูกแทนที่)

รัน (จาก root โปรเจกต์ ใน PowerShell) — ไม่ pipe สคริปต์ทาง stdin และไม่ใช้ `>` เพราะทำให้ภาษาไทยเพี้ยน/ไฟล์เป็น UTF-16:
  git show baseline-ch4:backend/core/ai_logic.py | Set-Content -Encoding utf8 $env:TEMP\ai_logic_old.py
  docker compose cp $env:TEMP\ai_logic_old.py worker:/tmp/ai_logic_old.py            # โค้ดเดิม (control)
  docker compose cp backend\core\ai_logic.py worker:/tmp/ai_logic_new.py       # โค้ดใหม่
  docker compose cp eval\tools\analysis_harness.py worker:/tmp/analysis_harness.py
  docker compose exec -T worker python /tmp/analysis_harness.py 2> eval\vad-filter-fix\harness_stderr.txt | Out-File -Encoding utf8 eval\vad-filter-fix\harness_out.txt
  python eval\tools\harness_unpack.py ; python eval\tools\score.py
"""
import contextlib, copy, importlib.util, io, json, os, sys, time, traceback

for p in (os.getcwd(), "/app"):
    if p not in sys.path:
        sys.path.insert(0, p)

# label -> (job_id ที่เก็บ preview.json ของ baseline ไว้ใน storage)
# ครบ 9 case (Final Evaluation Objective 1/2, เพิ่มเมื่อเตรียมความพร้อมรอบ Pre-Final →
# Final Evaluation): V01 ไม่มี eval/V01/ground_truth.txt (ตรวจแล้ว — ไม่มีอยู่ในทุก commit)
# จึงใช้ได้แค่เป็น sanity run ระดับ input/pipeline เท่านั้น recall/precision จะเป็น N/A เสมอ
# ห้ามสร้างเฉลยปลอมให้ V01 เพื่อให้มีตัวเลข
RUNS = {
    "V01_full":    "8e43cd1d-431d-4f98-9e78-0c72946988e1",  # ไม่มี ground_truth.txt — sanity เท่านั้น
    "V02_full":    "0e4c606f-d1e1-42dd-a030-6be1cd904465",
    "V03_full":    "9eb88221-4197-463f-8c62-1daed7dd9744",  # ⚠️ eval/V03/ground_truth.txt เขียนไว้สำหรับ mode: summary (มีแค่ TANGENT ใน SHOULD_CUT) — รัน full ได้จริง แต่ recall จะเป็น N/A โดยดีไซน์ (TANGENT ไม่อยู่ใน ALLOWED["full"] ของ score.py) ไม่ใช่บั๊ก
    "V03_summary": "e30793df-0e40-4955-9b4f-c196f0574857",
    "V04_full":    "9590035b-7af5-4e7b-92b9-496ed863a3ba",
    "V05_full":    "4c4597f3-61a4-437d-a420-28d09f6f010b",
    "V06_full":    "0772b3c4-8449-48b6-bbb6-f2631a3aae3a",
    "V06_summary": "20692075-ce67-46ae-aea5-6b9672231db7",
    "V07_full":    "cc0db657-a323-4516-9f4c-3e8cf5a23685",
}
ONLY = [x for x in os.environ.get("HARNESS_RUNS", "").split(",") if x]


def quiet_import(tag, path):
    spec = importlib.util.spec_from_file_location(f"core.ai_logic_{tag}", path)
    mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(mod)
    return mod


# โหมดจำลอง (HARNESS_DRYRUN=1) ใช้ทดสอบ "โครงสายงาน" ของสคริปต์นี้บนเครื่องที่ไม่มี torch/Gemini เท่านั้น:
# Gemini ปลอมตอบ [] เสมอ, VAD อ่านจากไฟล์ที่ dump ไว้, ไม่ดึงภาพ — ผลที่ได้ "ไม่ใช่" การวัดคุณภาพใด ๆ
DRY = os.environ.get("HARNESS_DRYRUN") == "1"
TMP = os.environ.get("HARNESS_TMP", "/tmp")
if DRY:
    _vad = json.load(open("../eval/vad-filter-fix/vad_segments.json", encoding="utf-8"))
    _cur = {"clip": None}   # V06 full/summary ใช้เสียงเดียวกัน → ค้นตามชื่อคลิป ไม่ใช่รหัสงาน
    get_voice_activity = lambda audio, min_silence_gap=2.0: _vad[_cur["clip"]]["voice_segments"]
    get_visual_signals = lambda video_path: {"scene_cuts": [], "black": [], "freeze": []}
else:
    from core.vad_logic import get_voice_activity
    from core.visual_logic import get_visual_signals

MODS = {"old": quiet_import("old", f"{TMP}/ai_logic_old.py"), "new": quiet_import("new", f"{TMP}/ai_logic_new.py")}
if DRY:
    for _m in MODS.values():
        _m.call_gemini_with_retry = lambda *a, **k: "[]"
        _m.extract_keyframes = lambda *a, **k: []
out = {}
for label, job in RUNS.items():
    if ONLY and label not in ONLY:
        continue
    base = json.load(open(f"storage/{job}/preview.json", encoding="utf-8"))
    audio = f"storage/{job}/full_audio.wav"
    print(f"### {label} {job}", file=sys.stderr, flush=True)
    if DRY:
        _cur["clip"] = label.split("_")[0]
    voice = get_voice_activity(audio, min_silence_gap=2.0)
    visual = get_visual_signals(base["video_path"])
    out[label] = {"job": job, "voice_segments": voice}
    for tag in ("old", "new"):          # สลับ old/new ทีละคลิป กัน drift ของ Gemini ทั้งช่วง
        mod = MODS[tag]
        mod.transcribe_audio = lambda audio_path, initial_prompt=None, progress_cb=None, _t=base["transcript"]: copy.deepcopy(_t)
        buf = io.StringIO(); t0 = time.time(); rec = {}
        try:
            with contextlib.redirect_stdout(buf):
                ai_result, transcript = mod.analyze_video_content(
                    audio_path=audio, user_prompt=base["user_prompt"], voice_segments=voice,
                    output_mode=base.get("output_mode", "standard"), edit_mode=base.get("edit_mode"),
                    target_length=base.get("target_length", 60), preset_id=base.get("preset_id"),
                    progress_cb=None, video_path=base["video_path"], visual=visual)
            rec = {"ok": True, "selected_segments": ai_result, "transcript": transcript}
        except Exception as e:
            rec = {"ok": False, "error": f"{type(e).__name__}: {e}", "trace": traceback.format_exc()[-1500:]}
        rec.update({"edit_mode": base.get("edit_mode"), "user_prompt": base.get("user_prompt"),
                    "seconds": round(time.time() - t0, 1), "log": buf.getvalue()})
        out[label][tag] = rec
        print(f"    {tag}: {'ok' if rec['ok'] else 'ERROR'} {rec['seconds']}s", file=sys.stderr, flush=True)
print("@@HARNESS_JSON@@" + json.dumps(out))   # ASCII ล้วน: ทนต่อรหัสอักขระของคอนโซล Windows
