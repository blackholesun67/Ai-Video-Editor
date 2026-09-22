import sys, os, json
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.abspath(".")
sys.path.insert(0, "eval/tools")
import score as S

gt = "eval/V07/ground_truth.txt"
paths = {
    "before (VAD-fix baseline)": "eval/vad-filter-fix/after/V07_full/preview.json",
    "control-old (rerun2, vad-fix-v1)": "eval/silence-gap/rerun/control-old/V07_full/preview.json",
    "control-old (this E2E run, vad-fix-v1)": "eval/snap-wordbound-fix/e2e/control-old/V07_full/preview.json",
    "new BEFORE fix (rerun2, Silence Gap Fix only, buggy)": "eval/silence-gap/rerun/after/V07_full/preview.json",
    "new AFTER fix (this E2E run, Silence Gap Fix + snap-wordbound fix)": "eval/snap-wordbound-fix/e2e/after/V07_full/preview.json",
}
for name, p in paths.items():
    if not os.path.exists(p):
        print(f"{name}: NOT FOUND ({p})")
        continue
    d = json.load(open(p, encoding="utf-8"))
    r = S.score(gt, p)
    all_cut = not d["selected_segments"]
    p_, rc = r["precision"], r["recall"]
    f1 = None if (p_ is None or rc is None or (p_+rc)==0) else round(2*p_*rc/(p_+rc), 4)
    def pct(x): return "N/A" if x is None else f"{100*x:.1f}%"
    print(f"{name}:")
    print(f"  cuts={r['cuts']}")
    print(f"  recall={pct(rc)} precision={pct(p_)} f1={pct(f1)} outside_gt={r['outside_gt_s']}s keep_violation={r['keep_violation_s']}s all_cut={all_cut}")
