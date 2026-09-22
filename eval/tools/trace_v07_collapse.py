import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")
"""
สืบว่าทำไม V07_full (new) Gemini เสนอตัด 3 ช่วงเงียบ (รวม 46.4s) แล้วผลสุดท้ายกลับเป็น
"เก็บทั้งคลิป" (1 segment เต็ม 0-94.87) — ใช้ฟังก์ชันจริงจาก /tmp/ai_logic_new.py ทีละขั้น
ตาม pipeline จริง (บรรทัด 2634-2698) กับ transcript จริงของ V07 ไม่คาดเดา ไม่แก้โค้ด

รัน: docker compose exec -T worker python /tmp/trace_v07_collapse.py
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


mod = quiet_import("trace", f"{TMP}/ai_logic_new.py")

base = json.load(open(f"{TMP}/V07_preview.json", encoding="utf-8"))
transcript = base["transcript"]
total_duration = transcript[-1]["end"]
print(f"transcript segments: {len(transcript)}")
for t in transcript:
    print(f"  seg start={t['start']} end={t['end']}")
print(f"total_duration = {total_duration}\n")

# 3 ช่วงที่ Gemini เสนอตัดจริง (จาก harness.log ของ after/V07_full)
segments_to_delete = [
    {"start": 16.83, "end": 31.49, "reason": "silence1"},
    {"start": 37.12, "end": 49.2, "reason": "silence2"},
    {"start": 62.97, "end": 82.63, "reason": "silence3"},
]

print("── Step 5: snap_to_sentence_boundary ทีละคู่ ──")
snapped_deletes = []
for seg in segments_to_delete:
    start, end = float(seg["start"]), float(seg["end"])
    snapped_start = mod.snap_to_sentence_boundary(start, transcript)
    snapped_end = mod.snap_to_sentence_boundary(end, transcript)
    collapsed = snapped_end - snapped_start < 2.0
    if collapsed:
        snapped_start, snapped_end = start, end
    print(f"  {start} → {end}  ::  snap({start})={snapped_start}  snap({end})={snapped_end}"
          f"  collapsed_fallback={collapsed}  => [{snapped_start}, {snapped_end}]")
    snapped_deletes.append({"start": snapped_start, "end": snapped_end})

keep_segments = mod.invert_segments(
    [{"start": s["start"], "end": s["end"]} for s in snapped_deletes], total_duration)
print(f"\nหลัง invert (ช่วงที่เก็บ): {keep_segments}")

keep_gap = 2.0
final_segments = mod.merge_close_segments(keep_segments, gap_threshold=keep_gap)
print(f"หลัง merge_close_segments(gap={keep_gap}): {final_segments}")

voice_segments = json.load(open(f"{TMP}/vad_segments.json", encoding="utf-8"))["V07"]["voice_segments"]
final_segments = mod._protect_outro(final_segments, transcript, total_duration, voice_segments)
print(f"หลัง _protect_outro: {final_segments}")

before_snap = final_segments
final_segments = mod._snap_segments_to_sentences(final_segments, transcript, total_duration)
print(f"หลัง _snap_segments_to_sentences: {final_segments}")
if before_snap != final_segments:
    for a, b in zip(before_snap, final_segments if len(final_segments) == len(before_snap) else []):
        print(f"    {a} -> {b}")

retake_cuts = mod._find_retake_cuts(transcript)
print(f"\nretake_cuts พบ: {retake_cuts}")
if retake_cuts:
    final_segments = mod._subtract_spans(final_segments, retake_cuts)
    print(f"หลัง _subtract_spans(retake): {final_segments}")

final_segments = mod._finish_last_sentence(final_segments, transcript, total_duration)
print(f"\n=== สุดท้าย: {final_segments}")

print("\n── ลงลึก _snap_bounds ทีละ segment ──")
tr_sorted = sorted((t for t in transcript if t.get("start") is not None and t.get("end") is not None), key=lambda t: t["start"])
for seg in [{'start': 0.0, 'end': 16.83}, {'start': 31.49, 'end': 37.12}, {'start': 49.2, 'end': 62.97}, {'start': 82.63, 'end': 94.87}]:
    s, e = mod._snap_bounds(float(seg["start"]), float(seg["end"]), tr_sorted, total_duration)
    print(f"  {seg} -> _snap_bounds -> start={s} end={e}")

print(f"\nSNAP_MAX_EXTEND={mod.SNAP_MAX_EXTEND} SNAP_MAX_SENTENCE={mod.SNAP_MAX_SENTENCE} SNAP_MAX_THOUGHT={mod.SNAP_MAX_THOUGHT} SENTENCE_PAUSE={mod.SENTENCE_PAUSE} THOUGHT_GRACE={mod.THOUGHT_GRACE}")
print("segment0 text tail:", repr(transcript[0]["text"][-60:]))
print("segment1 text tail:", repr(transcript[1]["text"][-60:]))
print("_ends_incomplete(seg0.text)=", mod._ends_incomplete(transcript[0]["text"]))
print("_ends_incomplete(seg1.text)=", mod._ends_incomplete(transcript[1]["text"]))
