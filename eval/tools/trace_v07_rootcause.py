import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")
"""
Root-cause trace ของบั๊ก "Gemini เสนอตัดช่วงเงียบ แต่ผลสุดท้ายกลืนกลับเป็น keep-all" (V07 full)

ทำ 2 ส่วน โดยใช้ฟังก์ชันจริงจาก /tmp/ai_logic_new.py เท่านั้น (ไม่แก้โค้ด ไม่เรียก Gemini ใหม่):
  A. Replay ทีละขั้นด้วยข้อมูลจริงของ V07 (Gemini cuts จริงจาก harness.log ของ rerun2)
  B. Synthetic edge cases ตรวจผลกระทบกว้างกว่า V07 (ไม่ต้องมี Gemini, transcript สมมติ + เคสจริงบางส่วน)

รัน: docker compose exec -T worker python /tmp/trace_v07_rootcause.py
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


mod = quiet_import("rc", f"{TMP}/ai_logic_new.py")

base = json.load(open(f"{TMP}/V07_preview.json", encoding="utf-8"))
transcript = base["transcript"]
total_duration = transcript[-1]["end"]
tr_sorted = sorted((t for t in transcript if t.get("start") is not None and t.get("end") is not None), key=lambda t: t["start"])

print("=" * 100)
print("A. REPLAY จริงของ V07 (Gemini cuts จาก harness.log ของ rerun2/after/V07_full)")
print("=" * 100)
print(f"transcript: {len(transcript)} segments, total_duration={total_duration}")
for t in transcript:
    print(f"  segment start={t['start']} end={t['end']}  n_words={len(t.get('words') or [])}")

gemini_cuts = [
    {"start": 16.83, "end": 31.49, "reason": "silence1"},
    {"start": 37.12, "end": 49.2, "reason": "silence2"},
    {"start": 62.97, "end": 82.63, "reason": "silence3"},
]

print("\n── ขั้น 1: Step 5 — snap_to_sentence_boundary ทีละจุด (ก่อน invert) ──")
snapped_deletes = []
for c in gemini_cuts:
    s0, e0 = c["start"], c["end"]
    s1 = mod.snap_to_sentence_boundary(s0, transcript)
    e1 = mod.snap_to_sentence_boundary(e0, transcript)
    collapsed = e1 - s1 < 2.0
    if collapsed:
        s1, e1 = s0, e0
    print(f"  Gemini proposed: {s0} -> {e0}   |   หลัง snap_to_sentence_boundary: {s1} -> {e1}  (collapsed_fallback={collapsed})")
    snapped_deletes.append({"start": s1, "end": e1})

print("\n── ขั้น 2: invert_segments (แปลง 'ช่วงลบ' -> 'ช่วงเก็บ') ──")
keep0 = mod.invert_segments(snapped_deletes, total_duration)
for k in keep0:
    print(f"  keep: {k['start']} -> {k['end']}  ({k['end']-k['start']:.2f}s)")

print("\n── ขั้น 3: merge_close_segments(gap=2.0) ──")
keep1 = mod.merge_close_segments(keep0, gap_threshold=2.0)
for k in keep1:
    print(f"  keep: {k['start']} -> {k['end']}  ({k['end']-k['start']:.2f}s)")

print("\n── ขั้น 4: _snap_bounds ทีละ keep-segment (เจาะลึก _word_bound) ──")
for k in keep1:
    s0, e0 = float(k["start"]), float(k["end"])
    s1, e1 = mod._snap_bounds(s0, e0, tr_sorted, total_duration)
    print(f"  ก่อน: {s0} -> {e0}   |   หลัง _snap_bounds: {s1} -> {e1}   (ขยับ front +{s0-s1:.2f}s, ขยับ back +{e1-e0:.2f}s)")

print("\n── ขั้น 5: _snap_segments_to_sentences (ครบ pipeline: snap ทุกช่วง + merge(gap=0.0)) ──")
final = mod._snap_segments_to_sentences(keep1, transcript, total_duration)
for k in final:
    print(f"  FINAL: {k['start']} -> {k['end']}  ({k['end']-k['start']:.2f}s)")

print("\n── รายละเอียด _word_bound ที่ถูกเรียกจริงสำหรับช่วงที่ 2 (31.49 -> 37.12) ──")
seg0 = transcript[0]
words = seg0.get("words") or []
wb_start = mod._word_bound(seg0, 31.49, before=True)
wb_end = mod._word_bound(seg0, 37.12, before=False)
print(f"  _word_bound(segment0, pos=31.49, before=True)  = {wb_start}")
print(f"  _word_bound(segment0, pos=37.12, before=False) = {wb_end}")
near_start = sorted([w for w in words if w.get("start") is not None and float(w["start"]) <= 31.49], key=lambda w: -w["start"])[:3]
near_end = sorted([w for w in words if w.get("end") is not None and float(w["end"]) >= 37.12], key=lambda w: w["end"])[:3]
print(f"  คำ 3 คำสุดท้ายก่อน pos=31.49 (candidates ของ before=True): {[(w['start'], w.get('word') or w.get('text')) for w in near_start]}")
print(f"  คำ 3 คำแรกหลัง pos=37.12 (candidates ของ before=False): {[(w['end'], w.get('word') or w.get('text')) for w in near_end]}")

print("\n" + "=" * 100)
print("B. SYNTHETIC EDGE CASES (ไม่เรียก Gemini, ไม่แก้โค้ด)")
print("=" * 100)


def run_pipeline(label, cuts, tr, dur):
    print(f"\n--- {label} ---")
    k0 = mod.invert_segments(cuts, dur)
    print(f"  หลัง invert: {k0}")
    k1 = mod.merge_close_segments(k0, gap_threshold=2.0)
    k2 = mod._snap_segments_to_sentences(k1, tr, dur)
    print(f"  FINAL: {k2}")
    return k2


# B1: cut เดี่ยว (isolated) — เอาแค่ gap แรกของ V07 คนเดียว ไม่มี cut ข้างเคียง
run_pipeline("B1: ตัดช่วงเงียบเดี่ยว ๆ (ไม่มี cut ข้างเคียงให้ merge เข้าไป)",
             [{"start": 16.83, "end": 31.49}], transcript, total_duration)

# B2: cut ที่ระยะห่างจากขอบ segment สั้นกว่า SNAP_MAX_SENTENCE (6.0s) — ควรไม่โดนบั๊ก
short_cut_start = 2.0   # ห่างจาก segment0 start(0.0) แค่ 2s < SNAP_MAX_SENTENCE
short_cut_end = 8.0
run_pipeline(f"B2: cut ใกล้ขอบ segment (ระยะ < SNAP_MAX_SENTENCE={mod.SNAP_MAX_SENTENCE}) — คาดว่าไม่พัง",
             [{"start": short_cut_start, "end": short_cut_end}], transcript, total_duration)

# B3: cut ที่ตรงกับขอบ segment เป๊ะ (ระหว่าง 2 segment จริง ไม่ใช่ภายใน segment เดียว)
between_start = 52.58   # ท้าย segment0 พอดี
between_end = 55.15     # ต้น segment1 พอดี
run_pipeline("B3: cut ที่ตรงกับ 'ช่องว่างระหว่างท่อน' จริง (ไม่ใช่เงียบภายในท่อนเดียว)",
             [{"start": between_start, "end": between_end}], transcript, total_duration)

# B4: 2 cuts ที่อยู่ใกล้กันในท่อนเดียวกัน (เหมือน V07 cut1+cut2) แต่ตัดแค่ 2 ไม่ใช่ 3 — ยังพังไหม
run_pipeline("B4: 2 cuts ในท่อนเดียวกัน (เหมือนสถานการณ์จริงแต่ตัดออก 1 คู่) — เช็คว่าต้อง >=2 คู่ติดกันไหมถึงพัง",
             [{"start": 16.83, "end": 31.49}, {"start": 37.12, "end": 49.2}], transcript, total_duration)

print("\n" + "=" * 100)
print("SNAP_MAX_EXTEND=%s SNAP_MAX_SENTENCE=%s SENTENCE_PAUSE=%s" % (mod.SNAP_MAX_EXTEND, mod.SNAP_MAX_SENTENCE, mod.SENTENCE_PAUSE))
