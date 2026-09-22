import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
"""
จับ "อินพุตที่ analyze_video_content ส่งให้ Gemini" (พรอมป์ขั้น deletion) ด้วยโค้ดสองเวอร์ชัน — ทั้ง 7 คลิป

โค้ดเดิม = tag vad-fix-v1 (OLD_REF) · โค้ดใหม่ = working tree · transcript ฉีดจาก preview.json ของ baseline
VAD จริงจาก eval/vad-filter-fix/vad_segments.json · Gemini ถูกแทนด้วยตัวปลอมที่ "จดพรอมป์" แล้วตอบ []
⚠️ ไม่ใช่การวัดคุณภาพการตัด — ตรวจเฉพาะสิ่งที่ Gemini จะได้เห็น (ท่อนที่ส่ง, hint ช่วงเงียบ, ขนาดพรอมป์)

เขียน: eval/silence-gap/before/gemini_input_summary.json (โค้ดเดิม) และ after/ (โค้ดใหม่) + ข้อความ hint แยกไฟล์ต่อคลิป
รัน: python eval/tools/silence_dryrun.py   (จาก root ของโปรเจกต์)
"""
import contextlib, copy, hashlib, importlib.util, io, json, os, re, subprocess, sys, tempfile, types

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.chdir(ROOT)
OLD_REF = os.environ.get("OLD_REF", "vad-fix-v1")
os.environ.setdefault("GEMINI_API_KEY", "x")
for name in ["google", "google.genai", "google.genai.errors", "google.genai.types", "faster_whisper", "dotenv", "core.visual_logic"]:
    sys.modules[name] = types.ModuleType(name)
sys.modules["google"].genai = sys.modules["google.genai"]; sys.modules["google.genai"].errors = sys.modules["google.genai.errors"]
sys.modules["google.genai"].types = sys.modules["google.genai.types"]
sys.modules["faster_whisper"].WhisperModel = object; sys.modules["faster_whisper"].BatchedInferencePipeline = object
sys.modules["dotenv"].load_dotenv = lambda *a, **k: None
sys.modules["core.visual_logic"].pick_keyframe_times = None; sys.modules["core.visual_logic"].extract_keyframes = None
fn = re.search(r"^def get_silence_gaps.*?(?=^def |\Z)", open("backend/core/vad_logic.py", encoding="utf-8").read(), re.S | re.M).group(0)
vad_stub = types.ModuleType("core.vad_logic"); exec(fn, vad_stub.__dict__); sys.modules["core.vad_logic"] = vad_stub   # get_silence_gaps ตัวจริงจากซอร์ส


def load(tag, source):
    path = os.path.join(tempfile.mkdtemp(), f"ai_logic_{tag}.py"); open(path, "w", encoding="utf-8").write(source)
    spec = importlib.util.spec_from_file_location(f"ai_logic_{tag}", path); mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(mod)
    return mod


old_src = subprocess.run(["git", "show", f"{OLD_REF}:backend/core/ai_logic.py"], capture_output=True, text=True, encoding="utf-8", check=True).stdout
MODS = {"before": load("old", old_src), "after": load("new", open("backend/core/ai_logic.py", encoding="utf-8").read())}
VAD = json.load(open("eval/vad-filter-fix/vad_segments.json", encoding="utf-8"))
RUNS = {  # run -> (clip, preview ที่เก็บ transcript + พารามิเตอร์ตอน baseline)
    "V01_full": ("V01", "eval/V01/preview_pre-baseline.json"), "V02_full": ("V02", "eval/V02/preview.json"),
    "V03_summary": ("V03", "eval/V03/preview_summary-mode-run.json"), "V04_full": ("V04", "eval/V04/preview.json"),
    "V05_full": ("V05", "eval/V05/preview.json"), "V06_full": ("V06", "eval/V06/preview_full.json"),
    "V06_summary": ("V06", "eval/V06/preview_summary.json"), "V07_full": ("V07", "eval/V07/preview.json")}
HINT = re.compile(r"\[ช่วงที่ตรวจพบว่าไม่มีเสียงพูด.*?\n\[.*?\][^\n]*\n", re.S)

summary = {}
for folder in ("before", "after"):
    os.makedirs(f"eval/silence-gap/{folder}", exist_ok=True); summary[folder] = {}
for run, (clip, path) in RUNS.items():
    base = json.load(open(path, encoding="utf-8")); voice = VAD[clip]["voice_segments"]
    for folder, mod in MODS.items():
        prompts = []
        def fake_gemini(prompt, *a, **k):
            prompts.append(prompt if isinstance(prompt, str) else "".join(p for p in prompt if isinstance(p, str)))
            return "[]"
        mod.call_gemini_with_retry = fake_gemini; mod.extract_keyframes = lambda *a, **k: []
        mod.transcribe_audio = lambda audio_path, initial_prompt=None, progress_cb=None, _t=base["transcript"]: copy.deepcopy(_t)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            mod.analyze_video_content(audio_path="unused.wav", user_prompt=base["user_prompt"], voice_segments=voice,
                                      output_mode=base.get("output_mode", "standard"), edit_mode=base.get("edit_mode"),
                                      target_length=base.get("target_length", 60), preset_id=None, progress_cb=None, video_path=None,
                                      visual={"scene_cuts": [], "black": [], "freeze": []})
        # โหมด summary เรียก Gemini ขั้น outline ก่อน (พรอมป์นั้นก็มี <user_request>) → เลือกใบที่เป็น "ขั้น deletion" จริงด้วยหัวข้อหลักการลบ
        deletion = next((p for p in prompts if "[หลักการ: ลบเฉพาะสิ่งที่ไม่มีคุณค่า]" in p), "")
        m = HINT.search(deletion); hint = m.group(0) if m else ""
        log = buf.getvalue().splitlines()
        tline = next((l for l in log if "[Transcript]" in l), ""); sg = [l.strip() for l in log if "[Silence Gap]" in l or l.startswith("  segment=") or "action=" in l]
        gaps = re.findall(r'\{"start": ([\d.]+), "end": ([\d.]+)\}', hint)
        summary[folder][run] = {"transcript_line": tline.strip(), "hint_gap_count": len(gaps), "hint_gaps": [(float(a), float(b)) for a, b in gaps],
                                "deletion_prompt_chars": len(deletion), "deletion_prompt_sha256": hashlib.sha256(deletion.encode("utf-8")).hexdigest()[:16],
                                "gemini_calls": len(prompts), "deletion_prompt_found": bool(deletion), "silence_gap_log": sg}
        open(f"eval/silence-gap/{folder}/hint_{run}.txt", "w", encoding="utf-8").write(hint if hint else "(ไม่มี hint ช่วงเงียบในพรอมป์)\n")
for folder in ("before", "after"):
    json.dump(summary[folder], open(f"eval/silence-gap/{folder}/gemini_input_summary.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("โค้ดเดิม = %s · โค้ดใหม่ = working tree · (Gemini ปลอม: ตรวจเฉพาะอินพุต)\n" % OLD_REF)
print("%-12s | %-24s | %-24s | %-22s | %s" % ("run", "hint gaps เดิม→ใหม่", "ท่อนที่ส่ง เดิม→ใหม่", "พรอมป์ deletion (chars)", "ช่วงเงียบใน hint ใหม่"))
for run in RUNS:
    b, a = summary["before"][run], summary["after"][run]
    segs = lambda s: (re.search(r"(\d+) segments", s["transcript_line"]) or [None, "?"])[1]
    print("%-12s | %2d → %-19d | %-3s → %-19s | %6d → %-13d | %s" % (run, b["hint_gap_count"], a["hint_gap_count"], segs(b), segs(a), b["deletion_prompt_chars"], a["deletion_prompt_chars"], a["hint_gaps"]))
same_text = all(summary["before"][r]["deletion_prompt_sha256"] == summary["after"][r]["deletion_prompt_sha256"] for r in RUNS if summary["before"][r]["hint_gaps"] == summary["after"][r]["hint_gaps"])
print("\nคลิปที่ hint เหมือนเดิม → พรอมป์ทั้งก้อนต้องเหมือนเดิมทุกไบต์ (ไม่มีผลข้างเคียงอื่นในพรอมป์): %s" % ("PASS" if same_text else "FAIL"))
