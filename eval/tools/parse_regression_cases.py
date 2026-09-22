import json, re, sys
sys.stdout.reconfigure(encoding="utf-8")

CUT_RE = re.compile(r"[\U0001F534\U0001F7E1\U0001F7E2⚪]\s*\[\w+\]\s*([\d.]+)s\s*→\s*([\d.]+)s")
FINAL_RE = re.compile(r"^\s*([\d.]+)s\s*→\s*([\d.]+)s\s*\(", re.M)

CASES = [
    ("V02 full (new, Silence Gap Fix)", "eval/silence-gap/after/V02_full/harness.log", "V02"),
    ("V06 full (new, Silence Gap Fix)", "eval/silence-gap/after/V06_full/harness.log", "V06"),
    ("V06 full (control-old, ก่อน Silence Gap Fix)", "eval/silence-gap/control-old/V06_full/harness.log", "V06"),
    ("V06 summary (control-old rerun, ก่อน Silence Gap Fix)", "eval/silence-gap/rerun/control-old/V06_summary/harness.log", "V06"),
]

out = []
for label, path, clip in CASES:
    text = open(path, encoding="utf-8").read()
    m = re.search(r"AI Suggested Cuts.*?(?=\n\n|\Z)", text, re.S)
    block = m.group(0) if m else text
    cuts = [{"start": float(a), "end": float(b)} for a, b in CUT_RE.findall(block)]
    m2 = re.search(r"Final keep segments.*?(?=\n\n|\Z)", text, re.S)
    fblock = m2.group(0) if m2 else ""
    final = [[round(float(a), 2), round(float(b), 2)] for a, b in FINAL_RE.findall(fblock)]
    print(label, "cuts=", cuts, "final=", final)
    out.append({"label": label, "clip": clip, "cuts": cuts, "recorded_final": final})

json.dump(out, open("eval/snap-wordbound-fix/regression_cases.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
