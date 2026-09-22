import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")
"""
Regression ของ snap-wordbound fix บน V02 full / V06 full (new+control) / V06 summary control
— replay "AI Suggested Cuts" ที่บันทึกไว้แล้วจริง (parse ไว้ล่วงหน้าใน regression_cases.json โดย
eval/tools/_parse_regression_cases.py) ผ่าน pipeline เดียวกับ ai_logic.py บรรทัด 2634-2690
(Step5 snap -> invert -> merge -> protect_outro -> snap_segments_to_sentences -> retake ->
finish_last_sentence) ด้วยโค้ด BUGGY (Silence Gap Fix อย่างเดียว) กับ FIXED (+ snap-wordbound fix)
เทียบกับ "Final keep segments" ที่บันทึกไว้จริง (ผลจริงที่เคยรันจากโค้ด buggy)

ไม่เรียก Gemini ใหม่ — ทุกอย่างมาจากไฟล์ที่มีอยู่แล้ว

รัน: docker compose exec -T worker python /tmp/snap_fix_regression.py
"""
import contextlib, importlib.util, io, json, os, sys

for p in (os.getcwd(), "/app"):
    if p not in sys.path:
        sys.path.insert(0, p)

TMP = os.environ.get("HARNESS_TMP", "/tmp")


def quiet_import(tag, path):
    spec = importlib.util.spec_from_file_location(f"core.ai_logic_{tag}", path)
    mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(mod)
    return mod


BUGGY = quiet_import("buggy2", f"{TMP}/ai_logic_silencegap.py")
FIXED = quiet_import("fixed2", f"{TMP}/ai_logic_new.py")

PREVIEW_FOR = {
    "V02 full (new, Silence Gap Fix)": f"{TMP}/V02_preview.json",
    "V06 full (new, Silence Gap Fix)": f"{TMP}/V06_full_preview.json",
    "V06 full (control-old, ก่อน Silence Gap Fix)": f"{TMP}/V06_full_preview.json",
    "V06 summary (control-old rerun, ก่อน Silence Gap Fix)": f"{TMP}/V06_summary_preview.json",
}

VAD = json.load(open(f"{TMP}/vad_segments.json", encoding="utf-8"))
CASES = json.load(open(f"{TMP}/regression_cases.json", encoding="utf-8"))


def run_pipeline(mod, cuts, transcript, dur, voice, use_vad):
    with contextlib.redirect_stdout(io.StringIO()):
        snapped_deletes = []
        for c in cuts:
            s0, e0 = float(c["start"]), float(c["end"])
            if e0 <= s0 + 5.0:      # Step 5 จริง (ai_logic.py:2638) — ไม่ตัดถ้าสั้นกว่า 5 วินาที
                continue
            s1 = mod.snap_to_sentence_boundary(s0, transcript)
            e1 = mod.snap_to_sentence_boundary(e0, transcript)
            if e1 - s1 < 2.0:
                s1, e1 = s0, e0
            snapped_deletes.append({"start": s1, "end": e1})
        keep = mod.invert_segments(snapped_deletes, dur)
        keep = mod.merge_close_segments(keep, gap_threshold=2.0)
        keep = mod._protect_outro(keep, transcript, dur, voice)
        if use_vad:
            keep = mod._snap_segments_to_sentences(keep, transcript, dur, voice)
        else:
            keep = mod._snap_segments_to_sentences(keep, transcript, dur)
        retake_cuts = mod._find_retake_cuts(transcript)
        if retake_cuts:
            keep = mod._subtract_spans(keep, retake_cuts)
        keep = mod._finish_last_sentence(keep, transcript, dur)
    return [[round(float(k["start"]), 2), round(float(k["end"]), 2)] for k in keep]


PASS = FAIL = 0
for case in CASES:
    label, clip, cuts, recorded_final = case["label"], case["clip"], case["cuts"], case["recorded_final"]
    print("=" * 100)
    print(label)
    base = json.load(open(PREVIEW_FOR[label], encoding="utf-8"))
    transcript = base["transcript"]
    dur = transcript[-1]["end"]
    voice = VAD[clip]["voice_segments"]

    print(f"  AI Suggested Cuts (จากไฟล์ที่บันทึกไว้, {len(cuts)}): {cuts}")
    print(f"  Final keep segments ที่บันทึกไว้จริง (จากโค้ด buggy ตอนรัน): {recorded_final}")

    buggy_replay = run_pipeline(BUGGY, cuts, transcript, dur, voice, use_vad=False)
    fixed_replay_novad = run_pipeline(FIXED, cuts, transcript, dur, voice, use_vad=False)
    fixed_replay_vad = run_pipeline(FIXED, cuts, transcript, dur, voice, use_vad=True)

    print(f"  BUGGY replay                : {buggy_replay}")
    print(f"  FIXED replay (ไม่ส่ง VAD)     : {fixed_replay_novad}")
    print(f"  FIXED replay (ส่ง VAD, จริง)  : {fixed_replay_vad}")

    ok0 = buggy_replay == recorded_final
    print(f"  [{'PASS' if ok0 else 'WARN'}] BUGGY replay ตรงกับที่บันทึกไว้จริง (ยืนยันว่า replay harness ถูกต้อง)")
    ok1 = fixed_replay_novad == buggy_replay
    print(f"  [{'PASS' if ok1 else 'FAIL'}] FIXED ไม่ส่ง voice_segments ต้องเหมือน BUGGY เป๊ะ (backward compatible)")
    ok2 = fixed_replay_vad == recorded_final
    print(f"  [{'PASS' if ok2 else 'DIFFERENT'}] FIXED(+VAD) เทียบกับที่บันทึกไว้จริง — เคสนี้ไม่มี silence-boundary ที่เกี่ยวข้อง จึง **ควรเหมือนเดิม**")
    PASS += ok1 and ok2
    FAIL += not (ok1 and ok2)

print("\n" + "=" * 100)
print(f"สรุป regression (ไม่ควรมีอะไรเปลี่ยนในเคสเหล่านี้): เหมือนเดิม={PASS}  ต่างจากเดิม={FAIL}")
sys.exit(1 if FAIL else 0)
