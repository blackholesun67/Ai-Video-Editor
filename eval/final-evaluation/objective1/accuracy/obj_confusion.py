r"""
ตาราง TP / FP / FN / TN เป็น "วินาที" ของ Objective 1 (เงื่อนไข B) และ Objective 2 (เงื่อนไข A)
ไม่เรียก Gemini ไม่แก้ไฟล์ผล — อ่าน preview.json เดิม + เฉลย แล้วคำนวณซ้ำ

หน่วยนับ = วินาทีบนแกนเวลาของคลิป (ไม่ใช่ "จำนวนช่วง")
Universe U = [0, จุดจบ transcript] ของแต่ละรอบ
  บวก (positive) = "วินาทีที่ควรตัด" ตามเฉลย ; ลบ (negative) = "วินาทีที่ควรเก็บ"
  C = วินาทีที่ระบบตัดจริง (ช่องว่างระหว่าง selected_segments — นิยามเดียวกับ score.py)
  P = วินาทีที่ควรตัดตามเฉลย (union ไม่นับซ้ำ)
    ALL     = SHOULD_CUT ทุกประเภท              → ตรงกับ denominator ของ precision ใน score.py
    ALLOWED = เฉพาะประเภทที่โหมดนั้นอนุญาต        → ตรงกับ denominator ของ recall ใน score.py
  TP = |C ∩ P| · FP = |C| − TP · FN = |P| − TP · TN = |U| − |C ∪ P|

สูตร: Precision = TP/(TP+FP) · Recall = TP/(TP+FN) · F1 = 2PR/(P+R)
      Accuracy = (TP+TN)/U · Specificity = TN/(TN+FP)

MIXED = คอลัมน์ที่รายงานใช้จริง: Recall จาก ALLOWED ส่วน Precision/Accuracy/Specificity จาก ALL
(ดู chapter4_results.md 2.5) — มีไว้เพื่อตรวจว่าตัวเลขที่เผยแพร่มาจากตารางไหน

รัน: python eval/final-evaluation/objective1/accuracy/obj_confusion.py [out.json]
"""
import sys, os, json, glob, statistics as st

sys.stdout.reconfigure(encoding="utf-8")
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
sys.path.insert(0, REPO + "/eval/tools")
os.chdir(REPO)
import score as S   # parse_gt, ALLOWED, score — ใช้ของเดิม ไม่ก็อบปี้นิยาม

GT = {"V02_full": "V02", "V03_full": "V03", "V03_summary": "V03", "V04_full": "V04",
      "V05_full": "V05", "V06_full": "V06", "V06_summary": "V06", "V07_full": "V07"}
SIX = ["V02_full", "V03_summary", "V04_full", "V06_full", "V06_summary", "V07_full"]
OBJ = {"B": "eval/final-evaluation/objective1", "A": "eval/final-evaluation/objective2"}


def merge(iv):
    out = []
    for a, b in sorted(x for x in iv if x[1] > x[0]):
        if out and a <= out[-1][1] + 1e-9: out[-1][1] = max(out[-1][1], b)
        else: out.append([a, b])
    return [tuple(x) for x in out]


def inter(A, B):
    return sum(max(0.0, min(a[1], b[1]) - max(a[0], b[0])) for a in A for b in B)


def run_cuts(d):
    end = d["transcript"][-1]["end"]
    cuts, prev = [], 0.0
    for s, e in sorted((s["start"], s["end"]) for s in d["selected_segments"]):
        if s > prev + 0.01: cuts.append((prev, min(s, end)))
        prev = max(prev, e)
    return end, merge([(a, b) for a, b in cuts if b > a])


def confusion(U, C, P):
    tp = inter(C, P); c = sum(b - a for a, b in C); p = sum(b - a for a, b in P)
    fp, fn, tn = c - tp, p - tp, U - (c + p - tp)
    return dict(TP=tp, FP=fp, FN=fn, TN=tn, U=U,
                prec=(tp / c) if c else None, rec=(tp / p) if p else None,
                acc=(tp + tn) / U, spec=(tn / (tn + fp)) if (tn + fp) > 0 else None)


def f1(p, r):
    return None if (p is None or r is None or p + r == 0) else 2 * p * r / (p + r)


def collect(root):
    rows, bad = [], 0
    for pj in sorted(glob.glob(root + "/rep*/*/*/preview.json")):
        pj = pj.replace("\\", "/"); parts = pj.split("/")
        case, tag, rep = parts[-2], parts[-3], parts[-4]
        if case not in GT: continue                  # V01: ไม่มีเฉลย
        gt_path = f"eval/{GT[case]}/ground_truth.txt"
        d = json.load(open(pj, encoding="utf-8"))
        mode = d.get("edit_mode", "full")
        U, C = run_cuts(d)
        gcut, _ = S.parse_gt(gt_path)
        allowed = S.ALLOWED.get(mode, S.ALLOWED["full"])
        cm = {"ALL": confusion(U, C, merge([(max(0, a), min(b, U)) for a, b, t in gcut])),
              "ALLOWED": confusion(U, C, merge([(max(0, a), min(b, U)) for a, b, t in gcut if t in allowed]))}
        # MIXED = ตาราง ALL แต่ยืม recall ของ ALLOWED (= สิ่งที่รายงานใช้)
        cm["MIXED"] = dict(cm["ALL"], rec=cm["ALLOWED"]["rec"])
        ref = S.score(gt_path, pj)                   # ตรวจกับ score() เดิม
        okr = (ref["recall"] is None) == (cm["ALLOWED"]["rec"] is None) and (
            ref["recall"] is None or abs(ref["recall"] - cm["ALLOWED"]["rec"]) < 5e-4)
        okp = (ref["precision"] is None) == (cm["ALL"]["prec"] is None) and (
            ref["precision"] is None or abs(ref["precision"] - cm["ALL"]["prec"]) < 5e-4)
        if not (okr and okp):
            bad += 1; print("MISMATCH", root, rep, tag, case)
        rows.append(dict(case=case, rep=rep, tag=tag, mode=mode, cm=cm))
    return rows, bad


def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def report(label, rows, variant):
    print(f"\n===== {label} · P = {variant} =====  (วินาที ; ค่าเฉลี่ยต่อรอบของกรณีนั้น)")
    print(f"{'กรณี':<13}{'n':>2}{'TP':>8}{'FP':>7}{'FN':>7}{'TN':>8}{'U':>8} |"
          f"{'Prec':>7}{'Recall':>8}{'F1':>7}{'Acc':>7}{'Spec':>7}")
    per = {}
    for c in SIX:
        rs = [r["cm"][variant] for r in rows if r["case"] == c]
        if not rs: continue
        g = lambda k: mean([x[k] for x in rs])
        per[c] = dict(TP=g("TP"), FP=g("FP"), FN=g("FN"), TN=g("TN"), U=g("U"),
                      prec=g("prec"), rec=g("rec"), acc=g("acc"), spec=g("spec"),
                      f1=mean([f1(x["prec"], x["rec"]) for x in rs]), n=len(rs))
        p = per[c]
        pc = lambda v: "   N/A" if v is None else f"{100*v:6.2f}"
        print(f"{c:<13}{p['n']:>2}{p['TP']:>8.2f}{p['FP']:>7.2f}{p['FN']:>7.2f}{p['TN']:>8.2f}{p['U']:>8.2f} |"
              f"{pc(p['prec']):>7}{pc(p['rec']):>8}{pc(p['f1']):>7}{pc(p['acc']):>7}{pc(p['spec']):>7}")
    s = {k: sum(per[c][k] for c in per) for k in ("TP", "FP", "FN", "TN", "U")}
    print(f"{'รวม 6 กรณี':<13}  {s['TP']:>8.2f}{s['FP']:>7.2f}{s['FN']:>7.2f}{s['TN']:>8.2f}{s['U']:>8.2f}")
    mp, mr = s["TP"] / (s["TP"] + s["FP"]), s["TP"] / (s["TP"] + s["FN"])
    print(f"  micro (จากผลรวมวินาที): Prec={100*mp:.2f} Recall={100*mr:.2f} F1={100*f1(mp,mr):.2f} "
          f"Acc={100*(s['TP']+s['TN'])/s['U']:.2f} Spec={100*s['TN']/(s['TN']+s['FP']):.2f}")
    sd = lambda k: st.pstdev([per[c][k] for c in per if per[c][k] is not None])
    m = lambda k: mean([per[c][k] for c in per])
    print(f"  macro (เฉลี่ยรายกรณี): Prec={100*m('prec'):.2f}±{100*sd('prec'):.2f} "
          f"Recall={100*m('rec'):.2f}±{100*sd('rec'):.2f} F1={100*m('f1'):.2f}±{100*sd('f1'):.2f} "
          f"Acc={100*m('acc'):.2f}±{100*sd('acc'):.2f} Spec={100*m('spec'):.2f}±{100*sd('spec'):.2f}")
    return per


out = {}
for cond, root in OBJ.items():
    rows, bad = collect(root)
    name = {"B": "Objective 1 (B เสียง+ภาพ)", "A": "Objective 2 (A เสียงล้วน)"}[cond]
    print(f"\n######## {name} — {len(rows)} รอบที่มีเฉลย · MISMATCH กับ score() เดิม: {bad}")
    out[cond] = {v: report(name, rows, v) for v in ("ALL", "ALLOWED", "MIXED")}

if len(sys.argv) > 1:
    json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
