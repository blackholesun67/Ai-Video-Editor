import sys as _sys; _sys.stdout.reconfigure(encoding="utf-8")  # คอนโซล Windows ไม่ใช่ UTF-8 โดยปริยาย
"""
Replay การตรวจ "ช่วงเงียบภายในท่อน" แบบออฟไลน์: โค้ดปัจจุบัน (tag vad-fix-v1) เทียบโค้ดใหม่ (working tree)

อินพุตจริง: transcript จาก eval/<clip>/preview*.json + VAD จริงจาก eval/vad-filter-fix/vad_segments.json
เฉลย (ground_truth.txt) ใช้ "เทียบผล" เท่านั้น — ไม่มีผลต่อการตัดสินใจใดในโค้ด
ไม่เรียก Gemini — ตรวจได้เฉพาะ hint ที่จะถูกส่งให้ Gemini ไม่ใช่ผลการตัด

รัน: python eval/tools/silence_replay.py   (จาก root ของโปรเจกต์)
"""
import contextlib, io, json, os, re, subprocess, sys, tempfile, types, importlib.util

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.chdir(ROOT)
OLD_REF = os.environ.get("OLD_REF", "vad-fix-v1")

# ── stub ไลบรารีหนัก + core.vad_logic (ใช้ get_silence_gaps "ตัวจริง" ดึงจากซอร์ส ไม่เขียนใหม่) ──
os.environ.setdefault("GEMINI_API_KEY", "x")
for name in ["google", "google.genai", "google.genai.errors", "google.genai.types", "faster_whisper", "dotenv", "core.visual_logic"]:
    sys.modules[name] = types.ModuleType(name)
sys.modules["google"].genai = sys.modules["google.genai"]; sys.modules["google.genai"].errors = sys.modules["google.genai.errors"]
sys.modules["google.genai"].types = sys.modules["google.genai.types"]
sys.modules["faster_whisper"].WhisperModel = object; sys.modules["faster_whisper"].BatchedInferencePipeline = object
sys.modules["dotenv"].load_dotenv = lambda *a, **k: None
sys.modules["core.visual_logic"].pick_keyframe_times = None; sys.modules["core.visual_logic"].extract_keyframes = None
vad_src = open("backend/core/vad_logic.py", encoding="utf-8").read()
fn = re.search(r"^def get_silence_gaps.*?(?=^def |\Z)", vad_src, re.S | re.M).group(0)
vad_stub = types.ModuleType("core.vad_logic"); exec(fn, vad_stub.__dict__)
sys.modules["core.vad_logic"] = vad_stub


def load(tag, source):
    path = os.path.join(tempfile.mkdtemp(), f"ai_logic_{tag}.py"); open(path, "w", encoding="utf-8").write(source)
    spec = importlib.util.spec_from_file_location(f"ai_logic_{tag}", path); mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(mod)
    return mod


old_src = subprocess.run(["git", "show", f"{OLD_REF}:backend/core/ai_logic.py"], capture_output=True, text=True, encoding="utf-8", check=True).stdout
OLD = load("old", old_src); NEW = load("new", open("backend/core/ai_logic.py", encoding="utf-8").read())

VAD = json.load(open("eval/vad-filter-fix/vad_segments.json", encoding="utf-8"))
PREV = {"V01": "eval/V01/preview_pre-baseline.json", "V02": "eval/V02/preview.json", "V03": "eval/V03/preview_summary-mode-run.json",
        "V04": "eval/V04/preview.json", "V05": "eval/V05/preview.json", "V06": "eval/V06/preview_full.json", "V07": "eval/V07/preview.json"}
LINE = re.compile(r"^\s*(\d+):(\d{1,2}(?:\.\d+)?)\s*-\s*(\d+):(\d{1,2}(?:\.\d+)?)\s*\|\s*([A-Za-z\-]+)\s*\|")


def gt(clip):
    p = f"eval/{clip}/ground_truth.txt"; out = {"cut": [], "keep": []}; sect = None
    if not os.path.exists(p): return out
    for line in open(p, encoding="utf-8"):
        if line.startswith("["): sect = line.split("]")[0][1:]; continue
        m = LINE.match(line)
        if m and sect in ("SHOULD_CUT", "SHOULD_KEEP"):
            out["cut" if sect == "SHOULD_CUT" else "keep"].append((int(m[1]) * 60 + float(m[2]), int(m[3]) * 60 + float(m[4])))
    return out


ov = lambda a, b: max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
fmt = lambda L: "[" + ", ".join("%.1f-%.1f(%.1f)" % (g["start"], g["end"], g["dur"]) for g in L) + "]"
results = {}; problems = []

print("โค้ดเดิม = %s · โค้ดใหม่ = working tree · SILENCE_HINT_MIN_GAP = %.1f\n" % (OLD_REF, NEW.SILENCE_HINT_MIN_GAP))
for clip, path in PREV.items():
    tr = json.load(open(path, encoding="utf-8"))["transcript"]; total = max(s["end"] for s in tr); voice = VAD[clip]["voice_segments"]
    old_gaps = OLD._long_silence_gaps(tr, total)
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        new_gaps = NEW._long_silence_gaps(tr, total, voice_segments=voice)
    same_without_vad = NEW._long_silence_gaps(tr, total) == old_gaps           # ไม่ส่ง VAD = พฤติกรรมเดิมเป๊ะ
    G = gt(clip); words = [(w["start"], w["end"]) for s in tr for w in s.get("words", [])]
    # guard ตรวจซ้ำแบบอิสระ — เฉพาะ "ส่วนที่โค้ดใหม่เพิ่ม" (ช่วงเงียบจาก VAD): ต้องไม่ทับเสียงพูดของ VAD และไม่ทับคำ Whisper
    with contextlib.redirect_stdout(io.StringIO()):
        vad_part, vad_ign, vad_raw_n = NEW._vad_silence_gaps(voice, tr, total, NEW.SILENCE_HINT_MIN_GAP)
    vad_overlap = sum(ov((g["start"], g["end"]), (v["start"], v["end"])) for g in vad_part for v in voice)
    word_overlap = sum(ov((g["start"], g["end"]), w) for g in vad_part for w in words)
    # ส่วนเดิม (ช่องว่างระหว่างท่อน — ไม่ได้แก้ในรอบนี้): รายงานแยก ไม่ใช่ความผิดของโค้ดใหม่
    legacy_vad_overlap = sum(ov((g["start"], g["end"]), (v["start"], v["end"])) for g in old_gaps for v in voice)
    new_only = [g for g in new_gaps if not any(ov((g["start"], g["end"]), (o["start"], o["end"])) > 0 for o in old_gaps)]
    keep_hit = sum(ov((g["start"], g["end"]), k) for g in new_gaps for k in G["keep"])
    cut_cov = [(a, b, round(sum(ov((g["start"], g["end"]), (a, b)) for g in new_gaps), 1)) for a, b in G["cut"]]
    results[clip] = {"old_usable": len(old_gaps), "new_usable": len(new_gaps), "old_gaps": old_gaps, "new_gaps": new_gaps, "new_only": new_only,
                     "no_vad_equals_old": same_without_vad, "overlap_vad_speech_s": round(vad_overlap, 2), "overlap_whisper_words_s": round(word_overlap, 2),
                     "gt_keep_overlap_s": round(keep_hit, 1), "vad_part": vad_part, "vad_ignored": vad_ign, "legacy_gaps_overlap_vad_speech_s": round(legacy_vad_overlap, 2), "gt_cut_coverage": cut_cov, "log": buf.getvalue().strip().splitlines()}
    print("=" * 100); print("%s | ท่อน %d | จบ %.1fs" % (clip, len(tr), total))
    print("  เดิม  usable=%d %s" % (len(old_gaps), fmt(old_gaps)))
    print("  ใหม่  usable=%d %s   (ช่วงที่เพิ่มใหม่ %d)" % (len(new_gaps), fmt(new_gaps), len(new_only)))
    for l in results[clip]["log"]: print("     ", l)
    print("  guard (ส่วนที่โค้ดใหม่เพิ่ม %d ช่วง): ทับเสียงพูดตาม VAD = %.2fs · ทับคำ Whisper = %.2fs · ไม่ส่ง VAD ⇒ เท่าเดิม = %s" % (len(vad_part), vad_overlap, word_overlap, same_without_vad))
    if legacy_vad_overlap > 0.001:
        print("  ข้อมูลเดิม (ไม่ได้แก้): ช่องว่างระหว่างท่อนแบบเดิมทับเสียงพูดตาม VAD %.2fs — VAD/Whisper ขัดกัน (Silero ไวต่อลม/noise)" % legacy_vad_overlap)
    if G["cut"] or G["keep"]:
        print("  เทียบเฉลย (เพื่อประเมินเท่านั้น): ครอบ SHOULD_CUT = %s · ทับ SHOULD_KEEP = %.1fs" % (cut_cov, keep_hit))
    if vad_overlap > 0.001 and clip != "": problems.append(f"{clip}: ช่วงเงียบจาก VAD ที่เพิ่มใหม่ทับเสียงพูดของ VAD {vad_overlap:.2f}s")
    if word_overlap > 0.001: problems.append(f"{clip}: ช่วงเงียบจาก VAD ที่เพิ่มใหม่ทับคำ Whisper {word_overlap:.2f}s")
    if not same_without_vad: problems.append(f"{clip}: ไม่ส่ง VAD แล้วผลไม่เท่าเดิม")

print("\n" + "=" * 100 + "\nกรณีขอบ (ข้อมูลสังเคราะห์ ตรวจพฤติกรรมของโค้ด ไม่ใช่คุณภาพ):")
ok = True
def case(name, cond):
    global ok; ok &= bool(cond); print("  %-72s %s" % (name, "PASS" if cond else "FAIL"))
def run(tr, voice, total=100.0):
    with contextlib.redirect_stdout(io.StringIO()):
        return NEW._long_silence_gaps(tr, total, voice_segments=voice)
seg = lambda a, b, words=None: {"start": a, "end": b, "text": "x", "words": words if words is not None else []}
w = lambda a, b: {"start": a, "end": b, "text": "ก"}
v = [{"start": 0.0, "end": 10.0}, {"start": 20.0, "end": 40.0}]                # VAD เงียบ 10-20 (10 วิ)
r = run([seg(0, 40, [w(1, 9), w(21, 39)])], v, 40.0)
case("ความเงียบกลางท่อนเดียว (10-20) ถูกตรวจพบและส่งต่อ", any(abs(g["start"] - 9.0) < .01 and abs(g["end"] - 20.0) < .01 for g in r) or any(g["start"] >= 9 and g["end"] <= 21 and g["dur"] >= 3 for g in r))
r = run([seg(0, 40, [w(1, 9), w(14, 15), w(21, 39)])], v, 40.0)
case("มีคำ Whisper อยู่กลางช่วงเงียบ (14-15) → ถูกหักออก ไม่ทับคำ", all(not (g["start"] < 15 and g["end"] > 14) for g in r))
r = run([seg(0, 40, [w(1, 9), w(11, 19), w(21, 39)])], v, 40.0)
case("คำ Whisper คลุมเกือบทั้งช่วงเงียบ → เหลือน้อยกว่าเกณฑ์ → ทิ้ง (IGNORE)", not any(g["start"] >= 9 and g["end"] <= 21 for g in r))
r = run([seg(0, 40, [w(1, 9), w(21, 39)])], [{"start": 0.0, "end": 12.0}, {"start": 14.5, "end": 40.0}], 40.0)
case("ช่วงเงียบ 2.5 วิ (ต่ำกว่าเกณฑ์ 3.0) → ไม่ถูกส่งต่อ", r == [])
r = run([seg(0, 40, [w(1, 9), w(21, 39)])], None, 40.0)
case("ไม่มีข้อมูล VAD → ทำงานเหมือนเดิม (ไม่มี gap ระหว่างท่อน)", r == [])
r = run([seg(0, 40), seg(40, 60)], v + [{"start": 40.0, "end": 60.0}], 60.0)
case("ท่อนที่ไม่มี words[] → ใช้ VAD อย่างเดียว ยังตรวจพบ", any(g["start"] == 10.0 and g["end"] == 20.0 for g in r))
r = run([seg(0, 30, [w(1, 9), w(21, 29)]), seg(40, 60, [w(41, 59)])], [{"start": 0.0, "end": 10.0}, {"start": 20.0, "end": 30.0}, {"start": 40.0, "end": 60.0}], 60.0)
case("ช่วงเงียบภายในท่อน + ช่องว่างระหว่างท่อน ทับกัน → รวมเป็นช่วงเดียว ไม่ซ้ำ", all(r[i]["end"] <= r[i + 1]["start"] for i in range(len(r) - 1)))
case("ผลเรียงตามเวลาและไม่ทับกันในทุกกรณีจริง", all(all(g[i]["end"] <= g[i + 1]["start"] + 0.06 for i in range(len(g) - 1)) for g in (x["new_gaps"] for x in results.values())))
sys.modules["core.vad_logic"] = None                                           # จำลอง import ล้ม
with contextlib.redirect_stdout(io.StringIO()) as _o:
    r = NEW._long_silence_gaps([seg(0, 40, [w(1, 9)]), seg(50, 60)], 60.0, voice_segments=v)
case("import vad_logic ล้ม → ไม่พัง และใช้เฉพาะช่องว่างระหว่างท่อนต่อ (10 วิ)", any(abs(g["start"] - 40.0) < .01 and abs(g["end"] - 50.0) < .01 for g in r) and "ใช้ข้อมูล VAD ไม่ได้" in _o.getvalue())
sys.modules["core.vad_logic"] = vad_stub
print("  กรณีขอบทั้งหมด:", "PASS" if ok else "FAIL")
print("\nปัญหาที่พบจาก guard/regression:", problems if problems else "ไม่พบ")
json.dump({"old_ref": OLD_REF, "min_gap": NEW.SILENCE_HINT_MIN_GAP, "clips": results, "edge_cases_pass": ok, "problems": problems},
          open("eval/silence-gap/replay_gaps.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
