r"""
Objective 1 — Accuracy / Specificity จากข้อมูลเดิม (ไม่เรียก Gemini)

หน่วย = "วินาที" เหมือน score.py เดิม ; universe = [0, transcript_end] ของแต่ละรัน
  ช่วงที่ระบบตัด (C)  = ช่องว่างระหว่าง selected_segments (นิยามเดียวกับ score.py ทุกประการ)
  ช่วงที่ควรตัด (P)   = SHOULD_CUT ใน ground_truth.txt (union ไม่นับซ้ำ)
  TP = |C ∩ P| · FP = |C| - TP · FN = |P| - TP · TN = |U| - |C ∪ P|
  Accuracy = (TP+TN)/|U| · Specificity = TN/(TN+FP)

P มี 2 แบบ (ต่างกันเฉพาะโหมด full ที่เฉลยมี TANGENT = V03_full, V06_full):
  ALL     = SHOULD_CUT ทุกประเภท       (ตรงกับนิยาม precision เดิม)
  ALLOWED = เฉพาะประเภทที่โหมดนั้นอนุญาต (ตรงกับนิยาม recall เดิม) ; ประเภทที่ไม่อนุญาต
            (TANGENT ในโหมด full) ถือเป็น "ควรเก็บ" ตามสเปกของโหมด full (CLAUDE.md §6)

ตรวจความสอดคล้อง: recall(ALLOWED) ต้องเท่า score()['recall'], precision(ALL) ต้องเท่า score()['precision']
ทุกรัน — ถ้าไม่เท่า สคริปต์พิมพ์ MISMATCH
"""
import sys, os, json, glob, statistics as st
sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
sys.path.insert(0, REPO + "/eval/tools")
os.chdir(REPO)
import score as S   # parse_gt, ov, ALLOWED, score  (ใช้ของเดิม ไม่ก็อบปี้)

OBJ1 = REPO + "/eval/final-evaluation/objective1"
GT = {"V02_full": "V02", "V03_full": "V03", "V03_summary": "V03", "V04_full": "V04", "V05_full": "V05",
      "V06_full": "V06", "V06_summary": "V06", "V07_full": "V07"}
SIX = ["V02_full", "V03_summary", "V04_full", "V06_full", "V06_summary", "V07_full"]  # 6 case ที่ recall นิยามได้


def merge(iv):
    out = []
    for a, b in sorted(x for x in iv if x[1] > x[0]):
        if out and a <= out[-1][1] + 1e-9: out[-1][1] = max(out[-1][1], b)
        else: out.append([a, b])
    return [tuple(x) for x in out]

def length(iv): return sum(b - a for a, b in iv)

def inter(A, B):
    t = 0.0
    for a in A:
        for b in B:
            t += max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    return t

def run_cuts(d):
    end = d["transcript"][-1]["end"]
    sel = sorted((s["start"], s["end"]) for s in d["selected_segments"])
    cuts, prev = [], 0.0
    for s, e in sel:
        if s > prev + 0.01: cuts.append((prev, min(s, end)))
        prev = max(prev, e)
    tail = max(0.0, end - prev)   # ช่วงท้ายที่ score.py ไม่นับเป็น "ตัด" (ตรวจว่ามีผลไหม)
    return end, merge([(a, b) for a, b in cuts if b > a]), tail

def confusion(U, C, P):
    tp = inter(C, P); c = length(C); p = length(P)
    fp, fn = c - tp, p - tp
    tn = U - (c + p - tp)
    return dict(TP=tp, FP=fp, FN=fn, TN=tn, U=U, P=p, C=c,
                acc=(tp + tn) / U, spec=(tn / (tn + fp)) if (tn + fp) > 0 else None,
                rec=(tp / p) if p else None, prec=(tp / c) if c else None,
                base_acc=1 - p / U)   # ตัวเทียบ: ระบบ "ไม่ตัดอะไรเลย"

rows = []
mismatch = 0; max_tail = 0.0
for pj in sorted(glob.glob(OBJ1 + "/rep*/*/*/preview.json")):
    pj = pj.replace("\\", "/")
    parts = pj.split("/"); case, tag, rep = parts[-2], parts[-3], parts[-4]
    if case not in GT: continue          # V01: ไม่มีเฉลย
    gt_path = f"eval/{GT[case]}/ground_truth.txt"
    d = json.load(open(pj, encoding="utf-8"))
    mode = d.get("edit_mode", "full")
    U, C, tail = run_cuts(d); max_tail = max(max_tail, tail)
    gcut, gkeep = S.parse_gt(gt_path)
    P_all = merge([(max(0, a), min(b, U)) for a, b, t in gcut])
    P_alw = merge([(max(0, a), min(b, U)) for a, b, t in gcut if t in S.ALLOWED.get(mode, S.ALLOWED["full"])])
    cm_all, cm_alw = confusion(U, C, P_all), confusion(U, C, P_alw)
    ref = S.score(gt_path, pj)
    # ตรวจกับ score() เดิม
    ok_r = (ref["recall"] is None and cm_alw["rec"] is None) or (ref["recall"] is not None and cm_alw["rec"] is not None and abs(ref["recall"] - cm_alw["rec"]) < 5e-4)
    ok_p = (ref["precision"] is None and cm_all["prec"] is None) or (ref["precision"] is not None and cm_all["prec"] is not None and abs(ref["precision"] - cm_all["prec"]) < 5e-4)
    ok_c = abs(ref["cut_s"] - cm_all["C"]) < 0.06
    if not (ok_r and ok_p and ok_c):
        mismatch += 1
        print("MISMATCH", rep, tag, case, "recall", ref["recall"], cm_alw["rec"], "prec", ref["precision"], cm_all["prec"], "cut", ref["cut_s"], cm_all["C"])
    rows.append(dict(case=case, rep=rep, tag=tag, mode=mode, ALL=cm_all, ALLOWED=cm_alw, ref=ref))

print(f"runs scored (มีเฉลย): {len(rows)}   MISMATCH กับ score() เดิม: {mismatch}   ช่วงท้ายที่ score.py ไม่นับ (max): {max_tail:.2f}s")

# เทียบกับ metrics_combined.json ที่ใช้ในรายงาน (recall/precision ต่อรัน)
mc = json.load(open(OBJ1 + "/metrics_combined.json", encoding="utf-8"))
diff = 0; cmp_n = 0
for r in rows:
    key = [k for k in mc[r["case"]] if k.endswith(r["rep"])][0]
    m = mc[r["case"]][key][{"after": "new", "control-old": "old"}[r["tag"]]]
    cmp_n += 1
    if m.get("recall") != r["ref"]["recall"] or m.get("precision") != r["ref"]["precision"]: diff += 1
print(f"เทียบ metrics_combined.json: {cmp_n} รัน, ต่างกัน {diff}")

def mean(xs): xs = [x for x in xs if x is not None]; return sum(xs) / len(xs) if xs else None
def sd(xs): xs = [x for x in xs if x is not None]; return st.pstdev(xs) if len(xs) > 1 else 0.0
def pc(x): return "N/A" if x is None else f"{100 * x:5.1f}%"

cases = sorted({r["case"] for r in rows})
agg = {}
for variant in ("ALL", "ALLOWED"):
    print(f"\n===== P = {variant} =====   (วินาที, ค่าเฉลี่ยต่อรัน ; Acc/Spec = เฉลี่ยของค่าต่อรัน)")
    print(f"{'case':<12}{'n':>2} {'mode':<8}{'TP':>6}{'TN':>7}{'FP':>6}{'FN':>6}{'U':>7} | {'Acc':>7}{'SD':>6} {'Spec':>7} {'Recall':>7} {'Prec':>7} | {'baseline(ไม่ตัดเลย)':>20}")
    per = {}
    for c in cases:
        rs = [r[variant] for r in rows if r["case"] == c]
        per[c] = dict(n=len(rs), TP=mean([x["TP"] for x in rs]), TN=mean([x["TN"] for x in rs]), FP=mean([x["FP"] for x in rs]),
                      FN=mean([x["FN"] for x in rs]), U=mean([x["U"] for x in rs]), acc=mean([x["acc"] for x in rs]),
                      sd=sd([x["acc"] for x in rs]), spec=mean([x["spec"] for x in rs]), rec=mean([x["rec"] for x in rs]),
                      prec=mean([x["prec"] for x in rs]), base=mean([x["base_acc"] for x in rs]))
        p = per[c]; mode = [r["mode"] for r in rows if r["case"] == c][0]
        print(f"{c:<12}{p['n']:>2} {mode:<8}{p['TP']:>6.1f}{p['TN']:>7.1f}{p['FP']:>6.1f}{p['FN']:>6.1f}{p['U']:>7.1f} | {pc(p['acc']):>7}{100*p['sd']:>5.1f}% {pc(p['spec']):>7} {pc(p['rec']):>7} {pc(p['prec']):>7} | {pc(p['base']):>20}")
    def macro(keys, f):
        return mean([per[k][f] for k in keys])
    def pooled(keys):
        rs = [x for r in rows if r["case"] in keys for x in [r[variant]]]
        U = sum(x["U"] for x in rs); tp = sum(x["TP"] for x in rs); tn = sum(x["TN"] for x in rs); fp = sum(x["FP"] for x in rs)
        return (tp + tn) / U, tn / (tn + fp)
    for label, keys in (("6 case (เกณฑ์เดียวกับ recall/precision เดิม)", SIX), (f"{len(cases)} case ที่มีเฉลย (รวม V03_full, V05_full)", cases)):
        pa, ps = pooled(keys)
        print(f"  [{label}] macro: Acc={pc(macro(keys,'acc'))} Spec={pc(macro(keys,'spec'))} Recall={pc(macro(keys,'rec'))} Prec={pc(macro(keys,'prec'))} baseline={pc(macro(keys,'base'))} | pooled(วินาทีรวม): Acc={pc(pa)} Spec={pc(ps)}")
    agg[variant] = per

json.dump({"rows": rows, "per_case": agg}, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=lambda o: None)
# รัน: python eval/final-evaluation/objective1/accuracy/obj1_accuracy.py <out.json>
