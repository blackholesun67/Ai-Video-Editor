import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
"""
Dry-run ของ analysis_harness.py บนเครื่อง host (ไม่ต้องมี Docker/torch/Gemini)

ตรวจ "อินพุตที่ analyze_video_content ส่งให้ Gemini": ท่อนที่ผ่านตัวกรอง VAD และขนาด payload
ด้วยโค้ดเดิม (baseline-ch4) เทียบโค้ดใหม่ (working tree) — Gemini ถูกแทนด้วยตัวปลอมที่ตอบ [] เสมอ
⚠️ นี่ไม่ใช่การวัดคุณภาพการตัด — ผลการตัดปลายทางต้องรัน analysis_harness.py ใน worker จริง

รัน: python eval/tools/harness_dryrun.py   (จาก root โปรเจกต์)
"""
import io, json, os, subprocess, sys, tempfile, types, runpy, contextlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
tmp = tempfile.mkdtemp()
open(os.path.join(tmp, "ai_logic_old.py"), "w", encoding="utf-8").write(
    subprocess.run(["git", "show", "baseline-ch4:backend/core/ai_logic.py"], capture_output=True, text=True, encoding="utf-8", check=True).stdout)
open(os.path.join(tmp, "ai_logic_new.py"), "w", encoding="utf-8").write(open(os.path.join(ROOT, "backend/core/ai_logic.py"), encoding="utf-8").read())
os.environ.update({"GEMINI_API_KEY": "x", "HARNESS_DRYRUN": "1", "HARNESS_TMP": tmp,
                   "HARNESS_RUNS": os.environ.get("HARNESS_RUNS", "V02_full,V06_full,V06_summary,V07_full")})
for name in ["google", "google.genai", "google.genai.errors", "google.genai.types", "faster_whisper", "dotenv", "core.visual_logic", "core.vad_logic"]:
    sys.modules[name] = types.ModuleType(name)
sys.modules["google"].genai = sys.modules["google.genai"]; sys.modules["google.genai"].errors = sys.modules["google.genai.errors"]
sys.modules["google.genai"].types = sys.modules["google.genai.types"]
sys.modules["faster_whisper"].WhisperModel = object; sys.modules["faster_whisper"].BatchedInferencePipeline = object
sys.modules["dotenv"].load_dotenv = lambda *a, **k: None
sys.modules["core.visual_logic"].pick_keyframe_times = None; sys.modules["core.visual_logic"].extract_keyframes = None
os.chdir(os.path.join(ROOT, "backend")); sys.path.insert(0, os.getcwd())

buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    runpy.run_path(os.path.join(ROOT, "eval/tools/analysis_harness.py"), run_name="__main__")
data = json.loads(buf.getvalue().split("@@HARNESS_JSON@@")[1])
for run, rec in data.items():
    for tag, label in (("old", "โค้ดเดิม baseline-ch4"), ("new", "โค้ดใหม่ (working tree)")):
        r = rec[tag]
        print("%-12s %-22s %s" % (run, label, "ok" if r["ok"] else "ERROR " + str(r.get("error"))))
        for l in r["log"].splitlines():
            if "VAD Pre-filter" in l or l.strip().startswith("segment ") or "[Transcript]" in l:
                print("     ", l.strip()[:130])
