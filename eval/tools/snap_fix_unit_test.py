import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")
"""
Unit + synthetic regression test ของ snap-wordbound-gap fix — เทียบ 2 เวอร์ชันของโค้ด:
  BUGGY = Silence Gap Fix เท่านั้น (ก่อนรอบนี้)   /tmp/ai_logic_silencegap.py
  FIXED = Silence Gap Fix + snap-wordbound fix    /tmp/ai_logic_new.py
ไม่เรียก Gemini ใหม่ — ใช้ cuts จริงจาก harness.log ของ rerun2/after/V07_full (บันทึกไว้แล้ว)
และ transcript จริงจาก eval/V07/preview.json (ผ่าน /tmp/V07_preview.json ที่ copy ไว้แล้ว)

รัน: docker compose exec -T worker python /tmp/snap_fix_unit_test.py
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


BUGGY = quiet_import("buggy", f"{TMP}/ai_logic_silencegap.py")
FIXED = quiet_import("fixed", f"{TMP}/ai_logic_new.py")

base = json.load(open(f"{TMP}/V07_preview.json", encoding="utf-8"))
transcript = base["transcript"]
total_duration = transcript[-1]["end"]
voice_segments = json.load(open(f"{TMP}/vad_segments.json", encoding="utf-8"))["V07"]["voice_segments"]

RESULTS = {"pass": 0, "fail": 0}


def check(label, cond, detail=""):
    tag = "PASS" if cond else "FAIL"
    RESULTS["pass" if cond else "fail"] += 1
    print(f"  [{tag}] {label}  {detail}")
    return cond


def run_full_pipeline(mod, cuts, tr_list, dur, voice, with_voice_segments):
    """จำลอง pipeline จริงตั้งแต่ Step5 snap ถึง _snap_segments_to_sentences"""
    tr_sorted = sorted((t for t in tr_list if t.get("start") is not None and t.get("end") is not None),
                        key=lambda t: t["start"])
    snapped_deletes = []
    for c in cuts:
        s0, e0 = float(c["start"]), float(c["end"])
        s1 = mod.snap_to_sentence_boundary(s0, tr_list)
        e1 = mod.snap_to_sentence_boundary(e0, tr_list)
        if e1 - s1 < 2.0:
            s1, e1 = s0, e0
        snapped_deletes.append({"start": s1, "end": e1})
    keep = mod.invert_segments(snapped_deletes, dur)
    keep = mod.merge_close_segments(keep, gap_threshold=2.0)
    with contextlib.redirect_stdout(io.StringIO()):
        if with_voice_segments:
            final = mod._snap_segments_to_sentences(keep, tr_list, dur, voice)
        else:
            final = mod._snap_segments_to_sentences(keep, tr_list, dur)
    return final


print("=" * 100)
print("1) V07 REAL CASE — 3 ช่วงเงียบที่ Gemini เสนอตัดจริง (16.83-31.49, 37.12-49.20, 62.97-82.63)")
print("=" * 100)
gemini_cuts = [
    {"start": 16.83, "end": 31.49}, {"start": 37.12, "end": 49.2}, {"start": 62.97, "end": 82.63},
]
buggy_result = run_full_pipeline(BUGGY, gemini_cuts, transcript, total_duration, voice_segments, with_voice_segments=False)
fixed_no_vad = run_full_pipeline(FIXED, gemini_cuts, transcript, total_duration, voice_segments, with_voice_segments=False)
fixed_with_vad = run_full_pipeline(FIXED, gemini_cuts, transcript, total_duration, voice_segments, with_voice_segments=True)

print(f"BUGGY (Silence Gap Fix only)                         : {buggy_result}")
print(f"FIXED, ไม่ส่ง voice_segments (คาดว่า = BUGGY เป๊ะ)     : {fixed_no_vad}")
print(f"FIXED, ส่ง voice_segments (โค้ดจริงที่จะใช้งาน)        : {fixed_with_vad}")
print()

check("BUGGY ยุบเป็น keep-all 1 ช่วง (ยืนยันซ้ำว่าบั๊กจริง ก่อนแก้)",
      len(buggy_result) == 1 and abs(buggy_result[0]["start"]) < 0.01 and abs(buggy_result[0]["end"] - total_duration) < 0.01)
check("FIXED ไม่ส่ง voice_segments ต้องเหมือน BUGGY เป๊ะ (backward compatible, ไม่ส่ง = พฤติกรรมเดิม)",
      fixed_no_vad == buggy_result, f"fixed_no_vad={fixed_no_vad}")
check("FIXED ส่ง voice_segments ต้องไม่ยุบเป็น keep-all อีกต่อไป",
      not (len(fixed_with_vad) == 1 and fixed_with_vad[0]["end"] - fixed_with_vad[0]["start"] > total_duration - 1))
check("FIXED ส่ง voice_segments ต้องได้ keep-segments >= 4 ช่วง (ตรงกับ invert ของ 3 cuts)",
      len(fixed_with_vad) >= 4, f"n={len(fixed_with_vad)}")
gt_expect = [(0.0, 16.83), (31.49, 37.12), (49.2, 62.97), (82.63, 94.87)]
close = len(fixed_with_vad) == 4 and all(
    abs(a["start"] - e[0]) < 0.5 and abs(a["end"] - e[1]) < 0.5 for a, e in zip(fixed_with_vad, gt_expect))
check("FIXED ส่ง voice_segments ต้องใกล้เคียงขอบที่ Gemini เสนอจริง (คลาดไม่เกิน 0.5s/ขอบ)",
      close, f"got={fixed_with_vad}")

print("\n" + "=" * 100)
print("2) SYNTHETIC B1-B4 (ไม่เรียก Gemini, เทียบ BUGGY vs FIXED with voice_segments)")
print("=" * 100)


def compare_case(label, cuts, expect_fn):
    print(f"\n--- {label} ---")
    b = run_full_pipeline(BUGGY, cuts, transcript, total_duration, voice_segments, with_voice_segments=False)
    f_no = run_full_pipeline(FIXED, cuts, transcript, total_duration, voice_segments, with_voice_segments=False)
    f_vad = run_full_pipeline(FIXED, cuts, transcript, total_duration, voice_segments, with_voice_segments=True)
    print(f"  BUGGY          : {b}")
    print(f"  FIXED (no VAD) : {f_no}")
    print(f"  FIXED (+VAD)   : {f_vad}")
    check(f"{label}: FIXED(no VAD) == BUGGY (ไม่ส่ง voice_segments ต้องเหมือนเดิมเป๊ะ)", f_no == b)
    expect_fn(b, f_vad)


def b1_expect(b, f):
    check("B1: BUGGY ต้องยุบเป็น keep-all (ยืนยันสภาพก่อนแก้)", len(b) == 1)
    check("B1: FIXED(+VAD) ต้องไม่ยุบเป็น keep-all (เกณฑ์ที่ผู้ใช้กำหนด)", not (len(f) == 1 and f[0]["end"] - f[0]["start"] > total_duration - 1))


def b2_expect(b, f):
    check("B2: FIXED(+VAD) ต้องทำงานเหมือนเดิม (ไม่มี silence gap ในเคสนี้ ไม่ควรมีอะไรเปลี่ยน)", f == b, f"buggy={b} fixed={f}")


def b3_expect(b, f):
    check("B3: FIXED(+VAD) ต้องทำงานเหมือนเดิม (cut ตรงช่องว่างระหว่างท่อนจริง ไม่ใช่เงียบในท่อนเดียว)", f == b, f"buggy={b} fixed={f}")


def b4_expect(b, f):
    check("B4: BUGGY ต้องยุบเป็น keep-all (ยืนยันสภาพก่อนแก้)", len(b) == 1)
    check("B4: FIXED(+VAD) ต้องไม่เกิด chain-merge เป็น keep-all", not (len(f) == 1 and f[0]["end"] - f[0]["start"] > total_duration - 1))


compare_case("B1: ตัดช่วงเงียบเดี่ยว ๆ", [{"start": 16.83, "end": 31.49}], b1_expect)
compare_case("B2: cut ใกล้ขอบ segment (< SNAP_MAX_SENTENCE=6.0s, ไม่ใช่ silence gap)",
             [{"start": 2.0, "end": 8.0}], b2_expect)
compare_case("B3: cut ตรงช่องว่างระหว่าง 2 ท่อนจริง (52.58-55.15)",
             [{"start": 52.58, "end": 55.15}], b3_expect)
compare_case("B4: 2 cuts ในท่อนเดียวกัน (gap1+gap2, ไม่รวม gap3)",
             [{"start": 16.83, "end": 31.49}, {"start": 37.12, "end": 49.2}], b4_expect)

print("\n" + "=" * 100)
print(f"สรุป: PASS={RESULTS['pass']} FAIL={RESULTS['fail']}")
print("=" * 100)
sys.exit(1 if RESULTS["fail"] else 0)
