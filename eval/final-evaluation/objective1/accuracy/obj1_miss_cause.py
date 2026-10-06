r"""
Objective 1 — หาสาเหตุของวินาทีในเฉลยที่ระบบตัดไม่ได้/ตัดได้บางส่วน แยกทีละรอบ
อ่าน harness.log + preview.json เดิมของ objective1/rep*/ เท่านั้น (ไม่เรียก Gemini ไม่แก้เฉลย ไม่แก้โค้ดระบบ)

นิยาม (นิยาม ALLOWED เหมือน recall เดิม ; parse_gt/ALLOWED จาก eval/tools/score.py):
  F  = ช่วงที่ระบบตัดในผลสุดท้าย (ช่องว่างระหว่าง selected_segments — เหมือน score.py)
  R  = ข้อเสนอของ Gemini ที่พิมพ์ใน log ("🔴 [conf] s → e (d) — reason") — พิมพ์หลัง _spare_unreadable_speech
       (โหมด full) แต่ก่อน Step 5 และ guard ทั้งหมด (ai_logic.py บรรทัด print "AI Suggested Cuts")
  R5 = ข้อเสนอที่ยาวเกิน 5.0 วิ (Step 5: `if end <= start + 5.0: continue` — ช่วงยาวพอดี 5.0 ถูกทิ้งด้วย)
  วินาทีที่หาย (เฉลย − F) แบ่งเป็น
    ก = ไม่อยู่ในข้อเสนอใดเลย (Gemini ไม่ได้เสนอ)
    ข = อยู่เฉพาะในข้อเสนอที่ยาว ≤ 5.0 วิ (ถูก Step 5 ทิ้ง)
    ค = อยู่ในข้อเสนอที่ยาว > 5.0 วิ แต่ผลสุดท้ายไม่ได้ตัด (หด/ยกเลิกโดย snap ใน Step 5 หรือ guard หลัง invert)
  ข้อจำกัด: แยก ค ต่อว่าเป็น snap ใน Step 5 หรือ _snap_segments_to_sentences ไม่ได้ (Step 5 ไม่พิมพ์ log)
รัน (ที่ root ของ repo หรือที่ไหนก็ได้): python eval/final-evaluation/objective1/accuracy/obj1_miss_cause.py
ผลที่บันทึกไว้: obj1_miss_cause_output.txt
"""
import os
os.chdir(os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..")))
import sys, json, glob, re, collections
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, "eval/tools"); import score as S
GT = {"V02_full":"V02","V03_summary":"V03","V04_full":"V04","V06_full":"V06","V06_summary":"V06","V07_full":"V07"}
PROP = re.compile(r"^\s*(?:🔴|🟡|🟢|⚪) \[[^\]]*\] ([\d.]+)s → ([\d.]+)s \(([\d.]+)s\) — (.*)$")
def ov(a,b): return max(0.0, min(a[1],b[1])-max(a[0],b[0]))
def merge(iv):
    out=[]
    for a,b in sorted(iv):
        if out and a<=out[-1][1]: out[-1][1]=max(out[-1][1],b)
        else: out.append([a,b])
    return [tuple(x) for x in out]
def inter_len(A, g): return sum(ov(a,g) for a in A)
def sub(A, B):  # A minus B (both merged)
    out=[]
    for a0,a1 in A:
        cur=[(a0,a1)]
        for b0,b1 in B:
            nxt=[]
            for c0,c1 in cur:
                if b1<=c0 or b0>=c1: nxt.append((c0,c1)); continue
                if c0<b0: nxt.append((c0,b0))
                if b1<c1: nxt.append((b1,c1))
            cur=nxt
        out+=cur
    return out
tot=collections.defaultdict(lambda:[0,0.0]); rows=[]
for pj in sorted(glob.glob("eval/final-evaluation/objective1/rep*/*/*/preview.json")):
    p=pj.replace("\\","/").split("/"); case,tag,rep=p[-2],p[-3],p[-4]
    if case not in GT: continue
    log=pj.replace("preview.json","harness.log"); L=open(log,encoding="utf-8").read().split("\n")
    props=[]; 
    for i,l in enumerate(L,1):
        m=PROP.match(l)
        if m: props.append((float(m[1]),float(m[2]),i,m[4][:70]))
    retake=[(float(a),float(b)) for a,b in re.findall(r"ตัดเทคซ้ำ ([\d.]+)s → ([\d.]+)s","\n".join(L))]
    flags=[k for k,pat in (("Snap","[Snap]"),("Outline-คืน","คืนประเด็น core"),("Narrative-merge","[Narrative]"),("Unreadable","[Unreadable]")) if any(pat in l for l in L)]
    d=json.load(open(pj,encoding="utf-8")); end=d["transcript"][-1]["end"]; mode=d.get("edit_mode","full")
    sel=sorted((s["start"],s["end"]) for s in d["selected_segments"]); F=[]; prev=0.0
    for s,e in sel:
        if s>prev+0.01: F.append((prev,min(s,end)))
        prev=max(prev,e)
    F=merge([c for c in F if c[1]>c[0]])
    R=merge([(a,b) for a,b,_,_ in props]); R5=merge([(a,b) for a,b,_,_ in props if b>a+5.0]); Rshort=merge([(a,b) for a,b,_,_ in props if b<=a+5.0])
    gcut,_=S.parse_gt(f"eval/{GT[case]}/ground_truth.txt")
    for a,b,t in gcut:
        if t not in S.ALLOWED[mode]: continue
        g=(a,b); Lg=b-a; hit=inter_len(F,g)
        if Lg-hit<0.01: continue
        missed=sub([g],F)
        A_ = sum(inter_len(sub(missed,R),(a,b)) for _ in [0])            # never proposed
        B_ = inter_len(sub(missed, R5), g) - A_                          # proposed only in <=5s proposals
        C_ = inter_len(missed, g) - A_ - B_                              # in >5s proposal but not in final
        miss=Lg-hit
        relp=[f"{x:.2f}-{y:.2f}(L{i})" for x,y,i,_ in props if ov((x,y),g)>0]
        rows.append((case,f"{rep}/{tag}",f"{a:.0f}-{b:.0f}",t,Lg,hit,miss,A_,B_,C_,len(props),relp,flags,[r for r in retake if ov(r,g)>0]))
        for k,v in (("ก ไม่เสนอ",A_),("ข ≤5s ถูกทิ้ง",B_),("ค ขั้นหลัง Gemini หด/ยกเลิก",C_)):
            if v>0.005: tot[k][0]+=1; tot[k][1]+=v
for r in rows:
    print(f"{r[0]:12} {r[1]:17} GT {r[2]:8} {r[3]:7} L={r[4]:5.2f} hit={r[5]:5.2f} miss={r[6]:5.2f} | ก={r[7]:5.2f} ข={r[8]:5.2f} ค={r[9]:5.2f} | nprop={r[10]} overlapping={r[11]} guards={r[12]} retake_on_gt={r[13]}")
print("\nTOTAL (instances with >0 s, seconds):")
for k,(n,s) in tot.items(): print(f"  {k}: {n} instances, {s:.2f} s")
print("  sum:", round(sum(s for n,s in tot.values()),2))

# ── สรุปตามประเภท (ช่วงยาวพอดี 5.0 วิ แยกออกมา) ──
print("\nBY TYPE (instances with >0 s / seconds):")
agg = collections.defaultdict(lambda: [0, 0.0, 0, 0.0, 0, 0.0, 0.0])
for r in rows:
    key = ("5.0s " + r[0] + " " + r[2]) if r[4] == 5.0 else r[3]
    a = agg[key]
    for i, v in ((0, r[7]), (2, r[8]), (4, r[9])):
        if v > 0.005: a[i] += 1; a[i + 1] += v
    a[6] += r[6]
for k, a in agg.items():
    print(f"  {k:28} miss {a[6]:7.2f} | ก {a[0]:2}/{a[1]:7.2f} | ข {a[2]:2}/{a[3]:5.2f} | ค {a[4]:2}/{a[5]:5.2f}")

# ── ข้อเสนอทุกอันที่ยาว ≤ 5.0 วิ (ถูก Step 5 ทิ้ง) ทุกกรณีที่มีเฉลย และส่วนที่ทับเฉลย ──
print("\nPROPOSALS <= 5.0 s (dropped by Step 5):")
GT8 = dict(GT, V03_full="V03", V05_full="V05")
add_tp = add_fp = 0.0
for lg in sorted(glob.glob("eval/final-evaluation/objective1/rep*/*/*/harness.log")):
    q = lg.replace("\\", "/").split("/"); case = q[-2]; run = q[-4] + "/" + q[-3]
    if case not in GT8: continue
    gc, gk = S.parse_gt(f"eval/{GT8[case]}/ground_truth.txt")
    for i, l in enumerate(open(lg, encoding="utf-8"), 1):
        m = PROP.match(l.rstrip("\n"))
        if not m: continue
        a, b = float(m[1]), float(m[2])
        if b - a > 5.0: continue
        tp = sum(ov((a, b), (x, y)) for x, y, _ in gc); kv = sum(ov((a, b), (x, y)) for x, y, _ in gk)
        if case in GT: add_tp += tp; add_fp += (b - a) - tp
        print(f"  {case:12} {run:17} L{i:<3} {a:7.2f}-{b:7.2f} dur {b-a:4.2f} TP {tp:4.2f} nonGT {b-a-tp:4.2f} KEEP {kv:4.2f} | {m[4][:50]}")
import json as _j
raw = _j.load(open("eval/final-evaluation/objective1/accuracy/accuracy_raw.json", encoding="utf-8"))["rows"]
six = set(GT); rr = [x for x in raw if x["case"] in six]
C = sum(x["ALL"]["C"] for x in rr); TP = sum(x["ALL"]["TP"] for x in rr)
TPa = sum(x["ALLOWED"]["TP"] for x in rr); Pa = sum(x["ALLOWED"]["P"] for x in rr)
print(f"\nWHAT-IF (ประมาณการ ไม่ได้รันใหม่ ; ค่าก่อน guard) ถ้า Step 5 ไม่ทิ้งข้อเสนอเหล่านี้ใน 6 กรณีหลัก:"
      f" TP +{add_tp:.2f} s, นอกเฉลย +{add_fp:.2f} s"
      f" → pooled recall {100*TPa/Pa:.2f} → {100*(TPa+add_tp)/Pa:.2f} ; pooled precision {100*TP/C:.2f} → {100*(TP+add_tp)/(C+add_tp+add_fp):.2f}")
