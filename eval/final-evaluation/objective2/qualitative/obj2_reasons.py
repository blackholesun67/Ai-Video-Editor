import sys, re, json, glob, os
sys.stdout.reconfigure(encoding="utf-8")
ROOT = r"C:/Users/nine0/Desktop/ai-video-editor-git/eval"
FE = ROOT + "/final-evaluation"

CUT = re.compile(r"^\s*(?:🔴|🟡|🟢|⚪) \[([^\]]*)\] ([\d.]+)s → ([\d.]+)s \(([\d.]+)s\) — (.*)$")
KEEP = re.compile(r"^\s+([\d.]+)s → ([\d.]+)s\s+\(([\d.]+)s\)")
RETAKE = re.compile(r"\[Retake\] ตัดเทคซ้ำ ([\d.]+)s → ([\d.]+)s")
TRY = re.compile(r"Trying (gemini-[\w.-]+) \(Attempt")
TS = re.compile(r"(\d+):([\d.]+)\s*-\s*(\d+):([\d.]+)\s*\|\s*(\w+)")

def gt(clip):
    p = f"{ROOT}/{clip}/ground_truth.txt"
    out = {"cut": [], "keep": []}
    if not os.path.exists(p): return out
    sec = None
    for ln in open(p, encoding="utf-8"):
        if ln.startswith("[SHOULD_CUT]"): sec = "cut"; continue
        if ln.startswith("[SHOULD_KEEP]"): sec = "keep"; continue
        if ln.startswith("[NOTES]"): sec = None; continue
        m = TS.search(ln)
        if m and sec:
            a = int(m[1]) * 60 + float(m[2]); b = int(m[3]) * 60 + float(m[4])
            out[sec].append([a, b, m[5]])
    return out

def parse(path):
    lines = open(path, encoding="utf-8").read().splitlines()
    r = {"cuts": [], "keep": [], "retake": [], "model": None, "ok": False}
    in_keep = False
    for ln in lines:
        if (m := TRY.search(ln)): r["model"] = m[1]
        if "AI Suggested Cuts" in ln: r["ok"] = True
        if (m := CUT.match(ln)):
            r["cuts"].append({"conf": m[1], "s": float(m[2]), "e": float(m[3]), "reason": m[5].strip()})
        if (m := RETAKE.search(ln)): r["retake"].append([float(m[1]), float(m[2])])
        if "Final keep segments" in ln: in_keep = True; continue
        if in_keep:
            if (m := KEEP.match(ln)): r["keep"].append([float(m[1]), float(m[2])])
            elif ln.strip() and not ln.startswith("  "): in_keep = False
    return r

runs = []
for cond, obj in (("B_audio+visual", "objective1"), ("A_audio-only", "objective2")):
    for p in sorted(glob.glob(f"{FE}/{obj}/rep*/*/*/harness.log")):
        parts = p.replace("\\", "/").split("/")
        rep, tag, case = parts[-4], parts[-3], parts[-2]
        r = parse(p)
        if not r["ok"]: continue
        r.update(cond=cond, rep=rep, tag=tag, case=case, path=os.path.relpath(p, FE).replace("\\", "/"))
        runs.append(r)

cases = sorted({r["case"] for r in runs})
dump = {"runs": runs, "gt": {c: gt(c.split("_")[0]) for c in cases}}
json.dump(dump, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)

for c in cases:
    g = dump["gt"][c]
    print(f"\n########## {c}   GT cut={[(round(a,1),round(b,1),t) for a,b,t in g['cut']]}  GT keep={[(a,b) for a,b,_ in g['keep']]}")
    for r in [x for x in runs if x["case"] == c]:
        print(f"  [{r['cond'][0]}] {r['rep']}/{r['tag']:<11} model={r['model']}  keep={[(a,b) for a,b in r['keep']]}  retake={r['retake']}")
        for k in r["cuts"]:
            print(f"      {k['s']:>7.2f}-{k['e']:<7.2f} ({k['e']-k['s']:4.1f}s) [{k['conf']}] {k['reason']}")
        if not r["cuts"]: print("      (0 cuts)")
