# บทที่ 4 ผลการดำเนินงาน — รวบรวมผลการทดสอบ (ข้อมูลประกอบการเขียนเล่ม)

- สร้างเมื่อ 2026-10-05 โดยอ่านไฟล์ผลที่มีอยู่ใน `eval/final-evaluation/` (และไฟล์เฉลย/สคริปต์นิยามใน `eval/` ที่ผลอ้างถึง) **ไม่ได้แก้โค้ด ไม่ได้รันการทดสอบใหม่ ไม่ได้เรียก Gemini หรือ API ใด ๆ**
- ตัวเลขทุกค่ามาจากไฟล์ผลที่ระบุใต้ตาราง ; ค่าที่คำนวณเองติดป้าย **[คำนวณเอง]** พร้อมสูตร ; หาไม่พบเขียนว่า **ไม่พบ** ; ถ้าสองไฟล์ไม่ตรงกันแสดงทั้งสองค่า (สรุปรวมในส่วน 6)
- ร้อยละทศนิยม 2 ตำแหน่ง · หน่วยเวลาเป็นวินาที (ต้นทาง `score.py` ปัดวินาทีที่ทศนิยม 1 ตำแหน่ง จึงแสดง 2 ตำแหน่งตามที่ขอแต่ความละเอียดจริงคือ 0.1 วินาที)
- เลขบรรทัดอ้างอิงไฟล์ ณ working tree วันที่สร้าง ; `N/A` = นิยามค่าไม่ได้โดยสูตร (เช่น ไม่มีช่วงที่ควรตัด/ไม่ได้ตัดอะไร) ไม่ใช่ข้อมูลหาย

## ส่วน 0 สภาพแวดล้อมการทดสอบ

### 0.1 โค้ดที่ใช้ทดสอบ (branch / commit)

| ชุดทดสอบ | commit ที่ใช้ | branch | แหล่งข้อมูล |
|---|---|---|---|
| Objective 1 และ 2 (harness, รอบ rep1–rep2) | `822656f` (2026-09-22 19:20, `test: prepare final evaluation harness and protocols`) | **ไม่พบ** บันทึกชื่อ branch ที่ checkout ตอนรัน (ตรวจด้วย git: commit นี้อยู่ใน `feat/user-auth` และ `main`) | `eval/final-evaluation/RESULTS-TEMPLATE.md:3-4, 189` |
| Objective 1 รอบเติม V07 หลังแก้บั๊ก fallback (rep3, ล้มเหลวทั้งสองรัน) | `e136e8a` (2026-09-23 22:40, `fix: try fallback model on same key before exhausting key on daily-quota 429`) | ไม่พบ | `RESULTS-TEMPLATE.md:4-5, 165` |
| Objective 4A API (run2, run3) | `main` = `e136e8a` ; rebuild worker+backend 2026-09-24 14:01 | `main` | `objective4/functional/run2-post-rebuild/checklist_result.md:3` · `RESULTS-TEMPLATE.md:33` |
| Objective 4A UI (เพื่อนร่วมทีม) | ไม่พบ (ไฟล์ผลบอกเพียงว่า "checkout ไปที่ commit ล่าสุดตามที่เจ้าของโปรเจกต์ระบุ") | ไม่พบ | `objective4/functional/teammate-ui-test-2026-09-26/UI-TEST-RESULTS-FROM-TEAMMATE.md` (ส่วน "ก่อนเริ่ม — เตรียมเครื่อง") |
| Transcript baseline ที่ฉีดเข้า harness (Whisper+Gemini สดผ่าน worker) | ไม่พบ commit ; worker image build 2026-09-21 15:09 (ก่อนแก้ VAD-prefilter `5ad3d92` ซึ่ง commit 18:05) | ไม่พบ | `objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md` (ตาราง "หลักฐาน") · `RESULTS-TEMPLATE.md:388-394` |

ที่มา: ไฟล์ที่ระบุในคอลัมน์สุดท้าย ; commit/วันที่/การเป็นสมาชิก branch ตรวจเองด้วย `git log`/`git branch --contains` [ตรวจเอง].

**ข้อสังเกตที่ไม่ตรงกันระหว่างไฟล์:** แผนก่อนรัน (`eval/final-evaluation/objective1/README.md:4`, `MASTER-MATRIX.md:12`) กำหนด "Code Lock" ที่ commit `1612888` (2026-09-22 15:55) แต่ผลที่เก็บจริงระบุ `822656f` (`RESULTS-TEMPLATE.md:3`). ตรวจด้วย git [ตรวจเอง]: `1612888` เป็นบรรพบุรุษของ `822656f` และ `git diff 1612888 822656f -- backend` ไม่มีความต่างของไฟล์ในโฟลเดอร์ `backend/` (ไม่พบการเปลี่ยนซอร์สระบบระหว่างสอง commit นี้).

### 0.2 เครื่องและแบบจำลอง

| รายการ | ค่า | ที่มา |
|---|---|---|
| ประเภทตัวประมวลผล Whisper | **CPU** (ไม่พบ CUDA) — log: `Loading Whisper on CPU (no CUDA detected)` | `eval/V04/worker.log:128` |
| ขนาดแบบจำลอง faster-whisper | **small** (`Whisper model size: small (default small ...)`) | `eval/V04/worker.log:129` |
| compute type | **int8** (`Whisper model loaded (small/cpu/int8)`) ; ใช้ `BatchedInferencePipeline` batch_size=4 | `eval/V04/worker.log:131-132` |
| GPU | ไม่มี — `docker-compose.yml` ระบุ "เครื่องนี้ไม่มีการ์ดจอ NVIDIA (จะรัน Whisper บน CPU แทน)" | `docker-compose.yml:98` |
| RAM / ขีดจำกัดคอนเทนเนอร์ | host "~8GB" (ตามคอมเมนต์) ; worker `mem_limit: 5g` | `docker-compose.yml:76, 77` |
| รุ่นซีพียู/จำนวนคอร์/ระบบปฏิบัติการของเครื่องทดสอบ | **ไม่พบ** (ไม่มีไฟล์ผลหรือเอกสารใน `eval/` ที่ระบุ) | — |
| เครื่องของผู้ทดสอบ UI (เพื่อนร่วมทีม) | **ไม่พบ** สเปก (ไฟล์ระบุเพียงว่า "เครื่องของตัวเอง" ; เบราว์เซอร์ที่ใช้ "Chromium (built-in browser)") | `UI-TEST-RESULTS-FROM-TEAMMATE.md` (แบบฟอร์มสรุปท้ายไฟล์) |
| แบบจำลอง Gemini ที่ใช้จริง (harness, ดึงจาก log ของรันที่สำเร็จ 48 รัน) | **gemini-2.5-flash** เกือบทั้งหมด — แยกตามเงื่อนไข: A gemini-2.5-flash 19 รัน ; B gemini-2.5-flash 28 รัน ; B gemini-3.6-flash 1 รัน (A=เสียงล้วน, B=เสียง+ภาพ) | `objective2/qualitative/obj2_reasons.json` (ฟิลด์ `model`) |
| ชุดแบบจำลองที่ตั้งไว้ | ตรึง `gemini-2.5-flash` ; `gemini-3.6-flash` เป็นตัวสำรองใน `GEMINI_MODELS` | `objective1/README.md:50`, `MASTER-MATRIX.md:15` |
| 4A API (2026-09-24) | `gemini-2.5-flash` key#1 attempt 1 (run2: V02, run3: V04) | `objective4/functional/run2-post-rebuild/checklist_result.md` (แถวข้อ 2), `run3-v04-repeat/SUMMARY.md` |

หมายเหตุ: Objective 1 และ 2 ฉีด transcript จาก baseline เข้า harness โดยตรง **ไม่ได้เรียก Whisper ใหม่** (`RESULTS-TEMPLATE.md:333, 406-407`) ดังนั้นการตั้งค่า Whisper ข้างบนเป็นของการถอดเสียง baseline เมื่อ 2026-09-21 (และใช้อธิบายเวลาประมวลผลในส่วน 5.3) ไม่ใช่ของการรัน harness.

### 0.3 วันที่รันการทดสอบแต่ละชุด

| ชุด | วันที่/เวลา | ที่มาของวันที่ |
|---|---|---|
| Transcript baseline (worker สด V02,V04,V05,V06,V07) | 2026-09-21 (เวลาใน log 09:47–10:45 น. ตามเวลาของคอนเทนเนอร์ = UTC) | `eval/V02/worker.log`, `eval/V04/worker.log`, `eval/V07/worker.log` |
| Objective 1 rep1 | 2026-09-23 17:14 | เวลาแก้ไขไฟล์ (mtime) ของไฟล์ใต้ `objective1/rep1/` [ตรวจเอง] ; `RESULTS-TEMPLATE.md:3` ระบุอัปเดต 2026-09-23 |
| Objective 1 rep2 | 2026-09-23 17:57 | mtime ใต้ `objective1/rep2/` |
| Objective 1 rep3 (เติม V07 หลัง `e136e8a` — ล้มเหลว) | 2026-09-23 22:54 | mtime ใต้ `objective1/rep3/` |
| Objective 2 rep1 (เสียงล้วน) | 2026-09-23 17:19 | mtime ใต้ `objective2/rep1/` |
| Objective 2 rep2 (เสียงล้วน) | 2026-09-23 17:49 | mtime ใต้ `objective2/rep2/` |
| Accuracy/Specificity ของ Objective 1 (คำนวณจากข้อมูลเดิม ไม่เรียก Gemini) | 2026-10-01 | `RESULTS-TEMPLATE.md:102`, `objective1/accuracy/accuracy_raw.json` (mtime 2026-10-01 20:50) |
| วิเคราะห์เชิงคุณภาพ Objective 2 (อ่าน `harness.log`) | 2026-09-30 | `objective2/QUALITATIVE-REASON-ANALYSIS.md:3` |
| 4A API run2 (V02) | 2026-09-24 14:26:59 (เวลาไทย) | `objective4/functional/run2-post-rebuild/upload_time.txt` |
| 4A API run3 (V04 ทำซ้ำ) | 2026-09-24 ; log 07:35:15 UTC | `objective4/functional/run3-v04-repeat/process_log.txt` |
| 4A API รอบเก่า (pre-rebuild) | 2026-09-23 — **โมฆะ** (ใช้ image เก่า) | `RESULTS-TEMPLATE.md:31-34, 323-331` |
| 4A UI (เพื่อนร่วมทีม) | 2026-09-26 | `objective4/functional/teammate-ui-test-2026-09-26/LOG-ANALYSIS-FROM-TEAMMATE.md` (หัวเอกสาร) |

หมายเหตุ: วันที่ของ Objective 1/2 มาจาก mtime ของไฟล์ในเครื่อง (ไม่มี timestamp ภายใน `harness.log`/`preview.json`) จึงเป็นเวลาที่ไฟล์ถูกเขียน ใช้เป็นหลักฐานทางอ้อม [ตรวจเอง].

## ส่วน 1 คลิปทดสอบ

**เฉลย (Ground Truth):** ไฟล์ `eval/V02..V07/ground_truth.txt` (ไม่มี `eval/V01/ground_truth.txt`) บันทึกช่วง `[SHOULD_CUT]` (ประเภท SILENCE / RETAKE / FILLER / TANGENT / TECH) และ `[SHOULD_KEEP]` เป็นเวลานาที:วินาทีตามตัวเล่นวิดีโอของคลิปต้นฉบับ

- **ผู้จัดทำเฉลย:** ไม่พบเอกสารที่ระบุชื่อผู้จัดทำโดยตรง ; หลักฐานทางอ้อมคือ commit `4189548` (2026-09-21 16:44, ผู้เขียน commit `chirat-t`) ข้อความ "บันทึกช่วงที่ควรตัด / ควรเก็บ ของแต่ละคลิปก่อนอัปโหลดเข้าระบบ เวลาของ commit นี้คือหลักฐานว่าเฉลยเขียนก่อนเห็นผล (baseline-ch4)" (ตรวจด้วย `git show 4189548` [ตรวจเอง])
- **วิธีจัดทำ (เท่าที่ไฟล์ระบุ):** ผู้ทำฟังคลิปแล้วจดช่วงเวลาตามตัวเล่นวิดีโอพร้อมประเภทและความยาวเอง (หัวไฟล์: "ความยาว (ว) ใส่เองด้วย จะได้ตรวจตัวเลขซ้ำอีกรอบว่าจดเวลาไม่ผิด") ; ตรวจแล้วความยาวที่จดเองตรงกับผลต่างของเวลาเริ่ม–จบทุกแถว [ตรวจเอง] ; **ไม่พบ** บันทึกว่ามีผู้ตรวจเฉลยคนที่สองหรือค่าความสอดคล้องระหว่างผู้ติดป้าย
- เฉลยของ V03 ระบุ `mode: summary` ที่หัวไฟล์ แต่ทดสอบทั้งโหมด full และ summary (`objective1/README.md`, แถว V03_full) ; เฉลยของ V06 ระบุ `mode: full เเละ summary`

| รหัสคลิป | ความยาว (วินาที) | ลักษณะเนื้อหา (ชื่อใน `clip:` ของเฉลย) | โหมดที่ทดสอบ | มีเฉลย | SILENCE | RETAKE | FILLER | TECH | TANGENT | รวมควรตัด | ควรเก็บ (SHOULD_KEEP) | จำนวนรอบ Obj.1 (สำเร็จ/พยายาม) | จำนวนรอบ Obj.2 เสียงล้วน (สำเร็จ/พยายาม) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| V01 | 137.9 (VAD) | **ไม่พบ** (ไม่มีเฉลย/ชื่อคลิป) | full (sanity run) | ไม่มี | ไม่พบ | ไม่พบ | ไม่พบ | ไม่พบ | ไม่พบ | ไม่พบ | ไม่พบ | 2/2 (ไม่มีเมตริก) | ไม่มีเมตริก (มี `preview.json` 2 รัน, ไม่ถูกคำนวณ) |
| V02 | 112.8 (VAD) ; เฉลยระบุ 1:52 นาที | V02 ช่วงเงียบสั้นๆ | full | มี | 11.00 | 0.00 | 0.00 | 0.00 | 0.00 | 11.00 | 5.00 | full 4/4 | full 2/4 |
| V03 | 107.8 (VAD) ; เฉลยระบุ 1:47 นาที | V03 พูดนอกประเด็น | full, summary | มี | 0.00 | 0.00 | 0.00 | 0.00 | 43.00 | 43.00 | 0.00 (ไม่มี) | full 2/2 ; summary 4/4 | full 2/4 ; summary 2/4 |
| V04 | 144.3 (VAD) ; เฉลยระบุ 2:24.0 | V04 การสัมภาษณ์การคิดและการปรับแก้ตนเอง | full | มี | 0.00 | 21.00 | 0.00 | 0.00 | 0.00 | 21.00 | 0.00 (ไม่มี) | full 4/4 | full 3/4 |
| V05 | 124.1 (VAD) ; เฉลยระบุ 2:04.0 | V5 คลิปควบคุมเพื่อวัดว่าตัดเกินไหม | full | มี | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 24.00 | full 2/2 | full 2/2 |
| V06 | 178.5 (VAD) ; เฉลยระบุ 2:58.0 | V06 ทดสอบหลายกรณี | full, summary | มี | 0.00 | 15.00 | 0.00 | 0.00 | 53.00 | 68.00 | 6.00 | full 4/4 ; summary 4/4 | full 2/4 ; summary 2/4 |
| V07 | 95.8 (VAD) ; เฉลยระบุ 1:35.0 | V07 เงียบนาน | full | มี | 43.00 | 0.00 | 0.00 | 0.00 | 0.00 | 43.00 | 2.00 | full 3/4 | full 2/4 |

ที่มา: ความยาวรวมต่อประเภท/ควรเก็บ [คำนวณเอง] = ผลรวมของ (เวลาจบ − เวลาเริ่ม) ของแถวประเภทนั้นใน `eval/V0x/ground_truth.txt` (ใช้ตัวแยกบรรทัด `score.py:parse_gt`) ; ความยาวคลิปจากบรรทัด `[VAD] Duration` ใน `objective1/rep1_out.txt` และ `video_length` ในเฉลย ; ชื่อ/ลักษณะเนื้อหาจากบรรทัด `clip:` ในเฉลย ; จำนวนรอบจาก `objective1/metrics_combined.json` และ `objective2/metrics_combined.json` (นับรายการที่ไม่ใช่ `NOT RUN` ; "สำเร็จ" = มีเมตริก). ลักษณะเนื้อหาเชิงภาพ: `QUALITATIVE-REASON-ANALYSIS.md:111` ระบุว่าคลิปทั้ง 7 เป็นการพูดหน้ากล้อง.

หมายเหตุเรื่องจำนวนรอบ: 1 "รอบ" ในไฟล์ผล = 1 การเรียก Gemini ต่อ 1 คลิป/โหมด ; แต่ละ rep มี 2 tag (`after`/`new` และ `control-old`/`old`) ซึ่ง `objective1/README.md` (ตาราง Protocol) อธิบายว่าเป็น **โค้ดเดียวกัน** ใช้เป็นการรันซ้ำ 2 ครั้ง ดังนั้น 2 rep × 2 tag = สูงสุด 4 รอบต่อกรณี. V03_full/V05_full รันเฉพาะ rep1 (rep2 = `NOT RUN`) ; รอบเสียงล้วนส่วนใหญ่ของ rep1 ล้มเหลว (ดู 2.7).

## ส่วน 2 วัตถุประสงค์ข้อ 1 (ความถูกต้องของการเสนอช่วงตัด)

**นิยามที่ใช้ในทุกตาราง (จาก `eval/tools/score.py` และ `objective1/accuracy/obj1_accuracy.py`):** หน่วยวิเคราะห์เป็น **วินาที** บนช่วง [0, จุดจบ transcript] ของแต่ละรัน ; "ช่วงที่ระบบตัด" = ช่องว่างระหว่าง `selected_segments` ; TP = วินาทีที่ตัดทับช่วงที่ควรตัด, FP = ตัดนอกช่วงที่ควรตัด, FN = ควรตัดแต่ระบบเก็บไว้, TN = ไม่ควรตัดและระบบเก็บไว้ ; Accuracy = (TP+TN)/ความยาวรวม ; Specificity = TN/(TN+FP) ; Outside-GT = วินาทีที่ตัดซึ่งไม่อยู่ใน SHOULD_CUT ใดเลย ; Keep Violation = วินาทีที่ตัดทับ SHOULD_KEEP. **ตั้งแต่ 2026-10-08 ทุกตัวชี้วัดในบทนี้ใช้นิยาม `ALLOWED` ชุดเดียวทั้งหมด** (Recall, Precision, F1, Accuracy, Specificity, baseline) — `ALLOWED` = นับเป็น "ควรตัด" เฉพาะประเภทที่โหมดนั้นอนุญาต ; ประเภทที่โหมดนั้นห้ามตัด (TANGENT ในโหมด full) ถือเป็น "ควรเก็บ" ตามสเปกของโหมด (CLAUDE.md §6). **Recall ไม่เปลี่ยนจากเดิม** เพราะ `score()` ใช้ `ALLOWED` อยู่แล้ว ; **Precision/F1/Accuracy/Specificity/baseline เปลี่ยนเฉพาะ V06_full และ V03_full** (สองคลิปที่เฉลยมี TANGENT) — ดูค่าชุดเดิมตามนิยาม `ALL` ใน 2.10. **F1 [คำนวณเอง]** = 2·P·R/(P+R) ต่อรัน (ถ้า P หรือ R เป็น N/A ให้ F1 = N/A). **Outside-GT และ Keep Violation ยังนิยามบน `ALL` ตามเดิม** (เป็นตัวชี้วัดวินิจฉัยคนละชุด ไม่ใช่ TP/FP) จึงไม่เท่ากับ FP ของตาราง ALLOWED.

### 2.1 ผลรายรอบ

| กรณี | รอบที่ (rep/tag) | Recall % | Precision % | F1 % [คำนวณเอง] | Accuracy % | Specificity % | Outside-GT (วินาที) | Keep Violation (วินาที) | สถานะรอบ |
|---|---|---|---|---|---|---|---|---|---|
| V01_full | rep1/after, rep1/control-old | ไม่มีเฉลย | ไม่มีเฉลย | ไม่มีเฉลย | ไม่มีเฉลย | ไม่มีเฉลย | ไม่มีเฉลย | ไม่มีเฉลย | สำเร็จ (sanity run 2 รอบ — `metrics_combined.json`: `OK (sanity, ไม่มีเฉลย)`) |
| V02_full | rep1/after | 50.64 | 96.03 | 66.31 | 94.89 | 99.77 | 0.20 | 0.00 | สำเร็จ |
| V02_full | rep1/control-old | 50.64 | 96.03 | 66.31 | 94.89 | 99.77 | 0.20 | 0.00 | สำเร็จ |
| V02_full | rep2/after | 50.64 | 96.03 | 66.31 | 94.89 | 99.77 | 0.20 | 0.00 | สำเร็จ |
| V02_full | rep2/control-old | 50.64 | 96.03 | 66.31 | 94.89 | 99.77 | 0.20 | 0.00 | สำเร็จ |
| V03_full | rep1/after | N/A | N/A | N/A | 100.00 | 100.00 | 0.00 | 0.00 | สำเร็จ (ตัด 0 วินาที) |
| V03_full | rep1/control-old | N/A | N/A | N/A | 100.00 | 100.00 | 0.00 | 0.00 | สำเร็จ (ตัด 0 วินาที) |
| V03_full | rep2/after | — | — | — | — | — | — | — | ไม่ได้รัน (`NOT RUN`) |
| V03_full | rep2/control-old | — | — | — | — | — | — | — | ไม่ได้รัน (`NOT RUN`) |
| V03_summary | rep1/after | 100.00 | 84.85 | 91.80 | 92.61 | 87.40 | 7.70 | 0.00 | สำเร็จ |
| V03_summary | rep1/control-old | 96.65 | 97.01 | 96.83 | 97.38 | 97.90 | 1.30 | 0.00 | สำเร็จ (ตอบสำเร็จบน gemini-3.6-flash) |
| V03_summary | rep2/after | 57.91 | 95.11 | 71.99 | 81.35 | 97.90 | 1.30 | 0.00 | สำเร็จ |
| V03_summary | rep2/control-old | 0.00 | N/A | N/A | 58.63 | 100.00 | 0.00 | 0.00 | สำเร็จ (ตัด 0 วินาที) |
| V04_full | rep1/after | 22.81 | 56.49 | 32.50 | 86.11 | 96.98 | 3.70 | 0.00 | สำเร็จ |
| V04_full | rep1/control-old | 52.38 | 73.88 | 61.30 | 90.30 | 96.82 | 3.90 | 0.00 | สำเร็จ |
| V04_full | rep2/after | 0.00 | N/A | N/A | 85.34 | 100.00 | 0.00 | 0.00 | สำเร็จ (ตัด 0 วินาที) |
| V04_full | rep2/control-old | 34.62 | 39.30 | 36.81 | 82.57 | 90.81 | 11.20 | 0.00 | สำเร็จ |
| V05_full | rep1/after | N/A | N/A | N/A | 100.00 | 100.00 | 0.00 | 0.00 | สำเร็จ (ตัด 0 วินาที) |
| V05_full | rep1/control-old | N/A | N/A | N/A | 100.00 | 100.00 | 0.00 | 0.00 | สำเร็จ (ตัด 0 วินาที) |
| V05_full | rep2/after | — | — | — | — | — | — | — | ไม่ได้รัน (`NOT RUN`) |
| V05_full | rep2/control-old | — | — | — | — | — | — | — | ไม่ได้รัน (`NOT RUN`) |
| V06_full | rep1/after | 82.33 | 30.37 | 44.37 | 82.48 | 82.50 | 6.00 | 5.00 | สำเร็จ |
| V06_full | rep1/control-old | 59.40 | 22.44 | 32.57 | 79.13 | 80.96 | 8.40 | 5.80 | สำเร็จ |
| V06_full | rep2/after | 54.07 | 20.86 | 30.11 | 78.70 | 80.99 | 8.40 | 6.00 | สำเร็จ |
| V06_full | rep2/control-old | 70.20 | 27.10 | 39.11 | 81.45 | 82.50 | 6.00 | 5.00 | สำเร็จ |
| V06_summary | rep1/after | 32.88 | 78.95 | 46.43 | 70.81 | 94.52 | 6.00 | 5.00 | สำเร็จ |
| V06_summary | rep1/control-old | 80.57 | 90.19 | 85.11 | 89.16 | 94.52 | 6.00 | 5.00 | สำเร็จ |
| V06_summary | rep2/after | 88.25 | 90.28 | 89.25 | 91.83 | 94.06 | 6.50 | 5.00 | สำเร็จ |
| V06_summary | rep2/control-old | 45.00 | 68.64 | 54.36 | 70.94 | 87.15 | 14.00 | 5.00 | สำเร็จ |
| V07_full | rep1/after | 100.00 | 92.67 | 96.20 | 96.42 | 93.45 | 3.40 | 0.00 | สำเร็จ |
| V07_full | rep1/control-old | 100.00 | 92.67 | 96.20 | 96.42 | 93.45 | 3.40 | 0.00 | สำเร็จ |
| V07_full | rep2/after | — | — | — | — | — | — | — | **ล้มเหลว** (429 RESOURCE_EXHAUSTED; ดู 2.7) |
| V07_full | rep2/control-old | 100.00 | 92.67 | 96.20 | 96.42 | 93.45 | 3.40 | 0.00 | สำเร็จ |
| V07_full | rep3/after | — | — | — | — | — | — | — | **ล้มเหลว** (503 UNAVAILABLE; ดู 2.7) |
| V07_full | rep3/control-old | — | — | — | — | — | — | — | **ล้มเหลว** (503 UNAVAILABLE; ดู 2.7) |

ที่มา: Recall/Precision/Outside-GT/Keep Violation จาก `eval/final-evaluation/objective1/metrics_combined.json` (ตรวจซ้ำกับ `score()` ของ `eval/tools/score.py` และ `objective1/accuracy/accuracy_raw.json` ตรงกันทั้ง 27 รัน) ; Accuracy/Specificity จาก `objective1/accuracy/accuracy_raw.json` (ฟิลด์ `ALL`, ตรงกับค่าที่คำนวณซ้ำจาก `preview.json` ของแต่ละรัน [คำนวณเอง]) ; สถานะล้มเหลวจาก `harness.log` ของรอบนั้น ; แถว rep3 ไม่อยู่ใน `metrics_combined.json` (ไม่มี `preview.json`) ; model จาก `objective2/qualitative/obj2_reasons.json`. รอบ rep1/after ของ V07_full ใช้ tag `after` = โค้ดเดียวกับ `control-old`.

### 2.2 ผลรายกรณี (ค่าเฉลี่ย ± S.D. ข้ามรอบของกรณีเดียวกัน)

สูตร: ค่าเฉลี่ย = Σx/n ; **S.D. = ส่วนเบี่ยงเบนมาตรฐานของประชากร** √(Σ(x−x̄)²/n) (`statistics.pstdev`, ตรงกับคอลัมน์ SD ใน `accuracy_output.txt` ของ Accuracy) ; n = จำนวนรอบที่ค่านั้นนิยามได้ (Precision/F1 ไม่นับรอบที่ Gemini เสนอตัด 0 วินาที). ทุกค่า [คำนวณเอง] จากรายรอบใน 2.1.

| กรณี | จำนวนรอบสำเร็จ | Recall % | Precision % | F1 % | Accuracy % | Specificity % | Outside-GT (วินาที) | Keep Violation (วินาที) |
|---|---|---|---|---|---|---|---|---|
| V02_full | 4 | 50.64 ± 0.00 (n=4) | 96.03 ± 0.00 (n=4) | 66.31 ± 0.00 (n=4) | 94.89 ± 0.00 (n=4) | 99.77 ± 0.00 (n=4) | 0.20 ± 0.00 (n=4) | 0.00 ± 0.00 (n=4) |
| V03_full | 2 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 ± 0.00 (n=2) | 100.00 ± 0.00 (n=2) | 0.00 ± 0.00 (n=2) | 0.00 ± 0.00 (n=2) |
| V03_summary | 4 | 63.64 ± 40.29 (n=4) | 92.32 ± 5.34 (n=3) | 86.87 ± 10.72 (n=3) | 82.49 ± 14.96 (n=4) | 95.80 ± 4.93 (n=4) | 2.58 ± 3.01 (n=4) | 0.00 ± 0.00 (n=4) |
| V04_full | 4 | 27.45 ± 19.03 (n=4) | 56.56 ± 14.12 (n=3) | 43.54 ± 12.68 (n=3) | 86.08 ± 2.77 (n=4) | 96.15 ± 3.33 (n=4) | 4.70 ± 4.06 (n=4) | 0.00 ± 0.00 (n=4) |
| V05_full | 2 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 ± 0.00 (n=2) | 100.00 ± 0.00 (n=2) | 0.00 ± 0.00 (n=2) | 0.00 ± 0.00 (n=2) |
| V06_full | 4 | 66.50 ± 10.83 (n=4) | 25.19 ± 3.77 (n=4) | 36.54 ± 5.59 (n=4) | 80.44 ± 1.57 (n=4) | 81.74 ± 0.76 (n=4) | 7.20 ± 1.20 (n=4) | 5.45 ± 0.46 (n=4) |
| V06_summary | 4 | 61.68 ± 23.29 (n=4) | 82.02 ± 8.99 (n=4) | 68.79 ± 18.66 (n=4) | 80.68 ± 9.85 (n=4) | 92.56 ± 3.13 (n=4) | 8.12 ± 3.40 (n=4) | 5.00 ± 0.00 (n=4) |
| V07_full | 3 | 100.00 ± 0.00 (n=3) | 92.67 ± 0.00 (n=3) | 96.20 ± 0.00 (n=3) | 96.42 ± 0.00 (n=3) | 93.45 ± 0.00 (n=3) | 3.40 ± 0.00 (n=3) | 0.00 ± 0.00 (n=3) |

ที่มา: คำนวณจากแถวใน 2.1 (`objective1/metrics_combined.json`, `objective1/accuracy/accuracy_raw.json`) ; เทียบกับ `RESULTS-TEMPLATE.md:84-91` (Recall/Precision/Outside-GT ตรงกัน ยกเว้น Keep Violation ของ V06_full — ดู 2.6) และ `objective1/accuracy/accuracy_output.txt` (Accuracy/Specificity/SD ตรงกัน).

S.D. แบบตัวอย่าง (หาร n−1) [คำนวณเอง] สำหรับกรณีที่ผู้อ่านต้องการเทียบ (ค่าเฉลี่ยเท่าเดิม):

| กรณี | Recall % | Precision % | F1 % | Accuracy % | Specificity % |
|---|---|---|---|---|---|
| V02_full | 50.64 ± 0.00 (n=4) | 96.03 ± 0.00 (n=4) | 66.31 ± 0.00 (n=4) | 94.89 ± 0.00 (n=4) | 99.77 ± 0.00 (n=4) |
| V03_full | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 ± 0.00 (n=2) | 100.00 ± 0.00 (n=2) |
| V03_summary | 63.64 ± 46.53 (n=4) | 92.32 ± 6.54 (n=3) | 86.87 ± 13.13 (n=3) | 82.49 ± 17.27 (n=4) | 95.80 ± 5.69 (n=4) |
| V04_full | 27.45 ± 21.97 (n=4) | 56.56 ± 17.29 (n=3) | 43.54 ± 15.53 (n=3) | 86.08 ± 3.20 (n=4) | 96.15 ± 3.85 (n=4) |
| V05_full | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 ± 0.00 (n=2) | 100.00 ± 0.00 (n=2) |
| V06_full | 66.50 ± 12.51 (n=4) | 25.19 ± 4.35 (n=4) | 36.54 ± 6.45 (n=4) | 80.44 ± 1.82 (n=4) | 81.74 ± 0.88 (n=4) |
| V06_summary | 61.68 ± 26.90 (n=4) | 82.02 ± 10.38 (n=4) | 68.79 ± 21.55 (n=4) | 80.68 ± 11.38 (n=4) | 92.56 ± 3.62 (n=4) |
| V07_full | 100.00 ± 0.00 (n=3) | 92.67 ± 0.00 (n=3) | 96.20 ± 0.00 (n=3) | 96.42 ± 0.00 (n=3) | 93.45 ± 0.00 (n=3) |

("± N/A" = มีเพียง 1 ค่า จึงหาค่าเบี่ยงเบนแบบตัวอย่างไม่ได้)

### 2.3 ค่าเฉลี่ยรวม (macro และ pooled)

| ตัวชี้วัด | Macro 6 กรณี (เฉลี่ยของค่าเฉลี่ยรายกรณี) ± S.D. ระหว่างกรณี | Pooled 23 รอบ (รวมวินาทีทุกรอบ) |
|---|---|---|
| Recall % | 61.65 ± 21.56 | 64.58 |
| Precision % | 74.13 ± 25.56 | 72.04 |
| F1 % | 66.37 ± 21.32 (เฉลี่ยของ F1 รายกรณี) ; F1 ของ P/R เฉลี่ย = 67.32 | 68.11 |
| Accuracy % | 86.84 ± 6.52 | 85.30 |
| Specificity % | 93.24 ± 5.64 | 91.95 |
| Accuracy ถ้าไม่ตัดเลย (baseline) % | 73.63 ± 15.59 | 75.69 |
| Outside-GT (วินาที) | 4.37 ± 2.70 | 4.41 (เฉลี่ยต่อรอบ) |
| Keep Violation (วินาที) | 1.74 ± 2.47 | 1.82 (เฉลี่ยต่อรอบ) |

จำนวนที่ใช้: **6 กรณี** = V02_full, V03_summary, V04_full, V06_full, V06_summary, V07_full (เกณฑ์ตาม `RESULTS-TEMPLATE.md:93`), **23 รอบ** (V02 4 + V03_summary 4 + V04 4 + V06_full 4 + V06_summary 4 + V07 3) ; ไม่รวม V01 (ไม่มีเฉลย), V03_full และ V05_full (ระบบไม่ตัดอะไรเลย Recall/Precision นิยามไม่ได้). Precision/F1 ใช้ 21 จาก 23 รอบ (อีก 2 รอบ Gemini เสนอตัด 0 วินาที).

สูตร [คำนวณเอง]: Macro = mean ของค่าเฉลี่ยรายกรณี (6 ค่า) ; S.D. ระหว่างกรณี = pstdev ของ 6 ค่านั้น ; Pooled Accuracy = (ΣTP+ΣTN)/ΣU ; Pooled Specificity = ΣTN/(ΣTN+ΣFP) ; Pooled Recall = ΣTP(ALLOWED)/ΣP(ALLOWED) ; Pooled Precision = ΣTP(ALL)/ΣC ; Pooled F1 = 2PR/(P+R) ของค่า pooled ; baseline = 1 − ΣP(ALL)/ΣU. (TP/TN/FP/FN/U/P/C ต่อรอบจาก `accuracy_raw.json` ซึ่งยืนยันกับการคำนวณใหม่จาก `preview.json` แล้ว.)

เทียบกับค่าที่เผยแพร่ในไฟล์ผล:

| ค่า | ในไฟล์ผล | ค่านี้ (คำนวณใหม่) | ที่มาของค่าเดิม |
|---|---|---|---|
| Recall macro 6 กรณี | 61.65 | 61.65 | `RESULTS-TEMPLATE.md:97` |
| Precision macro 6 กรณี (ALLOWED) | 74.1 | 74.13 | `RESULTS-TEMPLATE.md:141` (คอลัมน์ ALLOWED) |
| Outside-GT macro | 4.37 s | 4.37 s | `RESULTS-TEMPLATE.md:99` |
| F1 (ALLOWED) | — (ไฟล์ผลไม่ได้คำนวณไว้) | 67.32 (F1 ของ P/R เฉลี่ย) ; 66.37 (เฉลี่ยของ F1 รายกรณี) | [คำนวณเอง] |
| Accuracy macro 6 กรณี (ALLOWED) | 86.8 | 86.84 | `RESULTS-TEMPLATE.md:138` |
| Specificity macro 6 กรณี (ALLOWED) | 93.2 | 93.24 | `RESULTS-TEMPLATE.md:139` |
| Baseline macro 6 กรณี (ALLOWED) | — | 73.63 | [คำนวณเอง] |
| Accuracy / Specificity pooled 6 กรณี (ALLOWED) | — | 85.30 / 91.95 | `confusion_output.txt` |
| Accuracy / Specificity / baseline macro 8 กรณี (ALLOWED) | — | 90.13 / 94.93 / 80.22 | `confusion_output.txt` |
| Accuracy / Specificity pooled 8 กรณี (ALLOWED) | — | 87.16 / 93.25 | `confusion_output.txt` |

**ค่าชุดเดิมตามนิยาม ALL (เก็บไว้อ้างอิง ไม่ใช้เป็นค่าหลักแล้ว):** Precision macro 83.56 / pooled 85.15 · F1 macro 72.46 (ผสม) หรือ 70.31 (ALL ล้วน) · Accuracy macro 86.05 / pooled 84.24 · Specificity macro 95.19 / pooled 95.31 · baseline macro 68.63 · Recall macro ตามนิยาม ALL 58.49 — ตรงกับ `RESULTS-TEMPLATE.md:98, 100, 120-124, 140` และ `accuracy_output.txt` ; ดูตารางเทียบเต็มใน 2.10

ที่มา: คำนวณจาก `objective1/accuracy/confusion_raw.json` (นิยาม ALLOWED) และ `objective1/metrics_combined.json` ; ค่า "ในไฟล์ผล" คัดจากไฟล์ที่ระบุ.

### 2.4 ค่าอ้างอิงแบบไม่ตัดเลย (Do-nothing baseline) เทียบ Accuracy จริง

สูตร: baseline = Accuracy ของระบบสมมติที่ "ไม่ตัดอะไรเลย" = 1 − (วินาทีที่ควรตัด**ตามนิยาม ALLOWED** ÷ ความยาวรวม) ; ส่วนต่าง = Accuracy − baseline (จุดเปอร์เซ็นต์) [คำนวณเอง].

| กรณี | Accuracy จริง % (เฉลี่ย) | Baseline % (เฉลี่ย) | ส่วนต่าง (จุด) | Specificity % |
|---|---|---|---|---|
| V02_full | 94.89 | 90.07 | +4.82 | 99.77 |
| V03_full | 100.00 | 100.00 | +0.00 | 100.00 |
| V03_summary | 82.49 | 58.63 | +23.86 | 95.80 |
| V04_full | 86.08 | 85.34 | +0.74 | 96.15 |
| V05_full | 100.00 | 100.00 | +0.00 | 100.00 |
| V06_full | 80.44 | 91.52 | −11.08 | 81.74 |
| V06_summary | 80.68 | 61.54 | +19.15 | 92.56 |
| V07_full | 96.42 | 54.67 | +41.74 | 93.45 |
| **Macro 6 กรณี** | 86.84 | 73.63 | +13.21 | 93.24 |
| **Macro 8 กรณี** (รวม V03_full, V05_full) | 90.13 | 80.22 | +9.91 | 94.93 |

**V06_full เป็นกรณีเดียวที่ Accuracy ต่ำกว่า baseline (−11.08 จุด)** — ภายใต้ ALLOWED ช่วง TANGENT 52–105 วินาทีถือว่า "ควรเก็บ" ระบบจึงเสีย FP ไป 29.55 วินาทีจากการตัดบริเวณนั้น ทำให้แพ้ระบบสมมติที่ไม่ตัดอะไรเลย (baseline 91.52) ; ด้วยนิยาม ALL ตัวเลขชุดนี้เป็น Accuracy 75.76 / baseline 61.54 (+14.22)

ที่มา: คำนวณจาก `objective1/accuracy/confusion_raw.json` (นิยาม `ALLOWED`) ; ค่าชุดเดิมตามนิยาม ALL อยู่ใน `objective1/accuracy/accuracy_raw.json` และ `accuracy_output.txt` ; ข้อควรระวังเรื่อง Accuracy ถูกเงินเฟ้อด้วย TN: `RESULTS-TEMPLATE.md:145-148` (เช่น V04_full Accuracy เหนือ baseline เพียง +0.74 จุดทั้งที่ Recall ต่ำ).

### 2.5 นิยาม Recall (ALLOWED) และ Precision (ALL) ตามสคริปต์

**ยืนยันแล้ว: ใช่** — Recall ใช้นิยาม **ALLOWED** และ Precision ใช้นิยาม **ALL** จริง ตามโค้ด `eval/tools/score.py` (ซึ่งทั้ง `metrics_combined.json` และ `obj1_accuracy.py` เรียกใช้):

- Recall = วินาทีที่ตัดตรง SHOULD_CUT **เฉพาะประเภทที่โหมดนั้นอนุญาต** ÷ วินาทีรวมของ SHOULD_CUT ประเภทนั้น (`score.py:6`, โค้ด `allowed = [...]` ที่บรรทัด 64, คำนวณที่บรรทัด 71). ประเภทที่อนุญาต (`score.py:21`): โหมด **full** = SILENCE, RETAKE, FILLER, TECH ; โหมด **summary** = ทั้งสี่ + TANGENT
- Precision = วินาทีที่ตัดตรง SHOULD_CUT **ทุกประเภท** ÷ วินาทีรวมที่ระบบตัด (`score.py:8`, คำนวณที่บรรทัด 72) ; Recall = N/A ถ้าเฉลยไม่มีช่วงที่ตัดได้ในโหมดนั้น, Precision = N/A ถ้าระบบไม่ได้ตัดเลย
- ผลคือในโหมด full ของคลิปที่เฉลยมี TANGENT (V03_full, V06_full) ตัวเศษ/ตัวส่วนของ Recall กับ Precision ไม่ได้มาจากชุด TP/FN/FP ชุดเดียวกัน (`RESULTS-TEMPLATE.md:128-129`)
- `obj1_accuracy.py` ตรวจสอบว่า Recall(ALLOWED) และ Precision(ALL) ที่คำนวณซ้ำต้องเท่ากับ `score()` ทุกรัน — ผลตรวจ: **MISMATCH 0 จาก 27 รัน** (`accuracy_output.txt:1`) ; ผมตรวจซ้ำแบบเดียวกันกับ 27 รัน Objective 1 และ 17 รัน Objective 2 ได้ตรงกันทั้งหมด [ตรวจเอง].
- **ข้อตกลงปัจจุบัน (2026-10-08): ทุกตัวชี้วัดใช้ `ALLOWED` ชุดเดียว** รวมถึง Precision/F1/Accuracy/Specificity/baseline ซึ่งเดิม (ข้อตกลง 2026-10-01, `RESULTS-TEMPLATE.md:107`) ใช้ `ALL` ; เหตุผลที่เปลี่ยน: ตัวเลขชุดเดิมผสมสองนิยามในตารางเดียว (Recall จาก ALLOWED ส่วนที่เหลือจาก ALL) จึงไม่ใช่ตารางสับสนที่สอดคล้องกัน — ดู 2.10. ค่าชุด `ALL` ยังเก็บไว้เทียบใน 2.6 และ 2.10

ที่มา: `eval/tools/score.py` (ดูหมายเลขบรรทัดข้างบน), `objective1/accuracy/obj1_accuracy.py` (docstring และบล็อกตรวจ MISMATCH), `objective1/accuracy/accuracy_output.txt`, `RESULTS-TEMPLATE.md:107, 128-143`.

### 2.6 กรณี V06_full: ผลของสองนิยาม และ Keep Violation

**กรณีนี้เป็นที่มาเดียวของส่วนต่างทั้งหมดระหว่างนิยาม ALL กับ ALLOWED ในชุด 6 กรณี** (ตั้งแต่ 2026-10-08 บทนี้ใช้คอลัมน์ ALLOWED เป็นค่าหลัก — ดู 2.10)

| รอบ | Recall ALLOWED % (= ค่าที่ใช้) | Recall ALL % (นับ TANGENT ด้วย) | Precision ALL % (ชุดเดิม) | Precision ALLOWED % (= ค่าที่ใช้) | Accuracy ALL % (ชุดเดิม) | Accuracy ALLOWED % (= ค่าที่ใช้) | Keep Violation (วินาที) |
|---|---|---|---|---|---|---|---|
| rep1/after | 82.33 | 51.04 | 85.35 | 30.37 | 77.80 | 82.48 | 5.00 |
| rep1/control-old | 59.40 | 45.99 | 78.75 | 22.44 | 74.45 | 79.13 | 5.80 |
| rep2/after | 54.07 | 44.81 | 78.39 | 20.86 | 74.02 | 78.70 | 6.00 |
| rep2/control-old | 70.20 | 48.37 | 84.66 | 27.10 | 76.77 | 81.45 | 5.00 |
| **เฉลี่ย (n=4)** | 66.50 | 47.55 | 81.78 | 25.19 | 75.76 | 80.44 | 5.45 |

- **Recall สองนิยาม:** ALLOWED = 66.50% (ค่าที่เผยแพร่ 66.5% — `RESULTS-TEMPLATE.md:89`) ; ALL = 47.55% (ค่าที่ไฟล์ระบุ 47.6% — `RESULTS-TEMPLATE.md:117, 134`). สาเหตุตามไฟล์: เฉลย V06 มี TANGENT 52–105 วินาที ซึ่งโหมด full ไม่อนุญาตให้ตัดจึงไม่อยู่ใน denominator ของ ALLOWED (`RESULTS-TEMPLATE.md:128-129`).
- **Keep Violation ที่ถูกต้องจากไฟล์ผล:** รายรอบ 5.00, 5.80, 6.00, 5.00 วินาที → เฉลี่ย **5.45 วินาที** [คำนวณเอง = 5.00+5.80+6.00+5.00 หาร 4] ; ตรงกับ `objective1/metrics_combined.json` (ค่ารายรอบเท่ากัน). **ไม่ตรงกับ** `RESULTS-TEMPLATE.md:89` ที่ระบุ **5.7 วินาที** — ไม่พบวิธีรวมค่ารายรอบที่ให้ 5.7 (ค่ามัธยฐาน 5.40, ค่าสูงสุด 6.00) [ตรวจเอง] ; ช่วง SHOULD_KEEP ของ V06 = 1:51–1:57 (6.0 วินาที) จึงตัดทับได้สูงสุด 6.0 วินาที.

ที่มา: `objective1/accuracy/accuracy_raw.json` (ฟิลด์ `ALL`, `ALLOWED`, `ref`) ; `objective1/metrics_combined.json` ; `RESULTS-TEMPLATE.md:89, 117, 128-143` ; เฉลย `eval/V06/ground_truth.txt`.

### 2.7 รอบที่ล้มเหลวทั้งหมดและการนับรวมในค่าเฉลี่ย

**Objective 1** (รวมรอบ rep3 ที่ไม่อยู่ใน `metrics_combined.json`):

| รอบ | กรณี | สาเหตุจาก `harness.log` | นับรวมในค่าเฉลี่ย? |
|---|---|---|---|
| rep2/after | V07_full | โควตา Gemini หมด (429 RESOURCE_EXHAUSTED) — พบ "quota exceeded" 8 ครั้ง ครบ 4 key (`eval/final-evaluation/objective1/rep2/after/V07_full/harness.log`) | **ไม่** — ไม่มี `preview.json` จึงไม่มีเมตริก |
| rep3/after | V07_full | โควตา `gemini-2.5-flash` หมด (12 ครั้ง) + `gemini-3.6-flash` ไม่ว่าง (503 UNAVAILABLE, overloaded 4 ครั้ง) ครบ 4 key (`eval/final-evaluation/objective1/rep3/after/V07_full/harness.log`) | **ไม่** — ไม่มี `preview.json` จึงไม่มีเมตริก |
| rep3/control-old | V07_full | โควตา `gemini-2.5-flash` หมด (12 ครั้ง) + `gemini-3.6-flash` ไม่ว่าง (503 UNAVAILABLE, overloaded 4 ครั้ง) ครบ 4 key (`eval/final-evaluation/objective1/rep3/control-old/V07_full/harness.log`) | **ไม่** — ไม่มี `preview.json` จึงไม่มีเมตริก |
| rep2/* | V03_full, V05_full, V01_full | `NOT RUN` ใน `metrics_combined.json` (ไม่ได้รัน ไม่ใช่ล้มเหลว — `RESULTS-TEMPLATE.md:185`) | ไม่ |

**Objective 2 (เสียงล้วน)** — รอบที่ไม่มี `preview.json` (13 รัน) :

| รอบ | กรณี | สาเหตุจาก `harness.log` | นับรวม? |
|---|---|---|---|
| rep1/after | V02_full | โควตา "quota exceeded" 2 ครั้ง + "invalid key" 1 ครั้ง จากทั้งหมด 3 key (`eval/final-evaluation/objective2/rep1/after/V02_full/harness.log`) | **ไม่** |
| rep1/after | V03_full | โควตา "quota exceeded" 2 ครั้ง + "invalid key" 1 ครั้ง จากทั้งหมด 3 key (`eval/final-evaluation/objective2/rep1/after/V03_full/harness.log`) | **ไม่** |
| rep1/after | V03_summary | โควตา "quota exceeded" 4 ครั้ง + "invalid key" 2 ครั้ง จากทั้งหมด 3 key ; ข้อความสุดท้าย 429 RESOURCE_EXHAUSTED (`eval/final-evaluation/objective2/rep1/after/V03_summary/harness.log`) | **ไม่** |
| rep1/after | V04_full | โควตา "quota exceeded" 2 ครั้ง + "invalid key" 1 ครั้ง จากทั้งหมด 3 key (`eval/final-evaluation/objective2/rep1/after/V04_full/harness.log`) | **ไม่** |
| rep1/after | V06_full | โควตา "quota exceeded" 2 ครั้ง + "invalid key" 1 ครั้ง จากทั้งหมด 3 key (`eval/final-evaluation/objective2/rep1/after/V06_full/harness.log`) | **ไม่** |
| rep1/after | V06_summary | โควตา "quota exceeded" 4 ครั้ง + "invalid key" 2 ครั้ง จากทั้งหมด 3 key ; ข้อความสุดท้าย 429 RESOURCE_EXHAUSTED (`eval/final-evaluation/objective2/rep1/after/V06_summary/harness.log`) | **ไม่** |
| rep1/after | V07_full | โควตา "quota exceeded" 4 ครั้ง + "invalid key" 2 ครั้ง จากทั้งหมด 3 key ; ข้อความสุดท้าย 429 RESOURCE_EXHAUSTED (`eval/final-evaluation/objective2/rep1/after/V07_full/harness.log`) | **ไม่** |
| rep1/control-old | V02_full | โควตา "quota exceeded" 2 ครั้ง + "invalid key" 1 ครั้ง จากทั้งหมด 3 key (`eval/final-evaluation/objective2/rep1/control-old/V02_full/harness.log`) | **ไม่** |
| rep1/control-old | V03_full | โควตา "quota exceeded" 2 ครั้ง + "invalid key" 1 ครั้ง จากทั้งหมด 3 key (`eval/final-evaluation/objective2/rep1/control-old/V03_full/harness.log`) | **ไม่** |
| rep1/control-old | V03_summary | โควตา "quota exceeded" 4 ครั้ง + "invalid key" 2 ครั้ง จากทั้งหมด 3 key ; ข้อความสุดท้าย 429 RESOURCE_EXHAUSTED (`eval/final-evaluation/objective2/rep1/control-old/V03_summary/harness.log`) | **ไม่** |
| rep1/control-old | V06_full | โควตา "quota exceeded" 2 ครั้ง + "invalid key" 1 ครั้ง จากทั้งหมด 3 key (`eval/final-evaluation/objective2/rep1/control-old/V06_full/harness.log`) | **ไม่** |
| rep1/control-old | V06_summary | โควตา "quota exceeded" 4 ครั้ง + "invalid key" 2 ครั้ง จากทั้งหมด 3 key ; ข้อความสุดท้าย 429 RESOURCE_EXHAUSTED (`eval/final-evaluation/objective2/rep1/control-old/V06_summary/harness.log`) | **ไม่** |
| rep1/control-old | V07_full | โควตา "quota exceeded" 4 ครั้ง + "invalid key" 2 ครั้ง จากทั้งหมด 3 key ; ข้อความสุดท้าย 429 RESOURCE_EXHAUSTED (`eval/final-evaluation/objective2/rep1/control-old/V07_full/harness.log`) | **ไม่** |

สรุป: Objective 1 มีรอบที่ล้มเหลวจริง 3 รอบ (rep2/after V07_full 1 + rep3 V07_full 2) ; Objective 2 มี 13 รอบ (key#2 "invalid key" และ key อื่นหมดโควตา). 

**รอบที่ "สำเร็จแต่ Gemini เสนอตัด 0 วินาที"** (ไม่ใช่ความล้มเหลว — **นับรวมในค่าเฉลี่ย** โดย Recall = 0.00 ถ้าเฉลยอนุญาตให้ตัด และ Precision = N/A):

| เงื่อนไข | รอบ | กรณี | ผลต่อค่าเฉลี่ย |
|---|---|---|---|
| เสียง+ภาพ (Obj.1) | rep2/after | V04_full | Recall 0.00 ถูกนับในค่าเฉลี่ย ; Precision/F1 = N/A ถูกข้าม |
| เสียง+ภาพ (Obj.1) | rep2/control-old | V03_summary | Recall 0.00 ถูกนับในค่าเฉลี่ย ; Precision/F1 = N/A ถูกข้าม |
| เสียงล้วน (Obj.2) | rep2/after | V02_full | Recall 0.00 ถูกนับในค่าเฉลี่ย ; Precision/F1 = N/A ถูกข้าม |
| เสียงล้วน (Obj.2) | rep2/control-old | V03_summary | Recall 0.00 ถูกนับในค่าเฉลี่ย ; Precision/F1 = N/A ถูกข้าม |
| เสียงล้วน (Obj.2) | rep2/control-old | V04_full | Recall 0.00 ถูกนับในค่าเฉลี่ย ; Precision/F1 = N/A ถูกข้าม |

**อ้างอิง V07 รอบแรกที่ล้มเหลวในการรันผ่าน worker (ไม่ใช่ harness):** งาน `6696c59e` ใน `eval/V07/worker.log` ล้มด้วย `[FAILURE] AI ไม่สามารถระบุช่วงที่ควรเก็บได้` เพราะตัวกรอง VAD รุ่นเก่าทิ้งทั้ง 2 ท่อน (`[VAD Pre-filter] Removed 2 silent segments, kept 0/2`) — เป็นข้อมูล baseline รอบ 2026-09-21 ไม่นับรวมในเมตริกใด ๆ (ดู 5.3 ; สาเหตุตาม `RESULTS-TEMPLATE.md:388-394`).

ที่มา: `harness.log` ตามเส้นทางในตาราง, `objective1/metrics_combined.json`, `objective2/metrics_combined.json`, `RESULTS-TEMPLATE.md:160-166`, `eval/V07/worker.log`.

**หมายเหตุ model mismatch:** รอบ `rep1/control-old` ของ V03_summary (Obj.1) ตอบสำเร็จบน `gemini-3.6-flash` ไม่ใช่ `gemini-2.5-flash` (`RESULTS-TEMPLATE.md:179`, `QUALITATIVE-REASON-ANALYSIS.md:18`) — นับรวมในค่าเฉลี่ยทุกตารางข้างบน.

### 2.8 แยก Recall ตามประเภท/ความยาวช่วง นับรายช่วง และที่มาของวินาทีที่ตัดไม่ครบ (วิเคราะห์เพิ่ม 2026-10-06)

คำนวณจาก `preview.json` เดิมของ 27 รอบ (ไม่เรียก Gemini ไม่แก้เฉลย) [คำนวณเอง]

**นิยามและสูตร:** ช่วงที่ระบบตัด = ช่องว่างระหว่าง `selected_segments` ใน [0, จุดจบ transcript] (เหมือน `score.py`) ; 1 instance = 1 ช่วงในเฉลย × 1 รอบ ; hit = วินาทีที่ระบบตัดทับช่วงนั้น ; Recall = Σhit ÷ Σความยาวเฉลย รวมทุกรอบ (pooled — ไม่ใช่ค่าเฉลี่ยรายกรณี 61.65) ; "ตัดได้ ≥ ครึ่งช่วง" = hit ≥ 0.5 × ความยาว ; วินาทีที่ตัดไม่ครบ = **ไม่ตัดเลย** (hit = 0) + **ขอบแคบกว่าเฉลย** (0 < hit < ความยาว) ; ใช้นิยาม **ALLOWED** (ตรงกับ Recall เดิม — ไม่นับนอกประเด็นในโหมด full) และแสดง ALL ประกอบ. ตรวจซ้ำ: Recall รวม ALLOWED = 64.58 เท่ากับ Pooled Recall ในหัวข้อ 2.3

**a) Recall แยกตามประเภท (ALLOWED)**

| ประเภท | instance | วินาทีในเฉลย | ตัดได้ (วินาที) | Recall % |
|---|---|---|---|---|
| ช่วงเงียบ (SILENCE) | 17 | 173.00 | 151.28 | 87.45 |
| พูดผิดแล้วเริ่มใหม่ (RETAKE) | 20 | 204.00 | 94.24 | 46.20 |
| นอกประเด็น (TANGENT, โหมด summary) | 8 | 384.00 | 245.94 | 64.05 |
| FILLER / TECH | 0 | — | — | ไม่มีในเฉลย |

นิยาม ALL (นับนอกประเด็นในโหมด full ด้วย): TANGENT 14 instance, 682.00 วินาที, Recall 49.18 ; รวมทั้งหมด 54.85

**b) Recall แยกตามความยาวช่วงในเฉลย**

| ความยาว | instance | วินาทีในเฉลย | Recall % |
|---|---|---|---|
| < 5 วินาที | 0 | — | ไม่มีข้อมูล (ไม่มีช่วงในเฉลยที่สั้นกว่า 5 วินาที) |
| ≥ 5 วินาที | 45 | 761.00 | 64.58 |
| *(เสริม) = 5.0 วินาทีพอดี* (V02 46–51, V04 104–109) | 8 | 40.00 | 0.00 (ไม่ถูกตัดเลยทุกรอบ) |
| *(เสริม) > 5 วินาที* | 37 | 721.00 | 68.16 |

**c) นับเป็นรายช่วง (12 ช่วงไม่ซ้ำ ; ALLOWED)**

| กรณี | ตัดได้ ≥ ครึ่งช่วง | วินาทีที่ตัดได้ต่อรอบ |
|---|---|---|
| V02_full | 4/8 | 84–90 (6 วิ): 5.57 ทุกรอบ ; 46–51 (5 วิ): 0 ทุกรอบ |
| V03_summary | 3/4 | 43–86 (43 วิ): 43.00 / 41.56 / 24.90 / 0 |
| V04_full | 4/12 | 47–55: 4.79 / 6.21 / 0 / 0 ; 67–75: 0 / 4.79 / 0 / 7.27 ; 104–109: 0 ทุกรอบ |
| V06_full | 4/4 | RETAKE 25–40 (15 วิ): 12.35 / 8.91 / 8.11 / 10.53 (TANGENT 52–105 ไม่นับ: 22.36 ทุกรอบ) |
| V06_summary | 5/8 | RETAKE 25–40: 0 / 8.91 / 14.13 / 8.24 ; TANGENT 52–105 (53 วิ): 22.36 / 45.88 / 45.88 / 22.36 |
| V07_full | 9/9 | ทุกช่วงตัดได้ครบทุกรอบ |
| **รวม** | **29/45** (ALL: 29/51) | |

**d) ที่มาของวินาทีที่ตัดไม่ครบ (ALLOWED)**

| กรณี | ตัดไม่ครบ (วินาที) | ช่วงสั้นกว่า 5 วิ | ขอบแคบกว่าเฉลย | ไม่ตัดเลย |
|---|---|---|---|---|
| V02_full | 21.72 | 0.00 | 1.72 | 20.00 |
| V03_summary | 62.54 | 0.00 | 19.54 | 43.00 |
| V04_full | 60.94 | 0.00 | 8.94 | 52.00 |
| V06_full | 20.10 | 0.00 | 20.10 | 0.00 |
| V06_summary | 104.24 | 0.00 | 89.24 | 15.00 |
| V07_full | 0.00 | 0.00 | 0.00 | 0.00 |
| **รวม** | **269.54** | **0.00 (0.00%)** | **139.54 (51.77%)** | **130.00 (48.23%)** |

นิยาม ALL: ตัดไม่ครบรวม 478.10 วินาที = ขอบแคบ 262.10 + ไม่ตัดเลย 216.00 (ส่วนเพิ่มจาก V03_full ไม่ตัดเลย 86.00 และ V06_full ขอบแคบ 142.66)

**ข้อจำกัด:** "ขอบแคบกว่าเฉลย" รวมทุกกรณีที่ตัดได้บางส่วน ไม่แยกว่าขาดที่ขอบหน้า ขอบหลัง หรือกลางช่วง ; เฉลยจดเวลาเป็นวินาทีเต็ม ส่วนต่างที่ขอบเล็ก ๆ (เช่น V02 84–90 ขาด 0.43 วินาที/รอบ) อยู่ในระดับความละเอียดของเฉลย ; 3–4 รอบต่อกรณี

ที่มา: `objective1/rep*/*/*/preview.json`, `eval/V0x/ground_truth.txt` ; สคริปต์ `objective1/accuracy/obj1_breakdown.py` ; ผลพิมพ์ `objective1/accuracy/obj1_breakdown_output.txt`

### 2.9 สาเหตุที่ช่วงในเฉลยตัดไม่ได้/ตัดได้บางส่วน — แยกทีละรอบ (วิเคราะห์เพิ่ม 2026-10-06)

อ่าน `harness.log` + `preview.json` เดิมของ 27 รอบ (ไม่เรียก Gemini ไม่แก้เฉลย ไม่แก้โค้ดระบบ) [คำนวณเอง] ; **ผู้ใช้ตัดสินแล้ว (2026-10-06): ไม่แก้วิธีตัด ไม่รัน V01–V07 ใหม่** — หัวข้อนี้เป็นการอธิบายผล ไม่ใช่ข้อเสนอให้แก้

**นิยาม (นิยาม ALLOWED):** F = ช่วงที่ระบบตัดในผลสุดท้าย ; R = ข้อเสนอของ Gemini ที่พิมพ์ในล็อก (`🔴 [conf] s → e (d) — reason` — พิมพ์หลังตัวคืนเสียงพูดที่ถอดไม่ออกของโหมด full แต่ก่อน Step 5 และ guard) ; วินาทีในเฉลยที่ไม่อยู่ใน F แบ่งเป็น
- **ก) Gemini ไม่ได้เสนอ** — ไม่อยู่ในข้อเสนอใด
- **ข) ถูกทิ้งเพราะยาว ≤ 5 วินาที** — อยู่เฉพาะในข้อเสนอที่ยาว ≤ 5.0 วิ (`ai_logic.py:2693` `if end <= start + 5.0: continue` — ช่วงยาวพอดี 5.0 ก็ถูกทิ้ง ทั้งที่คอมเมนต์เขียน "สั้นกว่า 5")
- **ค) ถูกหด/ยกเลิกหลัง Gemini** — อยู่ในข้อเสนอที่ยาวเกิน 5 วิ แต่ผลสุดท้ายไม่ได้ตัด (การ snap ขอบใน Step 5 หรือ `_snap_segments_to_sentences` — แยกสองตัวนี้จากล็อกไม่ได้ เพราะ Step 5 ไม่พิมพ์ล็อก)
- **ง) อื่น ๆ** — ไม่พบ (`[Unreadable]` ทำงานเฉพาะ V01 ซึ่งไม่มีเฉลย ; ตัวตัดเทคซ้ำในโค้ดไม่เคยทำงานกับ V04 — `grep Retake` = 0 ทั้ง 4 รอบ)

**สรุปตามสาเหตุ**

| สาเหตุ | instance | วินาที | สัดส่วน |
|---|---|---|---|
| ก) Gemini ไม่ได้เสนอ | 34 | 260.21 | 96.54% |
| ข) ถูกทิ้งเพราะยาว ≤ 5 วิ | 1 | 3.89 | 1.44% |
| ค) ถูกหด/ยกเลิกหลัง Gemini | 12 | 5.44 | 2.02% |
| ง) อื่น ๆ | 0 | 0.00 | 0.00% |
| **รวม** | | **269.54** | ตรงกับยอด "ตัดไม่ครบ" ในหัวข้อ 2.8 |

**แยกตามประเภท** (instance / วินาที)

| ประเภท | ตัดไม่ครบ (วินาที) | ก | ข | ค |
|---|---|---|---|---|
| พูดผิดแล้วเริ่มใหม่ (ไม่รวมช่วง 5.0 วิ) | 89.76 | 16 / 81.87 | 1 / 3.89 | 11 / 4.00 |
| V04 104–109 (RETAKE ยาวพอดี 5.0 วิ) | 20.00 | 4 / 20.00 | 0 | 0 |
| V02 46–51 (SILENCE ยาวพอดี 5.0 วิ) | 20.00 | 4 / 20.00 | 0 | 0 |
| ช่วงเงียบอื่น (V02 84–90) | 1.72 | 4 / 1.72 | 0 | 0 |
| นอกประเด็น (โหมด summary) | 138.06 | 6 / 136.62 | 0 | 1 / 1.44 |

**ทีละรอบ: พูดผิดแล้วเริ่มใหม่ และ 2 ช่วงที่ยาวพอดี 5 วินาที** (`Lxx` = เลขบรรทัดใน `objective1/<รอบ>/<กรณี>/harness.log`)

| กรณี / รอบ | ช่วงในเฉลย | ตัดไม่ครบ (วิ) | สาเหตุ (วิ) | หลักฐาน |
|---|---|---|---|---|
| V02 ทั้ง 4 รอบ | 46–51 | 5.00 × 4 | ก 5.00 | ไม่มีข้อเสนอทับ ; hint ช่วงเงียบจาก VAD มีเพียง 47.4–51.5 (4.2 วิ) `rep1/after/V02_full/harness.log:9` — ต่อให้ Gemini เสนอตาม hint ก็ยาว ≤ 5 วิ ถูก Step 5 ทิ้ง |
| V04 rep1/after | 47–55 | 3.21 | ก 2.56 + ค 0.65 | เสนอ 49.56–57.54 (L25) ; `[Snap]` ; ผลเก็บ 0–50.21 (L34) |
| V04 rep1/after | 67–75 | 8.00 | ก 4.11 + ข 3.89 | เสนอ 71.11–75.72 (4.61 วิ "ช่วงเงียบ" L27) ถูกทิ้งที่ Step 5 |
| V04 rep1/control-old | 47–55 / 67–75 | 1.79 / 3.21 | ก 1.73 + ค 0.06 / ก 2.96 + ค 0.25 | เสนอ 43.70–53.27 (L30), 69.96–75.72 (L31) |
| V04 rep2/after | 47–55 / 67–75 / 104–109 | 8.00 / 8.00 / 5.00 | ก ทั้งหมด | `AI Suggested Cuts (0 segments` (L24) |
| V04 rep2/control-old | 47–55 | 8.00 | ก 6.00 + ค 2.00 | เสนอ 53.00–61.91 (L30) แต่ผลเก็บ 8.38–58.69 (L39) — ขั้นขยายขอบให้จบประโยคดึงขอบช่วงที่เก็บไปถึง 58.69 ส่วน 53–55 ที่ทับเฉลยจึงหาย |
| V04 rep2/control-old | 67–75 | 0.73 | ก 0.40 + ค 0.33 | เสนอ 67.40–75.72 (L31) |
| V04 rep1 ×2, rep2/control-old | 104–109 | 5.00 × 3 | ก 5.00 | ไม่มีข้อเสนอทับช่วงนี้ |
| V06_full 4 รอบ | 25–40 | 2.65 / 6.09 / 6.89 / 4.47 | ก ส่วนใหญ่ ; ค ≤ 0.47 | Gemini เริ่ม 26.48 ทุกรอบ แต่จบ 38.23 / 35.25 / 34.00 / 36.48 (เฉลยจบ 40) |
| V06_summary rep1/after | 25–40 | 15.00 | ก 15.00 | มีข้อเสนอเดียว 86.97–101.52 (L48) |
| V06_summary อีก 3 รอบ | 25–40 | 6.09 / 0.87 / 6.76 | ก ส่วนใหญ่ | ขอบที่เสนอแคบกว่าเฉลย |

**ข้อเสนอที่ยาว ≤ 5 วิ ทั้งหมด (ถูก Step 5 ทิ้ง) และประมาณการถ้าไม่ทิ้ง** — มี 6 รายการ (V04 ×3, V06_full ×3) ทับเฉลย 3.89 วิ อยู่นอกเฉลย 20.51 วิ (ทั้งหมดเป็น "ช่วงเงียบ"/"เตรียมงานก่อนเริ่ม" — อาจเป็นช่วงเงียบจริงที่ไม่ได้ลงในเฉลย บอกจากไฟล์ไม่ได้) → ถ้าไม่ทิ้ง Pooled Recall 64.58 → 65.09 แต่ Pooled Precision 85.15 → 82.76 (ประมาณการจากข้อเสนอเดิม ค่าก่อน guard ไม่ได้รันใหม่) ; ไม่มีข้อเสนอที่ยาวพอดี 5.0 วิ จึงการเปลี่ยน `<=` เป็น `<` จะไม่เปลี่ยนผลชุดนี้

**สิ่งที่บอกไม่ได้จากไฟล์:** เหตุผลที่ Gemini ไม่เสนอ (ล็อกมีเหตุผลเฉพาะช่วงที่เสนอ) ; เหตุผลที่ตัวตัดเทคซ้ำไม่จับ V04 (ต้องรันฟังก์ชันกับ transcript แบบออฟไลน์ — ไม่ได้ทำ) ; สาเหตุ ค แยกระหว่าง snap ใน Step 5 กับ guard ไม่ได้

ที่มา: `objective1/rep*/*/*/harness.log`, `objective1/rep*/*/*/preview.json`, `eval/V0x/ground_truth.txt`, `backend/core/ai_logic.py:2693` ; สคริปต์ `objective1/accuracy/obj1_miss_cause.py` ; ผลพิมพ์ `objective1/accuracy/obj1_miss_cause_output.txt`

### 2.10 ตาราง TP / FP / FN / TN เป็นวินาที และเหตุผลที่เลือกนิยาม ALLOWED (เพิ่ม 2026-10-08)

**นิยามของบวก/ลบ และหน่วยที่นับ**

- **หน่วยนับ = วินาทีบนแกนเวลาของคลิป** (ไม่ใช่ "จำนวนช่วง" และไม่ใช่เฟรม) — หนึ่งหน่วยตัวอย่างคือหนึ่งวินาทีของคลิป
- **Universe (U)** = `[0, จุดจบ transcript]` ของแต่ละรอบ ; ผลรวม U ของ 6 กรณี = 806.46 วินาที
- **คลาสบวก (positive) = "วินาทีที่ควรตัดทิ้ง"** ตามเฉลย (`SHOULD_CUT` ใน `ground_truth.txt`) ; **คลาสลบ (negative) = "วินาทีที่ควรเก็บไว้"**
- **การทำนายของระบบ** = วินาทีที่ระบบตัดจริง (C) คือช่องว่างระหว่าง `selected_segments` — นิยามเดียวกับ `score.py`

| ช่อง | ความหมาย | สูตร |
|---|---|---|
| TP | ควรตัด และระบบตัด | \|C ∩ P\| |
| FP | ไม่ควรตัด แต่ระบบตัด | \|C\| − TP |
| FN | ควรตัด แต่ระบบเก็บไว้ | \|P\| − TP |
| TN | ไม่ควรตัด และระบบเก็บไว้ | \|U\| − \|C ∪ P\| |

สูตรตัวชี้วัด: Precision = TP/(TP+FP) · Recall = TP/(TP+FN) · F1 = 2·P·R/(P+R) · Accuracy = (TP+TN)/U · Specificity = TN/(TN+FP)

**P (ชุดวินาทีที่ควรตัด) มี 2 นิยามใน `score.py`** — ต่างกันเฉพาะโหมด `full` ของคลิปที่เฉลยมี `TANGENT`:
`ALL` = `SHOULD_CUT` ทุกประเภท (ตัวส่วนของ **Precision** เดิม) · `ALLOWED` = เฉพาะประเภทที่โหมดนั้นอนุญาต (ตัวส่วนของ **Recall** เดิม ; โหมด full ไม่อนุญาต `TANGENT` จึงถือว่า "ควรเก็บ")
ในชุด 6 กรณีนี้ **มีเพียง V06_full ที่สองนิยามให้ตัวเลขต่างกัน** (เฉลย V06 มี TANGENT 52–105 วินาที — ดู 2.6)

#### ก. Objective 1 (เงื่อนไข B เสียง+ภาพ) — วินาที, เฉลี่ยต่อรอบของกรณีนั้น

| กรณี | n | TP | FP | FN | TN | U | Precision % | Recall % | F1 % | Accuracy % | Specificity % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V02_full | 4 | 5.57 | 0.23 | 5.43 | 99.60 | 110.83 | 96.03 | 50.64 | 66.31 | 94.89 | 99.77 |
| V03_summary | 4 | 27.37 | 2.56 | 15.63 | 58.38 | 103.94 | 92.32 | 63.64 | 86.87 | 82.49 | 95.80 |
| V04_full | 4 | 5.77 | 4.70 | 15.23 | 117.54 | 143.24 | 56.55 | 27.45 | 43.54 | 86.08 | 96.15 |
| V06_full (ALL) | 4 | 32.33 | 7.19 | 35.67 | 101.60 | 176.79 | 81.78 | 47.55 | 60.13 | 75.76 | 93.39 |
| V06_full (ALLOWED) | 4 | 9.97 | 29.55 | 5.03 | 132.24 | 176.79 | 25.19 | 66.50 | 36.54 | 80.44 | 81.74 |
| V06_summary | 4 | 41.94 | 8.09 | 26.06 | 100.70 | 176.79 | 82.02 | 61.68 | 68.79 | 80.68 | 92.56 |
| V07_full | 3 | 43.00 | 3.40 | 0.00 | 48.47 | 94.87 | 92.67 | 100.00 | 96.20 | 96.42 | 93.45 |
| **รวม 6 กรณี (ALL)** | 23 | **155.97** | **26.17** | **98.03** | **526.29** | **806.46** | 85.63 | 61.41 | 71.52 | 84.60 | 95.26 |
| **รวม 6 กรณี (ALLOWED)** | 23 | **133.62** | **48.53** | **67.39** | **556.93** | **806.46** | 73.36 | 66.48 | 69.75 | 85.63 | 91.98 |

แถว "รวม" คือผลบวกวินาทีของทุกกรณี และตัวชี้วัดในแถวนั้นคำนวณจากผลรวมนั้นโดยตรง (micro) จึงไม่เท่ากับค่าเฉลี่ยรายกรณี (macro) ด้านล่าง

#### ข. Objective 2 (เงื่อนไข A เสียงล้วน) — วินาที, เฉลี่ยต่อรอบของกรณีนั้น

| กรณี | n | TP | FP | FN | TN | U | Precision % | Recall % | F1 % | Accuracy % | Specificity % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| V02_full | 2 | 2.78 | 0.12 | 8.22 | 99.72 | 110.83 | 96.03 | 25.32 | 66.31 | 92.48 | 99.88 |
| V03_summary | 2 | 15.81 | 0.64 | 27.19 | 60.30 | 103.94 | 96.11 | 36.77 | 83.32 | 73.22 | 98.95 |
| V04_full | 3 | 5.71 | 2.68 | 15.29 | 119.56 | 143.24 | 75.17 | 27.21 | 51.22 | 87.46 | 97.81 |
| V06_full (ALL) | 2 | 31.59 | 7.24 | 36.41 | 101.55 | 176.79 | 81.27 | 46.46 | 59.11 | 75.31 | 93.34 |
| V06_full (ALLOWED) | 2 | 9.23 | 29.60 | 5.77 | 132.19 | 176.79 | 23.66 | 61.53 | 34.17 | 79.99 | 81.70 |
| V06_summary | 2 | 39.65 | 10.32 | 28.35 | 98.47 | 176.79 | 79.81 | 58.31 | 66.07 | 78.13 | 90.51 |
| V07_full | 2 | 43.00 | 3.40 | 0.00 | 48.47 | 94.87 | 92.67 | 100.00 | 96.20 | 96.42 | 93.45 |
| **รวม 6 กรณี (ALL)** | 13 | **138.55** | **24.39** | **115.45** | **528.07** | **806.46** | 85.03 | 54.55 | 66.46 | 82.66 | 95.58 |
| **รวม 6 กรณี (ALLOWED)** | 13 | **116.19** | **46.76** | **84.81** | **558.71** | **806.46** | 71.31 | 57.81 | 63.85 | 83.69 | 92.28 |

#### ค. ค่าเฉลี่ยรายกรณี (macro ± S.D. ระหว่างกรณี) ทั้งสองนิยาม

| ชุด | นิยาม P | Precision % | Recall % | F1 % | Accuracy % | Specificity % |
|---|---|---|---|---|---|---|
| Obj.1 (B) | ALL | 83.56 ± 13.23 | 58.49 ± 22.00 | 70.31 ± 17.24 | 86.05 ± 7.45 | 95.19 ± 2.43 |
| Obj.1 (B) | **ALLOWED (ใช้จริงตั้งแต่ 2026-10-08)** | **74.13 ± 25.56** | **61.65 ± 21.56** | **66.37 ± 21.32** | **86.84 ± 6.52** | **93.24 ± 5.64** |
| Obj.1 (B) | ผสม (ที่เคยรายงานก่อน 2026-10-08) | **83.56 ± 13.23** | **61.65 ± 21.56** | **72.46 ± 16.63** | **86.05 ± 7.45** | **95.19 ± 2.43** |
| Obj.2 (A) | ALL | 86.85 ± 8.38 | 49.01 ± 25.43 | 70.37 ± 15.07 | 83.84 ± 8.79 | 95.66 ± 3.42 |
| Obj.2 (A) | **ALLOWED (ใช้จริงตั้งแต่ 2026-10-08)** | **77.24 ± 25.26** | **51.52 ± 25.79** | **66.21 ± 20.18** | **84.62 ± 8.19** | **93.72 ± 6.28** |
| Obj.2 (A) | ผสม (ที่เคยรายงานก่อน 2026-10-08) | **86.85 ± 8.38** | **51.52 ± 25.79** | **72.09 ± 14.26** | **83.84 ± 8.79** | **95.66 ± 3.42** |

#### ง. ผลการตรวจกับตัวเลขชุดเดิม (ก่อนเปลี่ยนนิยาม)

| ตัวเลขที่ถาม (จาก 2.3) | ตรงกับตารางไหน | ผล |
|---|---|---|
| Recall 61.65 | macro **ALLOWED** | **ตรง** (61.65 ± 21.56) |
| Precision 83.56 | macro **ALL** | **ตรง** (83.56 ± 13.23) |
| Accuracy 86.05 | macro **ALL** | **ตรง** (86.05 ± 7.45) |
| Specificity 95.19 | macro **ALL** | **ตรง** (95.19 ± 2.43) |
| F1 72.46 ± 16.63 (2.3) | macro **ผสม** | **ตรง** |
| Obj.2 A: F1 72.09 / Acc 83.84 / Spec 95.66 (3.2) | macro **ผสม** / **ALL** | **ตรง** |

#### จ. ข้อตัดสินใจ (2026-10-08): ใช้ `ALLOWED` ทั้งชุด

ตัวเลขชุดเดิมที่เคยเผยแพร่ **ไม่ได้มาจากตารางสับสน (confusion matrix) ชุดเดียวกัน** — Recall มาจาก `ALLOWED` ส่วน Precision/Accuracy/Specificity มาจาก `ALL` (ข้อตกลง 2026-10-01, `RESULTS-TEMPLATE.md:107`) จึงอธิบายเป็นตารางเดียวไม่ได้

**ตั้งแต่ 2026-10-08 บทนี้ใช้ `ALLOWED` ชุดเดียวทุกตัวชี้วัด** (แถว ALLOWED ของตาราง ค. คือค่าที่ใช้จริงแล้ว) เหตุผล: `ALLOWED` สอดคล้องกับสเปกของโหมด — ในโหมด `full` ระบบ **ถูกห้าม** ตัด TANGENT (CLAUDE.md §6) การนับช่วง TANGENT เป็น "ควรตัด" จึงลงโทษระบบในสิ่งที่ออกแบบให้ไม่ทำ

ผลของการเปลี่ยน (ขยับเฉพาะ **V06_full** และ **V03_full** ซึ่งเป็นสองคลิปที่เฉลยมี TANGENT ; กรณีอื่นไม่เปลี่ยนเลย):
- V06_full: TP 32.33 → 9.97 และ FP 7.19 → 29.55 วินาที (ช่วง TANGENT 52–105 ย้ายจาก "ควรตัด" ไป "ควรเก็บ") → Precision 81.78 → 25.19 · Accuracy 75.76 → 80.44 · Specificity 93.39 → 81.74
- V03_full: ระบบไม่ตัดอะไรเลยซึ่งตรงสเปกโหมด full → Accuracy 58.63 → 100.00
- macro 6 กรณี: Precision 83.56 → **74.13** · F1 72.46 → **66.37** · Accuracy 86.05 → **86.84** · Specificity 95.19 → **93.24** · baseline 68.63 → **73.63** ; **Recall คงเดิม 61.65**

**ตัวเลขที่ต้องไม่ใช้ปนกันอีก:** 83.56 / 86.05 / 95.19 / 72.46 / 72.09 เป็นค่าตามนิยาม `ALL` (หรือแบบผสม) ซึ่งบทนี้ไม่ใช้เป็นค่าหลักแล้ว — เก็บไว้ในตาราง ค. และหมายเหตุของ 2.3 / 2.4 / 3.2 เพื่อให้ตามรอยไฟล์ผลเดิมได้

**ข้อจำกัด:** TN มีค่าสูงเพราะเวลาส่วนใหญ่ของคลิปเป็น "ควรเก็บ" → **Accuracy ถูกเงินเฟ้อด้วย TN** เทียบกับ baseline แบบไม่ตัดเลยใน 2.4 ก่อนตีความ ; n ต่อกรณีไม่เท่ากัน (2–4 รอบ) และ Precision/F1 ไม่นับรอบที่ระบบเสนอตัด 0 วินาที (ดู 2.7) ; ไม่รวม V01 (ไม่มีเฉลย), V03_full และ V05_full (ระบบไม่ตัดอะไรเลย)

ที่มา: คำนวณซ้ำจาก `objective1/rep*/*/*/preview.json` และ `objective2/rep*/*/*/preview.json` + `eval/V0x/ground_truth.txt` ด้วยสคริปต์ `objective1/accuracy/obj_confusion.py` (ใช้ `parse_gt`/`ALLOWED`/`score` ของ `eval/tools/score.py` เดิม) ; ผลพิมพ์ `objective1/accuracy/confusion_output.txt` · ค่าดิบ `objective1/accuracy/confusion_raw.json` ; สคริปต์ตรวจ Recall/Precision ทุกรอบกับ `score()` เดิม — **MISMATCH = 0** ทั้ง 27 รอบของ Obj.1 และ 17 รอบของ Obj.2

## ส่วน 3 วัตถุประสงค์ข้อ 2 (ผลของข้อมูลภาพ)

เงื่อนไข **A = เสียงอย่างเดียว** (`VISUAL_CONTEXT=0`, ข้อมูลใน `objective2/`) เทียบ เงื่อนไข **B = เสียงร่วมภาพ** (`VISUAL_CONTEXT=1`, ข้อมูลเดียวกับ Objective 1 ใน `objective1/` ตาม `RESULTS-TEMPLATE.md:209`). ทั้งสองเงื่อนไขใช้ transcript baseline เดียวกัน, โมเดลเดียวกัน (`gemini-2.5-flash`), เฉลยเดียวกัน ; ต่างที่ B ส่งคีย์เฟรม 8 ภาพให้ Gemini (log: `🖼️ [Keyframe] ดึงภาพ 8/8 ภาพ`) และ A ไม่มีบรรทัด Keyframe (`QUALITATIVE-REASON-ANALYSIS.md:14-15`).

### 3.1 ตารางเทียบรายกรณี

ค่าเฉลี่ยข้ามรอบ (n = จำนวนรอบที่ค่านั้นนิยามได้) ; **ทุกตัวชี้วัดใช้นิยาม ALLOWED ชุดเดียว** (เปลี่ยนจาก ALL เมื่อ 2026-10-08 — ดู 2.10) ; F1 [คำนวณเอง] ; ทั้ง A และ B คำนวณซ้ำเอง [คำนวณเอง] จาก `preview.json` ด้วยสูตรเดียวกัน (Recall ของทั้งสองเงื่อนไขตรงกับ `metrics_combined.json` ทุกรัน). V06_full A Recall = 61.53 (ค่าเดิมในไฟล์พิมพ์ 61.54 จากการปัด 61.5343 ขึ้น).

| กรณี | เงื่อนไข | จำนวนรอบ | Recall % | Precision % | F1 % | Accuracy % | Specificity % |
|---|---|---|---|---|---|---|---|
| V02_full | A เสียงล้วน | 2 | 25.32 (n=2) | 96.03 (n=1) | 66.31 (n=1) | 92.48 (n=2) | 99.88 (n=2) |
| V02_full | B เสียง+ภาพ | 4 | 50.64 (n=4) | 96.03 (n=4) | 66.31 (n=4) | 94.89 (n=4) | 99.77 (n=4) |
| V03_full | A เสียงล้วน | 2 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 (n=2) | 100.00 (n=2) |
| V03_full | B เสียง+ภาพ | 2 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 (n=2) | 100.00 (n=2) |
| V03_summary | A เสียงล้วน | 2 | 36.77 (n=2) | 96.11 (n=1) | 83.32 (n=1) | 73.22 (n=2) | 98.95 (n=2) |
| V03_summary | B เสียง+ภาพ | 4 | 63.64 (n=4) | 92.32 (n=3) | 86.87 (n=3) | 82.49 (n=4) | 95.80 (n=4) |
| V04_full | A เสียงล้วน | 3 | 27.21 (n=3) | 75.17 (n=2) | 51.22 (n=2) | 87.46 (n=3) | 97.81 (n=3) |
| V04_full | B เสียง+ภาพ | 4 | 27.45 (n=4) | 56.56 (n=3) | 43.54 (n=3) | 86.08 (n=4) | 96.15 (n=4) |
| V05_full | A เสียงล้วน | 2 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 (n=2) | 100.00 (n=2) |
| V05_full | B เสียง+ภาพ | 2 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 100.00 (n=2) | 100.00 (n=2) |
| V06_full | A เสียงล้วน | 2 | 61.53 (n=2) | 23.66 (n=2) | 34.17 (n=2) | 79.99 (n=2) | 81.70 (n=2) |
| V06_full | B เสียง+ภาพ | 4 | 66.50 (n=4) | 25.19 (n=4) | 36.54 (n=4) | 80.44 (n=4) | 81.74 (n=4) |
| V06_summary | A เสียงล้วน | 2 | 58.31 (n=2) | 79.81 (n=2) | 66.07 (n=2) | 78.13 (n=2) | 90.51 (n=2) |
| V06_summary | B เสียง+ภาพ | 4 | 61.68 (n=4) | 82.02 (n=4) | 68.79 (n=4) | 80.68 (n=4) | 92.56 (n=4) |
| V07_full | A เสียงล้วน | 2 | 100.00 (n=2) | 92.67 (n=2) | 96.20 (n=2) | 96.42 (n=2) | 93.45 (n=2) |
| V07_full | B เสียง+ภาพ | 3 | 100.00 (n=3) | 92.67 (n=3) | 96.20 (n=3) | 96.42 (n=3) | 93.45 (n=3) |

ที่มา: A = `objective2/rep*/*/*/preview.json` ; B = `objective1/rep*/*/*/preview.json` ; ทั้งคู่ผ่าน `objective1/accuracy/obj_confusion.py` (นิยาม ALLOWED) ; Recall เทียบกับ `metrics_combined.json` และ `RESULTS-TEMPLATE.md:191-203, 217-224` ตรงกันทุกรอบ ; Precision/F1/Accuracy/Specificity ของ V06_full ต่างจากไฟล์ผลเดิมเพราะเปลี่ยนนิยามจาก ALL เป็น ALLOWED. V01_full: A และ B มี sanity run ไม่มีเฉลย → ไม่มีเมตริก. V03_full/V05_full: Recall/Precision = N/A เหมือนกันทั้งสองเงื่อนไข.

### 3.2 ค่าเฉลี่ยรวมของแต่ละเงื่อนไข (เทียบบนกรณีชุดเดียวกัน)

| ตัวชี้วัด (macro 6 กรณี ± S.D. ระหว่างกรณี) | A เสียงล้วน | B เสียง+ภาพ | ส่วนต่าง B − A (จุด) |
|---|---|---|---|
| Recall % | 51.52 ± 25.79 | 61.65 ± 21.56 | +10.13 |
| Precision % | 77.24 ± 25.26 | 74.13 ± 25.56 | −3.11 |
| F1 % (เฉลี่ยของ F1 รายกรณี) | 66.21 ± 20.18 | 66.37 ± 21.32 | +0.16 |
| Accuracy % | 84.62 ± 8.19 | 86.84 ± 6.52 | +2.22 |
| Specificity % | 93.72 ± 6.28 | 93.24 ± 5.64 | −0.48 |
| F1 % จาก P/R เฉลี่ย | 61.81 | 67.32 | +5.51 |
| Pooled Recall / Precision % | 56.29 / 71.22 | 64.58 / 72.04 | +8.29 / +0.82 |
| จำนวนกรณี | 6 | 6 | — |
| จำนวนรอบที่ใช้ (ใน 6 กรณี) | 13 | 23 | — |
| จำนวนรอบที่มีเมตริกทั้งหมด (รวม V03_full, V05_full) | 17 | 27 | — |

จำนวนรอบรายกรณี (A / B): V02_full 2/4 ; V03_summary 2/4 ; V04_full 3/4 ; V06_full 2/4 ; V06_summary 2/4 ; V07_full 2/3.

**ตารางเสริม [คำนวณเอง] — เทียบเฉพาะรอบ rep2 ของทั้งสองเงื่อนไข** (รอบที่รันช่วงเวลาใกล้กัน ; A rep1 ส่วนใหญ่ล้มเหลว): A rep2 Recall 50.75 / Precision 83.55 / Accuracy 83.59 (12 รอบ) ; B rep2 Recall 54.28 / Precision 80.68 / Accuracy 83.67 (11 รอบ). ส่วนต่าง Recall B−A เมื่อเทียบเฉพาะ rep2 = +3.52 จุด (เทียบ +10.13 จุดเมื่อใช้ทุกรอบ) ; ใช้ดูว่าส่วนต่างยังอยู่หรือไม่เมื่อเทียบรอบที่รันช่วงเวลาเดียวกัน ; ไม่ใช่ตัวเลขที่ไฟล์ผลเผยแพร่.

**ค่าชุดเดิมตามนิยาม ALL (เก็บไว้อ้างอิง):** Precision A 86.85 / B 83.56 (ส่วนต่าง −3.28) · F1 แบบผสม A 72.09 / B 72.46 (+0.37) · Accuracy A 83.84 / B 86.05 (+2.22) · Specificity A 95.66 / B 95.19 (−0.47) — ตรงกับ `RESULTS-TEMPLATE.md:207-213` (Recall A 51.5 / B 61.65 ; Precision A 86.8 / B 83.56)

**ข้อสรุปเชิงทิศทางไม่เปลี่ยนเมื่อย้ายมาใช้ ALLOWED:** Recall ของ B สูงกว่า A เท่าเดิมทุกตัวเลข (+10.13 จุด — Recall ใช้ `ALLOWED` อยู่แล้วตั้งแต่แรก) ; Precision ของ A ยังสูงกว่า B (ส่วนต่างแคบลงจาก −3.28 เป็น −3.11) ; F1 ยังก้ำกึ่ง (+0.16 จุด แคบลงจาก +0.37) ; Accuracy ส่วนต่างเท่าเดิมพอดี (+2.22) ; Specificity ยังติดลบเล็กน้อย (−0.48)

**ข้อควรระวัง:** n ของสองเงื่อนไขไม่เท่ากัน (A ส่วนใหญ่ 2 รอบ/กรณี, B ส่วนใหญ่ 4) ตามที่ `RESULTS-TEMPLATE.md:226` เตือนไว้.

ที่มา: คำนวณจากตาราง 3.1 ด้วยนิยาม ALLOWED (`objective1/accuracy/obj_confusion.py`, ผลพิมพ์ `confusion_output.txt`).

### 3.3 ผลวิเคราะห์เชิงคุณภาพจากข้อความ `reason`

- **จำนวนข้อความ `reason` ทั้งหมด [นับจาก `obj2_reasons.json`]:** เงื่อนไข A = **36** ข้อความ จาก 19 รัน ; เงื่อนไข B = **46** ข้อความ จาก 29 รัน ; รวม 82 ข้อความจาก 48 รัน (ตรงกับ `QUALITATIVE-REASON-ANALYSIS.md:14-15, 119`). จำนวนรันรวม V01_full (sanity, ไม่มีเมตริก) A 2 รัน / B 2 รัน.
- **ภาษาของ `reason`:** ภาษาไทย A 33 / 36 ; B 39 / 46 (ที่เหลือเป็นภาษาอังกฤษ).
- **จำนวนที่อ้างถึงเนื้อหาจากภาพ:** เงื่อนไข B (ส่งภาพ) = **0 / 46** ; เงื่อนไข A = **1 / 36** (ตรวจด้วยชุดคำค้นภาพเดียวกับ `obj2_tally.py:5` : `ภาพ|ฉาก|สไลด์|จอ|หน้าจอ|กล้อง|outro|card|visual|screen|frame|slate|image|scene|camera|เห็น|แสดง` ; ผลตรงกับ `objective2/qualitative/tally.txt`).
  - รายการเดียวของ A: `V04_full rep2/control-old 1.09-3.45` — ข้อความตรงกับคำว่า "ฉากเริ่มต้น (Technical intro slate)" แต่ใน A **Gemini ไม่ได้รับภาพ** จึงเป็นการเดาจากเสียง/ข้อความ ไม่ใช่การอ้างภาพจริง (`QUALITATIVE-REASON-ANALYSIS.md:30`).
- **ข้อจำกัดของตัวชี้วัดนี้:** การนับด้วยคำค้นเป็นวิธีคร่าว ๆ [คำนวณเอง/นับด้วยสคริปต์เดิม] ; `reason` เป็นคำอธิบายที่ Gemini เขียนเอง การไม่อ้างภาพ ≠ พิสูจน์ว่าภาพไม่มีอิทธิพล (`QUALITATIVE-REASON-ANALYSIS.md:109`).

**ตัวอย่างข้อความ `reason` (คัดลอกตามจริงจาก `harness.log` ผ่าน `obj2_reasons.json`):**

1. เงื่อนไข B · `V02_full` · `objective1/rep1/after/V02_full/harness.log` · ช่วง 84.43–90.23 วินาที · ความมั่นใจ `high` (ตัดช่วงเงียบ — ไม่อ้างภาพ) : "ช่วงเงียบยาวผิดปกติในระหว่างประโยค ทำให้การพูดขาดความต่อเนื่อง ควรตัดออกเพื่อให้วิดีโอดูราบรื่นขึ้น"
2. เงื่อนไข B · `V06_full` · `objective1/rep2/after/V06_full/harness.log` · ช่วง 124.62–128.95 วินาที · ความมั่นใจ `high` (อ้างสัญญาณ VAD ที่ใส่ในพรอมป์ ไม่อ้างภาพ) : "Prolonged silence between two main points, identified by VAD filter."
3. เงื่อนไข A · `V04_full` · `objective2/rep2/control-old/V04_full/harness.log` · ช่วง 1.09–3.45 วินาที · ความมั่นใจ `high` (รายการเดียวที่มีคำว่า "ฉาก" ในเงื่อนไข A) : "ปัญหานำเข้า/ฉากเริ่มต้น (Technical intro slate) ไม่ใช่เนื้อหาที่ต้องการ"
4. เงื่อนไข A · `V03_summary` · `objective2/rep2/after/V03_summary/harness.log` · ช่วง 50.86–87.78 วินาที · ความมั่นใจ `high` (ตัดนอกประเด็น (โหมด summary)) : "OFF_TOPIC_TANGENT: ตัวอย่างเปรียบเทียบการเลือกซื้อโทรศัพท์มือถือที่ยาวเกินไป เป็นการขยายความที่ไม่เพิ่มความเข้าใจหลัก และไม่จำเป็นต่อการเข้าใจประเด็นเรื่องการลงทุนในหุ้น ซึ่งมีการกล่าวถึงหลักการศึกษาข้อมูลไว้แล้วในส่วนอื่น"
5. เงื่อนไข B · `V04_full` · `objective1/rep1/after/V04_full/harness.log` · ช่วง 49.56–57.54 วินาที · ความมั่นใจ `high` (ตัดเทคซ้ำ) : "ผู้พูดให้คำตอบเริ่มต้นแล้วแก้ไขตัวเองเพื่อให้ข้อมูลที่ถูกต้องและครบถ้วนยิ่งขึ้น"

ที่มา: `eval/final-evaluation/objective2/qualitative/obj2_reasons.json`, `reasons_by_case.txt`, `tally.txt`, `QUALITATIVE-REASON-ANALYSIS.md`.

### 3.4 ส่วนต่างของ Recall มาจากรอบใด

| กรณี | Recall A % | Recall B % | ส่วนต่าง B−A (จุด) [คำนวณเอง] | สัดส่วนของผลรวมส่วนต่าง |
|---|---|---|---|---|
| V02_full | 25.32 | 50.64 | +25.32 | 41.66% |
| V03_summary | 36.77 | 63.64 | +26.88 | 44.22% |
| V04_full | 27.21 | 27.45 | +0.25 | 0.40% |
| V06_full | 61.54 | 66.50 | +4.96 | 8.17% |
| V06_summary | 58.31 | 61.68 | +3.37 | 5.54% |
| V07_full | 100.00 | 100.00 | +0.00 | 0.00% |
| ผลรวม / ค่าเฉลี่ย 6 กรณี | 51.52 | 61.65 | +60.77 (÷6 = +10.13) | 100.00% |

V02_full + V03_summary รวมกัน = 52.19 จุด จากผลรวม 60.77 จุด = **85.89%** ของส่วนต่างทั้งหมด [คำนวณเอง] (ไฟล์ผลเขียนว่า 8.7 จุดจากค่าเฉลี่ย 10.1 จุด หรือ 86% — `QUALITATIVE-REASON-ANALYSIS.md:92` ; ส่วนต่างของ V03_summary ในไฟล์ผลเป็น +26.8 เทียบกับ +26.88 ที่นี่ เพราะไฟล์ผลลบจากค่าที่ปัดเป็น 63.6−36.8).

**หลักฐานจาก log ว่ามาจากรอบเดี่ยวใด:**

- **V02_full (A rep2/after):** Gemini เสนอตัด 0 ช่วง → Recall รอบนั้น 0.00 ; อีกรอบของ A ตัด 84.43–90.23 เหมือน B ทุกรอบ — `objective2/rep2/after/V02_full/harness.log:26` : `📋 AI Suggested Cuts (0 segments to delete):`. A เฉลี่ย 25.32 จาก 2 รอบ (0.00 และ 50.64).
- **V03_summary (A rep2/control-old):** Gemini เสนอตัด 63.57–87.28 แต่ guard `_verify_outline_coverage` คืนช่วงกลับ → Recall รอบนั้น 0.00 — `objective2/rep2/control-old/V03_summary/harness.log:37` (`📋 AI Suggested Cuts (1 segments to delete):`) และ `:42` (`♻️ คืนประเด็น core ที่หายไป (35% เหลืออยู่): 50.86s → 87.28s — ตัวอย่างเปรียบเทียบการตัดสินใจซื้ออย่างชาญฉลาด: การเลือกซื้อสมาร์ทโ`). (ขั้น outline รับข้อความล้วนทั้งสองเงื่อนไข — `QUALITATIVE-REASON-ANALYSIS.md:22`.)
- **เหตุการณ์แบบเดียวกันในเงื่อนไข B:** V03_summary rep2/control-old เสนอตัด 0 ช่วง — `objective1/rep2/control-old/V03_summary/harness.log:46` ; V04_full rep2/after เสนอตัด 0 ช่วง — `objective1/rep2/after/V04_full/harness.log:24` ; และ 4A ที่รันจริงผ่านหน้าเว็บกับ V02 (ส่งภาพ 8 ภาพ) ได้ 0 ช่วงเช่นกัน — `objective4/functional/run2-post-rebuild/checklist_result.md` (หัวข้อ "ข้อสังเกต").
- สรุปตามไฟล์ผล: ช่องว่างอธิบายได้ด้วยเหตุการณ์ 2 ครั้งที่ไม่มีหลักฐานว่าเกี่ยวกับภาพ และ **ข้อมูลชุดนี้ไม่สนับสนุนข้อสรุปว่า "ภาพช่วยให้ Recall สูงขึ้น"** (`QUALITATIVE-REASON-ANALYSIS.md:104-105`).

ที่มา: `objective2/rep2/*`, `objective1/rep2/*` (`harness.log`), `QUALITATIVE-REASON-ANALYSIS.md:89-105`, `RESULTS-TEMPLATE.md:217-238`.

### 3.5 ข้อจำกัดของการทดสอบส่วนนี้

1. **จำนวนรอบน้อยและไม่เท่ากัน** — A 2 รอบต่อกรณี (V04 มี 3) ส่วน B 4 รอบ (V07 มี 3) ; รันเดียวดึงค่าเฉลี่ยของ A ลงครึ่งหนึ่ง (`QUALITATIVE-REASON-ANALYSIS.md:108`).
2. **รอบ A ส่วนใหญ่ของ rep1 ล้มเหลว** (13 จาก 32 รายการ = 8 กรณี × 2 rep × 2 tag ; key#2 ใช้ไม่ได้และ key อื่นหมดโควตา — 2.7) จึงเหลือข้อมูล A เป็นรอบ rep2 เป็นหลัก (13 รอบใน 6 กรณี) และ **should-do tier (n=4) ของ Objective 2 ไม่ได้รัน** (`RESULTS-TEMPLATE.md:24, 69`).
3. **ข้อมูลเป็น pre-fix ทั้งหมด** (HEAD `822656f`) — ความพยายามเติมหลังแก้บั๊ก fallback (`e136e8a`) ล้มเหลวเพราะโควตา จึงไม่มีข้อมูล post-fix ปนอยู่ (`RESULTS-TEMPLATE.md:4-5, 20`).
4. **ตัวแปรโมเดลไม่ตรึงครบ 1 รอบ** — V03_summary B `rep1/control-old` ใช้ `gemini-3.6-flash` (`RESULTS-TEMPLATE.md:179`).
5. **Gemini ตอบไม่คงที่** แม้ input และโค้ดเดียวกัน (เช่น Recall ของ V03_summary B ตั้งแต่ 0.00 ถึง 100.00 — ดู 2.1 ; 4A ไฟล์เดียวกันอัป 4 ครั้งได้ผลตัดต่างกัน — `LOG-ANALYSIS-FROM-TEAMMATE.md`) ดังนั้นส่วนต่างระหว่างเงื่อนไขอาจเป็นความแปรปรวนของโมเดล.
6. **ชุดคลิปไม่มีสถานการณ์ที่ภาพควรเปลี่ยนการตัดสินใจ** (outro card, สไลด์ค้างขณะเงียบ, CTA บนจอ) — คลิปทั้ง 7 เป็นการพูดหน้ากล้อง ; ข้อ 2–3 ของ checklist เชิงคุณภาพจึงทดสอบไม่ได้ (`QUALITATIVE-REASON-ANALYSIS.md:35-36, 111`).
7. **ส่งภาพเฉพาะขั้น Deletion** (ขั้น Outline ของโหมด summary รับข้อความล้วนทั้งสองเงื่อนไข — `QUALITATIVE-REASON-ANALYSIS.md:22`).
8. **harness ฉีด transcript จาก baseline** ไม่ได้ทดสอบ Whisper ใหม่ และใช้ภาพ 8 ภาพ/รัน (`ดึงภาพ 8/8 ภาพ`) ผลจึงตอบเฉพาะส่วนตัดสินใจของ Gemini.
9. ก่อนปรับใช้ผลกับบทที่ 4: อ่านร่วมกับข้อสังเกตในส่วน 6.

## ส่วน 4 วัตถุประสงค์ข้อ 3 (ความถูกต้องของคำบรรยาย)

**สถานะจริง: ยังไม่ได้ทดสอบ — ไม่พบไฟล์ผลลัพธ์ใด ๆ** ของ Objective 3 (`RESULTS-TEMPLATE.md:72` ระบุ "ไม่ได้เริ่ม" ; ส่วน Objective 3 ใน `RESULTS-TEMPLATE.md:244-265` เป็น `TBD` ทั้งหมด).

| รายการที่ต้องมี | สถานะ | ไฟล์ที่พบ/ขาด |
|---|---|---|
| Human reference transcript (คนถอดเสียงเอง) | **ไม่พบ** | โฟลเดอร์ `objective3/reference/<case>/transcript.txt` ตามแผนไม่มีอยู่ (`PROTOCOL.md` ข้อ 5, ตรวจรายชื่อไฟล์แล้ว) |
| Reference timing | **ไม่พบ** | `objective3/reference/<case>/timing.json` ไม่มี |
| Metric ตาม Test Plan (CER/WER/อื่น) | **ไม่พบ/ยังไม่ยืนยัน** — ไม่พบเอกสาร Test Plan ใน repo จึงไม่ทราบว่า metric ที่กำหนดคือ CER, WER หรืออื่น (`objective3/PROTOCOL.md` ข้อ 3) ; ค้นคำว่า CER/WER ใน `eval/` พบเฉพาะในเอกสารแผน ไม่มีค่าที่คำนวณ | — |
| ผลเมตริกต่อคลิป | **ไม่พบ** | `objective3/results/<case>/metric.json` ไม่มี |
| Timing offset ของซับ | **ไม่พบ** (ไม่มี metric เชิงปริมาณอย่างเป็นทางการ) | — |
| Editable-subtitle test log | **ไม่พบเป็นไฟล์ของ Objective 3** (`objective3/editable-subtitle-test-log.md` ไม่มี) ; มีหลักฐานที่เกี่ยวข้องบางส่วนจาก 4A ดูด้านล่าง | — |

ไฟล์ที่มีอยู่ใน `eval/final-evaluation/objective3/` มีเพียง 2 ไฟล์ **เอกสารแผน** ไม่ใช่ผล: `PROTOCOL.md` (สถานะ "NOT READY", ห้ามสร้าง reference transcript ปลอม) และ `DATA-SETUP.md` (ข้อเสนอเลือก 2–3 คลิปจาก V02–V07).

**หลักฐานที่เกี่ยวข้องกับซับจากการทดสอบอื่น (ไม่ใช่เมตริกความถูกต้องของ Objective 3 — ใช้เป็นข้อมูลประกอบเท่านั้น):**

- 4A API (V02): `POST /subtitle` คืนซับ 44 บรรทัด นอก selection = 0 ; แก้ซับแล้วบันทึก 44 บรรทัด (`edited_subtitle_phrases`) ; ซับที่แก้ถูกเบิร์นจริง (เฟรม t=3 วินาที) ; ซับบรรทัดสุดท้ายหลัง remap จบที่ 105.03 วินาที = ความยาวรวมพอดี ; **ไม่ได้ตรวจซับหลังรอยตัด** — `objective4/functional/run2-post-rebuild/checklist_result.md` (แถวข้อ 5 และ 7).
- 4A UI (รายงานเองโดยเพื่อนร่วมทีม): ข้อ 20–22, 26, 27, 29 — แก้ข้อความซับได้, จำกัด 200 ตัวอักษร, ซับที่เบิร์นตรงข้อความที่แก้, ซับหลังรอยตัดเลื่อนตามภาพ 3.4 วินาทีพอดี — `UI-TEST-RESULTS-FROM-TEAMMATE.md` (ดู 5.2).
- ขั้น AI-Correction มี log (เช่น `Fixed 2/2 segments` ใน `objective1/rep*/…/harness.log`) แต่ไม่ได้วัดเทียบ reference จึงไม่มีอัตราความถูกต้อง (`objective3/PROTOCOL.md` ข้อ 3).

ที่มา: `eval/final-evaluation/objective3/PROTOCOL.md`, `objective3/DATA-SETUP.md`, `RESULTS-TEMPLATE.md:72, 244-265`, `objective4/functional/run2-post-rebuild/checklist_result.md`.

## ส่วน 5 วัตถุประสงค์ข้อ 4

### 5.1 Objective 4A ระดับ API

| # | รายการทดสอบ (แถวในไฟล์ผล) | ผลที่คาดหวัง (ข้อ checklist ใน `FUNCTIONAL-TEST.md`) | ผลจริง (หลักฐานตามไฟล์ผล) | สถานะ | หมายเหตุ |
|---|---|---|---|---|---|
| 1 | Upload ผ่าน endpoint จริง / ได้ job_id | อัปโหลดไฟล์วิดีโอผ่าน endpoint จริง (ไม่ใช่ฉีด transcript แบบ harness) ; ได้ `job_id` กลับมาถูกต้อง | HTTP 200 `upload_response.json` | **ผ่าน** |  |
| 2 | ไฟล์เก็บที่ `storage/<job_id>/` | ไฟล์ถูกเก็บที่ `backend/storage/<job_id>/` ตามที่คาด | V2_________.mp4, full_audio.wav, preview.json, thumbnail.jpg, final_summary.mp4 | **ผ่าน** |  |
| 3 | error handling ไฟล์ผิดชนิด/เสีย | error handling: อัปโหลดไฟล์ผิดชนิด/ไฟล์เสีย ได้ error message ที่เข้าใจได้ (ไม่ crash เงียบ ๆ) | — [ไม่ได้ทดสอบรอบนี้] | **ยังไม่ทดสอบ** | ไม่ได้ทดสอบรอบนี้ (ไม่มีไฟล์เสีย/ผิดชนิดที่ยิงผ่าน API) |
| 4 | Celery `process_video_task` เริ่ม + สถานะอัปเดต | `process_video_task` (Celery) เริ่มทำงานหลังอัปโหลดสำเร็จ ; สถานะ job อัปเดตระหว่างประมวลผล (ตรวจผ่าน endpoint สถานะ ถ้ามี) | `/status` progress 62 → 100 ; `process_log.txt` | **ผ่าน** |  |
| 5 | ffmpeg → VAD → (Cache) → Gemini ตามลำดับ | ffmpeg → VAD → Whisper → Gemini ทำงานครบตามลำดับ (ตรวจจาก log จริงของ worker) | `process_log.txt`: VAD Pre-filter `original segments = 7 \| kept = 7` (รูปแบบใหม่ ไม่ทิ้งท่อน), Silence Gap 3 ช่วง, `gemini-2.5-flash` key#1 attempt 1, 26.0s | **ผ่าน** |  |
| 6 | จบสมบูรณ์ มี preview.json | job จบสมบูรณ์และมี `preview.json` ที่ `backend/storage/<job_id>/` | `preview_response.json` (HTTP 200) | **ผ่าน** |  |
| 7 | หน้า Preview โหลด/แสดงช่วง/ไทม์ไลน์ปูเต็ม/ปุ่มดู seek | หน้า Preview โหลด `preview.json` ของ job ที่เพิ่งประมวลผลถูกต้อง ; ช่วงที่ AI เสนอเก็บ/ตัด แสดงผลตรงกับข้อมูลใน `preview.json` ; ไทม์ไลน์ปูเต็ม `[0, duration]` ต่อกันสนิท (ตาม invariant CLAUDE.md §2.4) ; ปุ่ม "ดู" seek ไปยังตำแหน่งที่ถูกต้องในคลิปต้นฉบับ (ไม่ใช่คลิปที่ตัดแล้ว — ตาม CLAUDE.md §2.3) | ตรวจได้แค่ข้อมูล: `segments` = `[0,110.83]` เต็มความยาวส่วนที่มีเสียง [**ไม่ได้ทดสอบ (UI)**] | **ยังไม่ทดสอบ** | ต้องทดสอบด้วยเบราว์เซอร์ — ตรวจได้แค่ข้อมูล `segments` |
| 8 | Select/Deselect, splitAt/applyMerge, คืนค่า AI | ติ๊ก/ยกเลิกติ๊กช่วงในหน้า preview แล้วค่า `on` ของแถวเปลี่ยนถูกต้อง ; `splitAt`/`applyMerge` (ถ้าทดสอบ) ไม่ทำให้ผลลัพธ์ที่จะ render เปลี่ยนไปจากที่ตั้งใจ ; ปุ่ม "คืนค่า AI" ทำงานถูกต้องหลังแก้ไข้ selection | จำลอง deselect ที่ระดับ API เท่านั้น (ข้อ 6) [**ไม่ได้ทดสอบ (UI)**] | **ยังไม่ทดสอบ** | จำลอง deselect ระดับ API เท่านั้น (ข้อ 6 ของไฟล์ผล) |
| 9 | หน้าแก้ซับใช้ `POST /subtitle/{job_id}` | เข้าหน้าแก้ซับได้หลังยืนยัน selection จากหน้า preview ; หน้าแก้ซับใช้ **`POST /subtitle/{job_id}`** (segments ที่เลือกอยู่จริง) ไม่ใช่ `GET /subtitle` เป็นค่าหลัก (ตาม CLAUDE.md §2.5 — เคยพลาดมาแล้วที่โชว์ทั้งคลิปทั้งที่เลือกไว้บางส่วน) | HTTP 200, ซับ 44 บรรทัด **นอก selection = 0**, ฟิลด์ `orig_start/orig_end` ครบ (CLAUDE.md §2.3/§2.5) ; หน้าจอเรียก endpoint นี้จริงหรือไม่ = ไม่ได้ตรวจ (UI) [PASS (ระดับ API)] | **ผ่าน** | ระดับ API ; หน้าจอเรียก endpoint นี้จริงหรือไม่ไม่ได้ตรวจ |
| 10 | แก้ข้อความซับแล้วบันทึกได้ | แก้ข้อความ/เวลาซับแล้วบันทึกได้ถูกต้อง | `preview.json` เก็บ `edited_subtitle_phrases` 44 บรรทัด, `GET /subtitle` คืนข้อความที่แก้ | **ผ่าน** |  |
| 11 | `render_only_task` เริ่มหลังยืนยัน | `render_only_task` เริ่มทำงานหลังยืนยันการแก้ซับ | HTTP 200 → SUCCESS ใน 7.4s | **ผ่าน** |  |
| 12 | ffmpeg ตัด+ต่อ+เบิร์นซับจบไม่ error | ffmpeg ตัด+ต่อ+เบิร์นซับ (ถ้าเปิด) ทำงานจนจบไม่ error | `render_log.txt` (`filter_complex 2 segments`) ; job เสริม burn=true ก็ SUCCESS | **ผ่าน** |  |
| 13 | `tail_pad=0` ใน render-from-preview | `tail_pad=0` ถูกใช้ในเส้นทาง render-from-preview (ตาม CLAUDE.md §6 — ต่างจาก `process_video_task` ที่ใช้ 0.2) | ความยาว output 105.047s เทียบผลรวมช่วง 105.03s (ต่าง 0.02s ถ้ามี pad 0.2×2 จะเป็น ~105.4s) [PASS (ทางอ้อม)] | **ผ่าน** | ตรวจทางอ้อมจากความยาว output (ต่าง 0.02 วินาที ; ถ้ามี pad ~105.4) |
| 14 | `final_summary.mp4` มีจริงและเปิดได้ | ไฟล์ output (`final_summary.mp4`) มีอยู่จริงและเปิดเล่นได้ | ffprobe: h264 1280×720 + aac, `output_video_info.txt` | **ผ่าน** |  |
| 15 | ความยาว output = ผลรวมช่วงที่เลือก | ความยาวไฟล์ output ตรงกับผลรวมของช่วงที่เลือก (± ความคลาดเคลื่อนที่ยอมรับได้จาก snap/pad) | 105.047s vs 105.03s | **ผ่าน** |  |
| 16 | ซับที่เบิร์นตรงข้อความที่แก้ | ซับ (ถ้าเปิด burn) ตรงกับข้อความ/เวลาที่แก้ไว้ในขั้นที่ 5 — ไม่มีปัญหา offset (CLAUDE.md §6: เคยพลาดมาแล้ว 0.2 วิ/ช่วง) | `burn/frame_t3s.jpg`: เฟรม t=3s เห็น "วี 02 ทดสอบสวัสดีครับ [แก้ไขโดยเทสต์ 4A]" | **ผ่าน** | ตรวจเฟรม t=3 วินาที (job เสริม burn=true) |
| 17 | ซับไม่มี offset | ซับ (ถ้าเปิด burn) ตรงกับข้อความ/เวลาที่แก้ไว้ในขั้นที่ 5 — ไม่มีปัญหา offset (CLAUDE.md §6: เคยพลาดมาแล้ว 0.2 วิ/ช่วง) | ซับบรรทัดสุดท้ายหลัง remap จบที่ 105.03s = ความยาวรวมพอดี ; ตรวจภาพเฉพาะ t=3s จุดเดียว (ก่อนรอยตัด) ยังไม่ได้ตรวจซับหลังรอยตัดที่ 84.4s [ตรวจบางส่วน] | **ผ่านบางส่วน** | ตรวจภาพจุดเดียวก่อนรอยตัด ; ยังไม่ได้ตรวจซับหลังรอยตัดที่ 84.4 วินาที |
| 18 | จำนวนช่วงตัดตรงกันระหว่าง 2 หน้าจอ | จำนวนช่วงตัดใน output ตรงกับที่หน้า preview/แก้ซับแสดงไว้ (ไม่ขัดกันระหว่าง 2 หน้าจอ — CLAUDE.md §5) | — [ไม่ได้ทดสอบ (UI)] | **ยังไม่ทดสอบ** | ต้องเทียบ 2 หน้าจอ — ทดสอบ UI ในรอบ 4A UI (ดู 5.2) |

**สรุปจำนวนต่อสถานะ (18 แถวในไฟล์ผล) [นับเอง]:** ผ่าน **13** · ผ่านบางส่วน **1** · ยังไม่ทดสอบ **4** · ไม่ผ่าน **0** (ไม่มีสัญลักษณ์ ❌ ในไฟล์ผล) · รวม 18 (ไฟล์ผลรวมข้อ checklist 25 ข้อเป็น 18 แถว ; แถว 7 รวม 4 ข้อ, แถว 8 รวม 3 ข้อ).

- **บริบท:** คลิป V02, โหมด `full`, ผ่าน endpoint จริงด้วย JWT, job หลัก `c00c222e-bbe2-4112-8f6c-ea1b2e2c8c57` + job เสริม burn=true `31c41c8e-…` (`checklist_result.md:3-5`) ; `main`=`e136e8a` หลัง rebuild 2026-09-24.
- **ข้อจำกัดที่ไฟล์ผลระบุเอง:** AI เสนอเก็บทั้งคลิป (0 ช่วงตัด) ผู้ทดสอบ **จำลอง** การเอาช่วงเงียบ 84.43–90.23 ออกและจำลองแก้ซับ ; transcript มาจาก Cache HIT (ไม่ใช่ Whisper สด) ; ไม่ได้เปิดเบราว์เซอร์ (`checklist_result.md:6-8`).
- **รอบเก่า 2026-09-23 เป็นโมฆะ** (worker รัน image เก่า — ไม่ถึงขั้น preview/render ทั้ง 2 ครั้ง ; `RESULTS-TEMPLATE.md:31-34, 58-61, 323-331`) จึงไม่นับในตารางนี้.
- **รอบเสริม V04 (run3):** 1 รัน สำหรับตรวจว่า "Gemini เสนอตัด 0 ช่วง" ของ V02 ผิดปกติเชิงระบบหรือไม่ — ได้ตัด 2 ช่วง (46.53–54.07, 67.6–73.86), Recall 62.7% / Precision 97.0% (n=1 **ห้ามรวมกับ Objective 1**) — `objective4/functional/run3-v04-repeat/SUMMARY.md`.

ที่มา: `objective4/functional/run2-post-rebuild/checklist_result.md` (แถวผล), `objective4/FUNCTIONAL-TEST.md` (ผลที่คาดหวัง), `RESULTS-TEMPLATE.md:36-48`.

### 5.2 Objective 4A ระดับ UI (33 ข้อ)

**ผู้ทดสอบ:** เพื่อนร่วมทีม 1 คน (รายงานผลด้วยตนเองจากเครื่องของตัวเอง, 2026-09-26 ; ผมไม่ได้เห็นหน้าจอ/Docker log โดยตรง — ไฟล์ต้นทางระบุว่าเป็น self-reported ทั้งหมด) ตามรายการ `objective4/UI-MANUAL-CHECKLIST.md`. เบราว์เซอร์: Chromium (built-in browser) ; เวอร์ชัน/สเปกเครื่อง: **ไม่พบ**.

**คลิปและจำนวนรอบ:** ไม่ใช่ V04 ตามที่คู่มือกำหนด — จาก log ที่เพื่อนส่งมา (`LOG-ANALYSIS-FROM-TEAMMATE.md`) ไฟล์ที่ใช้คือ `your_test_video.mp4` (11 นาที), `08209f5d-…mp4`, `Test.mp4` ; **อัปโหลดแยก 2 รอบ**: ข้อ 1–7 มาจากรอบแรก, ข้อ 8–33 มาจากรอบสอง (`UI-TEST-RESULTS-FROM-TEAMMATE.md` หัวเอกสาร). ข้อ 2 ตรงกับไฟล์ `08209f5d-…mp4` (ชุด A) และข้อ 13 ตรงกับ `Test.mp4` (ชุด B) (`LOG-ANALYSIS-FROM-TEAMMATE.md` ส่วนที่ 2) ; ตัวเลขตัวอย่างในคอลัมน์ "ผลที่คาดหวัง" (เช่น 46.5–54) เป็นของคลิป V04 ตามคู่มือ จึงไม่ตรงกับที่ผู้ทดสอบเห็นเสมอไป.

| # | รายการทดสอบ | ผลที่คาดหวัง (ตาม `UI-MANUAL-CHECKLIST.md`) | ผลจริง (คัดตามที่ผู้ทดสอบเขียน) | สถานะ | หมายเหตุ |
|---|---|---|---|---|---|
| 1 | รอประมวลผลแล้วเปิดหน้า Preview | ระหว่างรอ เห็นหน้าประมวลผล 4 ขั้น (แยกเสียง → ฟังเสียงพูด → AI คิดวิเคราะห์ → ตัดและรวมคลิป) แล้วเปิดหน้า Preview ได้ ไม่ค้างที่ "กำลังโหลดตัวอย่าง..." | ระบบหน้าประมวณผลทำงาน ต่อเนื่องไม่ค้าง | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 2 | แท็บกรอง | แท็บกรอง **ทั้งหมด / AI เลือก / AI ตัดออก** แต่ละแท็บมีตัวเลขในวงเล็บ กดแล้วรายการเปลี่ยน ("AI ตัดออก" ควรเห็น ~46.5–54 และ ~67.6–73.9) | ทั้งหมด 4 เเละตัด2 ช่วง กลาง1:16.1–1:19.2 เเละตัดช่วงท้ายคลิปที่มีเสียงเงียบ 2:23.3–2:24.4 ยาว 1.1 วิ | **ผ่าน** (ตามรายงานผู้ทดสอบ) | คลิปคนละไฟล์กับข้อ 13 |
| 3 | แถบไทม์ไลน์ปูเต็ม | แถบไทม์ไลน์ใต้วิดีโอ: แถบสีทึบ = ช่วงที่เก็บ, ลายทแยง = ช่วงที่ AI ตัด — **ปูเต็มตั้งแต่ต้นจนท้าย ไม่มีช่องว่าง/ทับกัน** | เเถบสีทึบช่วงที่เก็บเต็มต่อเนื่อง เเทบสีขาวช่วงที่ ai ตัดตรง เรียงต่อกันสนิทตั้งแต่ต้นจนท้าย ต่อเนื่อง | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 4 | ตัวเลขสรุปตรงกัน | แถบสรุป "N ช่วง · ความยาว" ตรงกับที่ติ๊กอยู่ และปุ่มใหญ่ล่างเขียน "ถัดไป — แก้ subtitle (N ช่วง · ความยาว)" ตัวเลขเดียวกัน | ปุ่มใหญ่ "2 ช่วง เเก้ subtitle ช่วง 2:19.9 นาที นาที | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 5 | ปุ่มเล่นเฉพาะช่วง | ปุ่มไอคอนเล่น "เล่นเฉพาะช่วงนี้" ที่แถวช่วงที่ 2 → วิดีโอเล่นจากช่วงนั้น (เวลาบนตัวเล่น ~54.0) และเป็นคลิปต้นฉบับเต็ม | กดเล่นเฉพาะช่วงที่2 วิดีโอด้านบนกระโดดไปเล่นจากช่วงนั้น | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 6 | คลิกไทม์ไลน์เพื่อเลื่อนวิดีโอ | คลิกบนแถบไทม์ไลน์ → วิดีโอเลื่อนไปตำแหน่งนั้น | วิดีโอเลื่อนไปที่ตำแหน่งที่เลือกไทม์ไลน์นั้น | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 7 | ปุ่มข้ามฉาก | (คลิปนี้ไม่มีฉากเปลี่ยน — ถ้าไม่เห็นปุ่ม ‹ ฉาก › ถือว่าปกติ ไม่ต้องทดสอบ) | ไม่เห็นปุ่ม ‹ ฉาก › | **ผ่าน** (ตามรายงานผู้ทดสอบ) | ตรงตามที่คาดสำหรับคลิปที่ไม่มีฉากเปลี่ยน |
| 8 | เอาช่วงที่ AI ตัดกลับมา | แท็บ "AI ตัดออก" → **คลิกที่แถว** ช่วง 46.5–54 (ไอคอน ✗ → ✓, ป้ายเปลี่ยนเป็น "เพิ่มเอง") → ตัวเลขสรุปเพิ่มขึ้น | ติ้ก✓ ไอคอนหน้าแถวเปลี่ยนจาก ✓ เป็น ✗ ป้ายเปลี่ยนจากที่ AI ตัดออก | **ผ่าน** (ตามรายงานผู้ทดสอบ) | ไฟล์ต้นทางบันทึก ⚠️: ผู้ทดสอบเขียนทิศทางไอคอนกลับด้านและประโยคขาด ; ยืนยันทิศทางจริงไม่ได้ แต่ไม่ถือเป็น FAIL ตามผู้ทดสอบ ; ผลข้อ 9–15 ไม่ขัดแย้ง |
| 9 | ยกเลิกช่วงที่เก็บ | คลิกแถวช่วงที่ 2 เพื่อยกเลิก (✓ → ✗) → ตัวเลขลดลงเท่าความยาวช่วงนั้น | ยกเลิกช่วงที่เก็บ เห็น ✓ เป็น ✗ แถวจางลง ตัวเลขลดลงเท่าความยาวช่วงนั้น | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 10 | ขยับขอบช่วง | กดไอคอนปรับ (แถบเลื่อน) "ปรับเวลาหัว-ท้ายช่วงนี้" → เลือก "ก้าวละ 1 วิ" → กด **เริ่ม +1 วิ** → ป้าย "ปรับเวลาแล้ว" ขึ้น ตัวเลขความยาวเปลี่ยน ~1 วิ และช่วงข้างเคียงขยับตาม ไม่เกิดช่องว่าง | ขึ้นป้าย "ปรับเวลาแล้ว" ตัวเลขความยาวช่วงที่ติดกันขยับตาม ไม่เกิดช่องว่าง 58.5 → 57.5 วิ ปรับเวลาแล้ว | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 11 | แยกช่วง | เลื่อนวิดีโอไปกลางช่วงยาว (~1:30) กดปุ่ม **"แยกตรงนี้"** (ไอคอนกรรไกร ใต้แถบไทม์ไลน์) → แถวเพิ่มเป็น 2 (มีป้าย "แก้ช่วงเอง") **ความยาวรวมต้องไม่เปลี่ยน** | ช่วงนั้นแตกเป็น 2 → 3 ช่วง ยาวรวมเท่าเดิม 2:19.9 | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 12 | รวมช่วงกลับ | ที่แถวที่เพิ่งแยก กดไอคอนหมุนย้อน "รวมกับช่วงถัดไป (ยกเลิกการแยก)" → กลับเป็นแถวเดียว ความยาวรวมเท่าเดิม | รวมกลับ 3 → 2 ช่วง · 2:19.9 กลับเป็นแถวเดียว ความยาวรวมเท่าเดิม | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 13 | คืนค่า AI | ปุ่ม **"คืนค่า AI"** (จางลงถ้ายังไม่ได้แก้) กดครั้งแรกเปลี่ยนเป็น "ยืนยัน?" กดอีกครั้ง → กลับเป็นข้อเสนอเดิมของ AI | ทุกอย่างกลับเป็นข้อเสนอเดิมของ AI กด 2 ครั้ง → 2 ช่วง · 2:19.9 ปุ่มเทา | **ผ่าน** (ตามรายงานผู้ทดสอบ) | คลิปคนละไฟล์กับข้อ 2 |
| 14 | กันงานหายเมื่อรีเฟรช | ทำข้อ 8 ค้างไว้ แล้วกด **F5 รีเฟรช** → สิ่งที่ติ๊กไว้ยังอยู่ | หลังโหลดใหม่ สิ่งที่ติ๊กไว้ยังอยู่ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 15 | ล้างทั้งหมดแล้วกดไปต่อ | กดปุ่ม **"ล้าง"** (ไม่ติ๊กอะไรเลย) → ปุ่มใหญ่ล่างต้องเป็นสีเทา กดไม่ได้ ไม่ crash ; แล้วกด "คืนค่า AI" | ปุ่ม "ถัดไป" เทา กดไม่ได้ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 16 | เข้าหน้าแก้ซับ | กด "ถัดไป — แก้ subtitle" ไปหน้าแก้ซับได้ ไม่ค้างที่ "กำลังโหลดคำบรรยาย..." | เปิดหน้าแก้ซับ ไม่ค้างที่ ขึ้นกำลังโหลดคำบรรยาย | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 17 | ตัวเลขตรงกับหน้า Preview | "ความยาวที่จะได้" ตรงกับความยาวที่จดในข้อ C (หน้านี้ไม่แสดงจำนวนช่วง — ออกแบบไว้อย่างนั้น) และมี "จำนวนบรรทัด" | ความยาวตรงกับที่จดในหัวข้อ C | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 18 | ซับต้องตามช่วงที่เลือก | กด "← กลับไปเลือกช่วง" → ยกเลิกช่วง 0:00–0:46.6 → กลับมาหน้าแก้ซับ → "จำนวนบรรทัด" **ต้องลดลงมาก** (ไม่ใช่ซับทั้งคลิป) ; แล้วกลับไป "คืนค่า AI" | จำนวนบรรทัด ลดลงมาก | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 19 | ปุ่ม "ดู" ที่แต่ละบรรทัดซับ | กดปุ่ม **"ดู"** ที่บรรทัดซับ → วิดีโอ (ต้นฉบับเต็ม) เล่นตรงเวลาของบรรทัดนั้น | เวลาตรงกับที่กล่องบรรทัดแสดง | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 20 | แก้ข้อความซับ | แก้ข้อความ 2 บรรทัด (พิมพ์ต่อท้าย "[ทดสอบ1]" "[ทดสอบ2]") → ป้าย "แก้แล้ว" ขึ้น, "แก้ไปแล้ว" = 2, ปุ่มล่าง "บันทึก (แก้ 2 บรรทัด)" | กล่องบรรทัดที่แก้ขึ้นขอบเหลืองและป้าย กล่องสถิติขึ้นแก้ไปแล้ว 2 | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 21 | ปุ่มคืนค่าทั้งหมด | ปุ่ม **"คืนค่าทั้งหมด"** → มีกล่องถามยืนยัน — กด **ยกเลิก** ไว้ก่อนเพื่อคงข้อ 20 (ตัวเลือก: ลองกดตกลงแล้วแก้ใหม่) | ปุ่มล้างข้อความที่แก้ทั้งหมด มีปุ่มถาม ยืนยัน | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 22 | ช่องข้อความจำกัด 200 ตัวอักษร | พิมพ์ข้อความยาวเกิน 200 ตัวอักษรในช่องหนึ่ง → ช่องต้องไม่ให้พิมพ์เกิน (หน้านี้แก้ได้แค่ข้อความ ไม่มีช่องแก้เวลา) | ไม่เห็นข้อความเด้ง เมื่อเกิน 200 ตัวอักษร เเต่ไม่สามารถพิมต่อได้ | **ผ่าน** (ตามรายงานผู้ทดสอบ) | ผลที่เห็น: พิมพ์ต่อไม่ได้เมื่อครบ 200 ตัวอักษร (ไม่มีข้อความเตือน) |
| 23 | ส่งไปตัดต่อ | กด "บันทึก (แก้ 2 บรรทัด)" → ขึ้นสถานะ ไม่ค้าง → จบที่หน้า "ตัดต่อเสร็จแล้ว / วิดีโอของคุณพร้อมแล้ว" (~1 นาที) | ปุ่มขึ้น กำลังส่งไปตัดต่อ ไม่ค้างจบที่หน้า ตัดต่อเสร็จแล้ว | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 24 | เล่นวิดีโอผลลัพธ์ | เล่นวิดีโอผลลัพธ์บนหน้าเว็บได้ มีภาพ+เสียง ไม่กระตุกที่รอยตัด | มีภาพและเสียง ไม่กระตุกหรือเงียบโหลด เล่นได้ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 25 | ความยาวผลลัพธ์ | ความยาวผลลัพธ์ตรงกับ "ความยาวที่จะได้" (ต่างไม่เกิน ~0.1 วิ) — จด ___ vs ___ | ตรงกับ "ความยาวที่จะได้" 139.9s = 2:19.9 เป๊ะ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 26 | ซับที่เบิร์นตรงข้อความที่แก้ | ซับที่เบิร์นตรงกับข้อความที่แก้ ([ทดสอบ1]/[ทดสอบ2] แสดงถูก) | ทดสอบซับเบิร์นที่ 0:01 ซับในวิดีโอตรงเป๊ะ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 27 | ซับหลังรอยตัดตรงกับเสียง (★ สำคัญที่สุด) | **ซับหลังรอยตัดตรงกับเสียง (สำคัญ):** ช่วงหลังรอยตัดแรก (output ~46.6 วิ ขึ้นไป) ซับไม่ช้า/เร็วกว่าเสียงเกิน ~0.3 วิ — จด ___ | ซับเลื่อนตาม −3.4s เท่ากับที่ภาพเลื่อนตรงกัน ไม่เหลื่อม ซับไม่คลาด ซัปตรง | **ผ่าน** (ตามรายงานผู้ทดสอบ) | ข้อที่คู่มือถือว่าสำคัญที่สุด ; ซับเลื่อนตาม −3.4s เท่ากับช่วงที่ตัด |
| 28 | ดาวน์โหลด | ปุ่ม **"ดาวน์โหลดวิดีโอ"** ได้ไฟล์ .mp4 เปิดเล่นได้ | กดปุ่มดาวน์โหลดวิดีโอได้ไฟล์ .mp4 เปิดเล่นได้ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 29 | แก้คำบรรยายซ้ำจากหน้าผลลัพธ์ | ปุ่ม **"แก้คำบรรยาย"** พากลับหน้าแก้ซับ (ปุ่มย้อนเขียน "กลับไปหน้าผลลัพธ์") ข้อความที่แก้ยังอยู่ | กลับไปหน้าเเก้ซับ ข้อความที่แก้ไว้ยังอยู่ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 30 | หน้า "งานของฉัน" | กดปุ่ม **"งานของฉัน"** มุมขวาบน เห็นงานนี้ มีภาพปก ดาวน์โหลดได้ | มีภาพปก กดดาวน์โหลดได้ | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 31 | ไฟล์ผิดชนิด | เลือกไฟล์ .txt/.pdf → ต้องขึ้น "กรุณาเลือกไฟล์วิดีโอเท่านั้น" | เมื่อเลือกไฟล์ผิดชนิด .txt ขึ้นข้อความกรุณาเลือกไฟล์วิดีโอเท่านั้น ไม่ค้าง | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |
| 32 | ไฟล์วิดีโอปลอม | เปลี่ยนนามสกุลไฟล์ .txt เป็น .mp4 แล้วอัปโหลด → ต้องขึ้นข้อผิดพลาดที่อ่านเข้าใจได้ ไม่ค้าง/ไม่จอขาว | เปลี่ยนนามสกุลไฟล์ .txt เป็น .mp4 แล้วอัปโหลดได้เเต่ ไม่ขึ้นภาพวิดีโอ หน้า process ขึ้นเเต่ขึ้น error | **ผ่าน** (ตามรายงานผู้ทดสอบ) | ภาพประกอบ `item32_error_screenshot.png` 310×147px อ่านข้อความไม่ออก ; ยืนยันไม่ได้ว่าข้อความ error "อ่านเข้าใจได้" ตามที่คาด |
| 33 | Error ในเบื้องหลัง | ตลอดการทดสอบ Console/Network มี error สีแดง หรือ request 4xx/5xx ไหม — จด ___ | ไม่มี error | **ผ่าน** (ตามรายงานผู้ทดสอบ) |  |

**สรุปจำนวนต่อสถานะ [นับเอง]:** ผ่าน **33** · ผ่านบางส่วน **0** · ยังไม่ทดสอบ **0** · ไม่ผ่าน **0** — ตามแบบฟอร์มสรุปท้ายไฟล์ผล ("ข้อที่ FAIL หรือไม่แน่ใจ: ไม่มี FAIL" ; "Console error: ไม่มี error สีแดง") ; ข้อ 8 และ 32 มีข้อความคลุมเครือ (ดูหมายเหตุ) ซึ่งไฟล์ผลไม่ปัดตกและไม่รับรองแทน.

ผลสรุปจากแบบฟอร์มท้ายไฟล์: AI เสนอ 2 ช่วง (0–58.5 วินาที, 61.9–143.3 วินาที ตัดกลาง 3.4 วินาที) ; ความยาว output 139.9 วินาที (2:19.9) ตรงกับหน้าจอ ; ซับหลังรอยตัดไม่เหลื่อม.

**ผลทดลองเพิ่มเติม (จากเอกสารที่ผู้ทดสอบส่งมา):** ปุ่ม "คืนค่า AI" ทดลองสด 3 แบบ (ขยับขอบ, ล้างทุกช่วง, แยกช่วง) บน `Test.mp4` — คืนค่าตรงเป๊ะทุกครั้ง (`LOG-ANALYSIS-FROM-TEAMMATE.md` ส่วนที่ 3). และ log ระบุว่า `Test.mp4` ตัวเดียวกันอัป 4 ครั้ง Gemini เสนอตัดไม่เหมือนกัน (2 ครั้งตัด 58.5–61.9, 2 ครั้งไม่ตัด — ส่วนที่ 1).

ข้อควรระวัง: เอกสาร `LOG-ANALYSIS-FROM-TEAMMATE.md` ผลิตโดย Claude Code บนเครื่องเพื่อน ผมตรวจ timestamp/ตัวเลขซ้ำไม่ได้ (`RESULTS-TEMPLATE.md:298-301`) ; ผลนี้ **ไม่นับเป็น Objective 4B/4C** (เพื่อนรู้จักระบบ — `RESULTS-TEMPLATE.md:315-319`).

ที่มา: `objective4/UI-MANUAL-CHECKLIST.md`, `objective4/functional/teammate-ui-test-2026-09-26/UI-TEST-RESULTS-FROM-TEAMMATE.md`, `LOG-ANALYSIS-FROM-TEAMMATE.md`, `RESULTS-TEMPLATE.md:284-319`.

### 5.3 เวลาตอบสนอง / เวลาประมวลผลที่วัดได้

วัดจากบรรทัด Celery ใน log ของ worker (`Task … succeeded in …s`) และส่วนต่างของ timestamp ระหว่างเหตุการณ์ใน log (ขั้นย่อย [คำนวณเอง] = เวลาของเหตุการณ์ถัดไป − เวลาเหตุการณ์ก่อนหน้า ; เหตุการณ์ที่ใช้: `received` → `[VAD] Audio loaded` → `[VAD] Speech:` → `[Visual]` → `Transcribed N segments`/`[Cache HIT]` → `Sending filtered transcript to Gemini` → `Corrected text applied` → `succeeded`). ความละเอียด = มิลลิวินาทีตาม log ; **ทุกแถวเป็นการวัดครั้งเดียว (n=1)** ไม่มีการวัดซ้ำ.

**อุปกรณ์:** Docker บนเครื่องเดียวกับการพัฒนา — Whisper `small`/CPU/`int8`, ไม่มี GPU, worker `mem_limit: 5g` (0.2) ; รุ่นซีพียู **ไม่พบ**. ชุด 2026-09-21 รันบน worker image ก่อน rebuild 2026-09-24 และก่อนแก้ VAD-prefilter (`INVESTIGATION-NOTES.md`) ; ชุด 2026-09-24 รันหลัง rebuild.

**ก) งานวิเคราะห์ (`process_video_task`)** — วินาที

| ชุด / คลิป | ความยาวคลิป | แยกเสียง | VAD | วิเคราะห์ภาพ | Whisper (หรือโหลด Cache) | เตรียมส่ง Gemini ¹ | Gemini (+AI-Correct) | Guard + สร้างซับ | รวม (`succeeded in`) | แหล่ง transcript | โหมด | ผลงาน | ที่มา (ไฟล์:บรรทัด) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-09-21 · V02 · งาน `0e4c606f` | 112.80 | 3.89 | 0.68 | 2.38 | 24.66 | 0.58 | 45.16 | 0.39 | 75.16 | สด | full | สำเร็จ | `eval/V02/worker.log:57–169` |
| 2026-09-21 · V04 · งาน `9590035b` | 144.30 | 4.87 | 2.36 | 3.26 | 32.71 | 0.58 | 25.30 | 1.30 | 65.84 | สด | full | สำเร็จ | `eval/V04/worker.log:57–176` |
| 2026-09-21 · V05 · งาน `4c4597f3` | 124.10 | 5.48 | 0.70 | 2.74 | 35.47 | 0.55 | 18.23 | 1.95 | 60.46 | สด | full | สำเร็จ | `eval/V07/worker.log:57–164` |
| 2026-09-21 · V06 · งาน `0772b3c4` | 178.50 | 7.07 | 0.95 | 3.79 | 41.57 | 0.55 | 23.57 | 0.04 | 72.89 | สด | full | สำเร็จ | `eval/V07/worker.log:258–379` |
| 2026-09-21 · V06 · งาน `20692075` | 178.50 | 5.50 | 0.90 | 3.77 | 0.03 | 25.97 | 33.81 | 0.04 | 66.92 | Cache HIT | summary | สำเร็จ | `eval/V07/worker.log:479–606` |
| 2026-09-21 · V07 · งาน `6696c59e` | 95.80 | 3.27 | 0.49 | 2.11 | 11.53 | 0.55 | 58.61 | 0.02 | 76.57 (คำนวณจาก timestamp รับงาน→ปิดงาน) | สด | ไม่พบ | **ล้มเหลว** (FAILURE → `ignored`) | `eval/V07/worker.log:708–801` |
| 2026-09-21 · V07 · งาน `cc0db657` | 95.80 | 3.28 | 0.49 | 2.03 | 0.01 | 0.56 | 22.85 | 0.02 | 27.66 | Cache HIT | full | สำเร็จ | `eval/V07/worker.log:802–904` |
| 2026-09-24 · V02 · งาน `c00c222e` | 112.80 | 4.10 | 0.69 | 2.73 | 0.02 | 0.60 | 17.48 | 0.37 | 25.98 | Cache HIT | full | สำเร็จ | `objective4/functional/run2-post-rebuild/process_log.txt:1–91` |
| 2026-09-24 · V04 · งาน `69010709` | 144.30 | 5.55 | 0.78 | 3.66 | 0.02 | 0.61 | 47.82 | 0.03 | 60.59 | Cache HIT | full | สำเร็จ | `objective4/functional/run3-v04-repeat/process_log.txt:1–92` |

¹ "เตรียมส่ง Gemini" = หลัง Whisper/Cache จนถึงบรรทัด `Sending filtered transcript to Gemini` (กรอง VAD, hint ช่วงเงียบ, ดึงคีย์เฟรม) ; **ในโหมด summary ช่วงนี้รวมการเรียก Gemini ขั้นสร้าง outline** (โหมดของแต่ละงานอ้างจากตาราง Dataset ใน `objective1/README.md` (job ID → edit_mode) และ `checklist_result.md`/`SUMMARY.md` สำหรับ run2/run3 ; งาน `6696c59e` ไม่อยู่ในตารางนั้น จึงระบุ "ไม่พบ").

**ข) งานเรนเดอร์ (`render_only_task`, เบิร์นซับ)** — วินาที

| ชุด / คลิป | เวลา (`succeeded in`) | ที่มา (ไฟล์:บรรทัด) |
|---|---|---|
| 2026-09-21 · V02 · งาน `0e4c606f` | 6.27 | `eval/V02/worker.log:276` |
| 2026-09-21 · V04 · งาน `9590035b` | 10.29 | `eval/V04/worker.log:293` |
| 2026-09-21 · V05 · งาน `4c4597f3` | 9.04 | `eval/V07/worker.log:257` |
| 2026-09-21 · V06 · งาน `0772b3c4` | 9.86 | `eval/V07/worker.log:478` |
| 2026-09-21 · V06 · งาน `20692075` | 8.97 | `eval/V07/worker.log:707` |
| 2026-09-21 · V07 · งาน `cc0db657` | 6.61 | `eval/V07/worker.log:997` |
| 2026-09-24 · V02 · งาน `c00c222e` | 7.39 | `objective4/functional/run2-post-rebuild/render_log.txt:83` |

**ค) เวลาที่ไม่พบ:** เวลาต่อคำขอของ Gemini ใน harness Objective 1/2 **ไม่พบ** (`harness.log` ไม่มี timestamp) — พบเฉพาะรอบก่อนหน้าว่าพิสัย 11.6–672.4 วินาทีต่อคำขอ (`eval/pre-final-audit.md:166`, ไม่ใช่รอบ Final Evaluation) ; เวลาตอบสนองของหน้าเว็บ (UI) **ไม่พบ** (ไม่ได้วัด) ; เวลาที่ผู้ใช้ใช้ตรวจ/แก้ใน 4A UI **ไม่พบ** ; V01 และ V03 **ไม่พบ** `worker.log` (เวลาประมวลผลของคลิปทั้งสอง) ; ผู้ทดสอบ UI ไม่ได้จับเวลา.

ที่มา: `eval/V02/worker.log` (UTF-16), `eval/V04/worker.log` (= `eval/worker_all.log` ไบต์ต่อไบต์), `eval/V07/worker.log` (ไฟล์นี้บรรจุงานของ V05, V06 ×2, V07 ×2 ด้วย ชื่อไฟล์จึงไม่ตรงกับคลิป — ระบุคลิปจากชื่อไฟล์วิดีโอในบรรทัด `Input #0`), `objective4/functional/run2-post-rebuild/{process_log,render_log}.txt`, `run3-v04-repeat/process_log.txt`. เวลาในตาราง ก) แถว Cache HIT ไม่ควรเฉลี่ยรวมกับแถว Whisper สด.

### 5.4 Objective 4B, 4C, 4D

| ส่วน | สถานะจริง | แบบฟอร์ม/ข้อมูลที่มีอยู่ | สิ่งที่ขาด |
|---|---|---|---|
| **4B ผู้เชี่ยวชาญประเมิน** | **ยังไม่ได้เริ่ม — ไม่พบผล** (`RESULTS-TEMPLATE.md:73`, ตาราง `TBD` ที่ `:350-356`) | แผน: `objective4/PARTICIPANT-PLAN.md` ส่วน B (ขั้นต่ำ 2 คน, แนะนำ 3 ; rubric ร่าง 4 มิติ Likert 1–5 ; 2–3 คลิป ; ~15–30 นาที/คน) และ `objective4/PROTOCOL.md` ส่วน B (สถานะ "NOT SET UP", rubric "ยังไม่ได้ออกแบบ" ใน PROTOCOL) — **ไม่ใช่แบบฟอร์มที่ใช้งานแล้ว** | ผู้เชี่ยวชาญจริง, rubric ที่ยืนยัน, แบบประเมินที่กรอกแล้ว, ไฟล์ `objective4/results/expert/<participant>/<case>.json` (ไม่มีโฟลเดอร์นี้) |
| **4C ผู้ใช้ประเมิน** | **ยังไม่ได้เริ่ม — ไม่พบผล** (`RESULTS-TEMPLATE.md:73`, `:358-364`) | แผน: `PARTICIPANT-PLAN.md` ส่วน C (ขั้นต่ำ 5 คน, แนะนำ 8–10 ; task success, เวลาต่อขั้น, แบบสอบถาม 3 ข้อ Likert หรือ SUS ถ้า Test Plan กำหนด) — ไม่พบตัวแบบสอบถามจริง ; **ไม่พบ** ยืนยันว่าใช้ SUS หรือไม่ | ผู้เข้าร่วมจริง, แบบสอบถามที่กรอกแล้ว, ไฟล์ `objective4/results/user/…` (ไม่มี) ; ผลทดสอบ UI ของเพื่อนร่วมทีมไม่นับ (`RESULTS-TEMPLATE.md:315-319`) |
| **4D Manual vs AI-assisted** | **ยังไม่ได้เริ่ม — ไม่พบผล** (`RESULTS-TEMPLATE.md:73`, `:366-370`) | แผน: `PARTICIPANT-PLAN.md` ส่วน D (ขั้นต่ำ 3 คน, แนะนำ 6 ; within-subject + counterbalancing ; soft cap 20 นาที/รอบ) | ผู้เข้าร่วมจริง, เวลา manual/AI-assisted, แบบสอบถาม, ไฟล์ `objective4/results/manual-vs-ai/…` (ไม่มี) |

- จำนวนผู้เข้าร่วมใน `PARTICIPANT-PLAN.md` (B ≥2, C ≥5, D ≥3 ; รวมต่ำสุด 10 คนถ้าไม่ซ้อนกัน) เป็น **คำแนะนำที่ไฟล์ระบุเองว่ายังไม่ได้มาจาก Test Plan ฉบับทางการ** และต้องให้ผู้ใช้/อาจารย์ที่ปรึกษายืนยัน (`PARTICIPANT-PLAN.md:4`).
- ตรวจรายชื่อไฟล์ใต้ `eval/final-evaluation/objective4/` (นอก `functional/`) พบเฉพาะ `FUNCTIONAL-TEST.md`, `PARTICIPANT-PLAN.md`, `PROTOCOL.md`, `UI-MANUAL-CHECKLIST.md` และไม่พบโฟลเดอร์ `results`, `expert`, `user`, `manual-vs-ai` ใต้ `eval/final-evaluation/` [ตรวจเอง]. ค้นทั้ง repo ไม่พบไฟล์แบบสอบถาม/แบบประเมินที่กรอกแล้ว (พบคำเหล่านี้เฉพาะในเอกสารแผน/ผลสรุป).

ที่มา: `objective4/PARTICIPANT-PLAN.md`, `objective4/PROTOCOL.md`, `RESULTS-TEMPLATE.md:72-73, 350-375`.

## ส่วน 6 สิ่งที่ต้องระวังก่อนนำไปเขียนเล่ม

### 6.1 รายการตัวเลขที่คำนวณเอง [คำนวณเอง] (ไม่มีในไฟล์ผลต้นทาง)

1. **F1** ทุกค่า (รายรอบ 2.1, รายกรณี 2.2, macro/pooled 2.3, เปรียบเทียบ 3.1–3.2) = 2·P·R/(P+R) จาก Precision/Recall รายรอบของ `score()` ; ไฟล์ผลมี F1 เพียงค่าเดียว (≈70.9 = F1 ของ P/R เฉลี่ย, `RESULTS-TEMPLATE.md:100`) — ตารางที่นี่แสดงทั้ง "เฉลี่ยของ F1 รายกรณี" และ "F1 ของ P/R เฉลี่ย" ซึ่งต่างกัน (ระบุว่าใช้อย่างไรในเล่ม).
2. **ค่าเฉลี่ย ± S.D.** รายกรณี/รวม (2.2, 2.3) และ S.D. ระหว่างกรณี : ใช้ S.D. ประชากร (หาร n) เป็นหลัก ; มี S.D. ตัวอย่าง (หาร n−1) ให้เทียบใน 2.2.
3. **Pooled** Accuracy/Specificity/Recall/Precision/F1/baseline (2.3) และ macro 8 กรณี.
4. **Accuracy / Specificity / F1 ของเงื่อนไข A (เสียงล้วน)** (3.1–3.2) คำนวณใหม่จาก `preview.json` ของ `objective2/` ด้วยสูตรเดียวกับ `obj1_accuracy.py` (ไฟล์ผลไม่มีค่าเหล่านี้สำหรับ A) ; ตารางเสริมเทียบเฉพาะ rep2 ใน 3.2.
5. **ความยาวรวมต่อประเภทของเฉลย** (ส่วน 1) = ผลรวมช่วงจาก `ground_truth.txt`.
6. **ส่วนต่าง Recall รายกรณีและสัดส่วน** (3.4), **ส่วนต่าง Accuracy − baseline** (2.4).
7. **ขั้นย่อยของเวลาประมวลผล** (5.3 ก) = ส่วนต่างของ timestamp ใน log ; ค่ารวม `succeeded in` มาจากไฟล์ตรง ๆ.
8bis. **Precision / F1 / Accuracy / Specificity / baseline ตามนิยาม ALLOWED** (2.1–2.4, 2.10, 3.1–3.2) คำนวณใหม่เองทั้งหมดด้วย `objective1/accuracy/obj_confusion.py` — ไฟล์ผลต้นทาง (`accuracy_raw.json`, `metrics_combined.json`) เก็บเฉพาะชุด `ALL` (ยกเว้น Recall ที่เป็น `ALLOWED` อยู่แล้ว) ; ค่าที่ตรวจสอบย้อนได้คือ `RESULTS-TEMPLATE.md:138-141` ซึ่งระบุ Accuracy 86.8 / Specificity 93.2 / Recall 61.7 / Precision 74.1 ตรงกับที่คำนวณใหม่.

8. **จำนวนสถานะ** ในตาราง 5.1 (13/1/4/0) และ 5.2 (33/0/0/0) เป็นการนับเอง ; ไฟล์ผล 5.2 ระบุเพียง "33/33 ข้อ self-reported PASS" (`RESULTS-TEMPLATE.md:53`).
9. **จำนวนข้อความ `reason`** (3.3) นับซ้ำจาก `obj2_reasons.json` ได้ A 36 / B 46 ตรงกับไฟล์ผล.
10. **วันที่รัน Objective 1/2** (0.3) มาจาก mtime ของไฟล์ ไม่ใช่ timestamp ในไฟล์ผล.

### 6.2 รายการตัวเลข/ข้อความที่ไม่ตรงกันระหว่างไฟล์

| # | เรื่อง | ค่าจากไฟล์ที่ 1 | ค่าจากไฟล์ที่ 2 | หมายเหตุ |
|---|---|---|---|---|
| 1 | Keep Violation ของ V06_full | **5.7 วินาที** — `RESULTS-TEMPLATE.md:89` | **5.45 วินาที** (เฉลี่ยของ 5.00, 5.80, 6.00, 5.00) — `objective1/metrics_combined.json`, `accuracy_raw.json` | ไม่พบที่มาของ 5.7 ; ใช้ 5.45 ในเล่มหรือแก้ที่ต้นทางก่อน |
| 2 | Recall ของ V06_full | 66.5% (นิยาม ALLOWED) — `RESULTS-TEMPLATE.md:89` | 47.6% (นิยาม ALL) — `RESULTS-TEMPLATE.md:117` | ไม่ใช่ข้อผิดพลาด — คนละนิยาม (2.5, 2.6) ; ต้องระบุนิยามในเล่ม |
| 3 | Recall macro 6 กรณี | 61.65% (ALLOWED) — `RESULTS-TEMPLATE.md:97` | 58.5% (ALL) — `accuracy_output.txt`, `RESULTS-TEMPLATE.md:120` | คนละนิยาม ; **บทนี้ใช้ 61.65% (ALLOWED)** |
| 4 | Precision ของ V06_full | 81.8% (ALL) — `RESULTS-TEMPLATE.md:89` | 25.2% (ALLOWED) — `RESULTS-TEMPLATE.md:135` | คนละนิยาม ; **บทนี้ใช้ 25.2% (ALLOWED) ตั้งแต่ 2026-10-08** (2.10) |
| 5 | commit ที่ล็อกสำหรับ Final Evaluation | `1612888` — `objective1/README.md:4`, `MASTER-MATRIX.md:12` | `822656f` — `RESULTS-TEMPLATE.md:3` | ตรวจ git: `backend/` ไม่ต่างกันระหว่างสอง commit [ตรวจเอง] ; ใช้ `822656f` ตามที่รันจริง |
| 6 | สถานะการวิเคราะห์เชิงคุณภาพ `reason` | "ตรวจแล้ว 2026-09-30" — `RESULTS-TEMPLATE.md:230`, `:25`, `:70` | "ยังไม่ได้อ่าน reason field" — `RESULTS-TEMPLATE.md:240` และ `:27` | ประโยคที่ `:27` และ `:240` ล้าสมัย ; ใช้ผลใน `QUALITATIVE-REASON-ANALYSIS.md` |
| 7 | จำนวนรอบ/รัน ที่ใช้ในเอกสารแผนกับผลจริง | n=2–3 ต่อกรณี — `objective1/README.md` (ตาราง Protocol) | n สูงสุด 4 (2 rep × 2 tag) ; V07 3 — `metrics_combined.json` | แผนเป็นแค่ข้อเสนอ ; ใช้ n จริง |
| 8 | สถานะความพร้อมของ Objective 1/2/3/4 | "NOT READY / ยังไม่มี evidence / ยังไม่รัน Gemini" — `READINESS.md`, `MASTER-MATRIX.md` (ส่วนตาราง Readiness), `objective3/PROTOCOL.md`, `objective4/FUNCTIONAL-TEST.md:3` | มีผลจริงแล้ว (Obj.1/2/4A) — `RESULTS-TEMPLATE.md` | ไฟล์แผนไม่ได้อัปเดตหลังรัน ; ใช้ `RESULTS-TEMPLATE.md` เป็นแหล่งสถานะ |
| 9 | จำนวนรันที่ใช้ในการวิเคราะห์ `reason` เทียบจำนวนรันที่มีเมตริก | A 19 รัน / B 29 รัน — `QUALITATIVE-REASON-ANALYSIS.md:14-15` | A 17 รัน / B 27 รัน มีเมตริก — `metrics_combined.json` | ผลต่าง 2 รัน/ฝั่ง = V01_full sanity (ไม่มีเฉลย จึงไม่มีเมตริกแต่มี reason) |
| 10 | ส่วนต่าง Recall ของ V03_summary (B−A) | +26.8 — `QUALITATIVE-REASON-ANALYSIS.md:91` | +26.88 ที่นี่ | ไฟล์ผลลบจากค่าที่ปัดทศนิยม 1 ตำแหน่ง |
| 11 | ขอบเขตของ 4A "ผ่าน" | "33/33 ผ่าน, 4A เสร็จสมบูรณ์" — `RESULTS-TEMPLATE.md:53, 62, 274` | ไม่ได้ทดสอบ 4 แถว + ผ่านบางส่วน 1 แถวใน API ; UI ทั้งหมด self-reported บนคลิปที่ไม่ใช่ V04 | ระบุข้อจำกัดในเล่มทุกครั้งที่อ้างว่า 4A ผ่าน |

### 6.3 รายการที่ยังไม่มีผล (ไม่พบ)

- **Objective 3 (ความถูกต้องของคำบรรยาย)** — ไม่มี reference transcript / reference timing / ผลเมตริก ; metric ตาม Test Plan ยังไม่ยืนยัน (ส่วน 4).
- **Objective 4B** (ผู้เชี่ยวชาญ), **4C** (ผู้ใช้/แบบสอบถาม/SUS), **4D** (Manual vs AI-assisted) — ไม่ได้เริ่ม (5.4).
- **เมตริก/เวลา:** เวลาตอบสนองของหน้าเว็บ, เวลาต่อคำขอ Gemini ใน harness, เวลาที่ผู้ใช้ใช้แก้ — ไม่พบ ; เวลาประมวลผลของ V01 และ V03 — ไม่พบ log (5.3).
- **สเปกเครื่อง:** รุ่นซีพียู/จำนวนคอร์/ระบบปฏิบัติการของเครื่องรันระบบ และสเปกเครื่องของผู้ทดสอบ UI — ไม่พบ (0.2).
- **branch** ที่ checkout ตอนรัน Objective 1/2 และ commit ที่ผู้ทดสอบ UI ใช้ — ไม่พบ (0.1).
- **ผู้จัดทำเฉลยและผู้ตรวจเฉลยคนที่สอง / ค่าความสอดคล้องผู้ติดป้าย** — ไม่พบ (ส่วน 1).
- **V01:** ไม่มีเฉลย จึงไม่มีเมตริกใด ๆ (เป็น sanity run) ; ไม่พบชื่อ/ลักษณะเนื้อหา.
- **Objective 2 should-do tier (n=4)** และ **ข้อมูล post-fix (`e136e8a`)** ของ Objective 1/2 — ไม่ได้เก็บ (โควตา Gemini หมด) (2.7, 3.5).
- **การทดสอบ error handling** ไฟล์ผิดชนิด/เสียผ่าน API (4A API) — ไม่ได้ทดสอบ ; ผ่านเฉพาะ UI ข้อ 31–32 แบบรายงานเอง.
- **Whisper สดผ่าน pipeline จริงหลัง rebuild** — ไม่เคยทดสอบ (4A run2/run3 ใช้ Cache HIT — `checklist_result.md` ท้ายไฟล์).

### 6.4 ข้อจำกัดของข้อมูล

- **จำนวนรอบน้อย:** 2–4 รอบต่อกรณี (V07_full 3) ; รอบของ "rep × tag" ใช้โค้ดเดียวกันเป็นการรันซ้ำ ไม่ใช่การเปรียบเทียบโค้ดต่างกัน ; S.D. จากไม่เกิน 4 ค่าไม่เหมาะกับการอนุมานเชิงสถิติ — ควรเขียนเป็นแนวโน้ม (`RESULTS-TEMPLATE.md:26, 184`).
- **ความแปรปรวนของ Gemini สูง:** Recall ของ V03_summary รายรอบตั้งแต่ 0.00 ถึง 100.00, V04_full 0.00–52.38, V06_summary 32.88–88.25 ; ไฟล์เดียวกันอัปซ้ำได้ผลตัดต่างกัน (4A) → ค่าเฉลี่ยขึ้นกับว่าสุ่มได้รอบแบบใด.
- **ตัวเลข Accuracy ถูกเงินเฟ้อด้วย TN** — ต้องรายงานคู่ baseline และ Specificity เสมอ (2.4 ; `RESULTS-TEMPLATE.md:145-148`). เวลาที่ไม่ได้ติดป้ายถูกนับเป็น "ควรเก็บ" โดยอัตโนมัติ (FP บางส่วนอาจเป็นการตัดที่ถูกแต่ผู้ติดป้ายไม่ได้ระบุ).
- **ความแม่นของเฉลย:** ช่วงเวลาจดมือทีละวินาที (ส่วนใหญ่ลงเวลาเป็นจำนวนเต็มวินาที) แต่ metric ใช้ทศนิยม 0.1 วินาที ; ไม่มีผู้ติดป้ายคนที่สอง.
- **คลิป 7 คลิปเป็นการพูดหน้ากล้องทั้งหมด** — ไม่มี outro/CTA/สไลด์ → ตอบเรื่องผลของภาพไม่ได้ (3.5) ; V05 เป็นคลิปควบคุมไม่มีช่วงควรตัด ; V03_full ไม่มี Recall โดยดีไซน์.
- **ข้อมูล pre-fix ทั้งหมด** (HEAD `822656f`) ; ไม่มีข้อมูล post-fix ; รอบ A ของ rep1 ส่วนใหญ่ล้มเหลว (key ใช้ไม่ได้/โควตา).
- **วัดเวลารอบเดียว (n=1)** ทุกแถวใน 5.3 ; ปนกันระหว่าง Whisper สดกับ Cache HIT ; ชุด 2026-09-21 รันก่อน rebuild.
- **4A API ทดสอบกับ V02 คลิปเดียว** โดยจำลอง selection และการแก้ซับ (AI เสนอ 0 ช่วงตัด) ; ตรวจเฟรมซับจุดเดียว.
- **4A UI เป็น self-reported** โดยเพื่อนร่วมทีม 1 คน บนคลิปที่ไม่ใช่ V04 อัป 2 รอบ ; ข้อ 8 และ 32 คลุมเครือ ; เอกสาร log-analysis สร้างโดย Claude Code บนเครื่องเพื่อน ตรวจซ้ำไม่ได้.
- **การเขียนเล่ม:** ห้ามอ้างว่าผู้ทดสอบ UI เป็นผู้ใช้จริง (4C) หรือผู้เชี่ยวชาญ (4B) ; ห้ามรวมผล run3 (V04, n=1) หรือ 4A เข้ากับเมตริก Objective 1.

---
*สร้างจากสคริปต์อ่านอย่างเดียว ; ไฟล์ที่ถูกเปิดอ่านระหว่างสร้างเอกสารนี้: 110 ไฟล์ (รายการด้านล่าง)*

<details><summary>รายการไฟล์ที่อ่าน</summary>

- `docker-compose.yml`
- `eval/V02/ground_truth.txt`
- `eval/V02/worker.log`
- `eval/V03/ground_truth.txt`
- `eval/V04/ground_truth.txt`
- `eval/V04/worker.log`
- `eval/V05/ground_truth.txt`
- `eval/V06/ground_truth.txt`
- `eval/V07/ground_truth.txt`
- `eval/V07/worker.log`
- `eval/final-evaluation-plan.md`
- `eval/final-evaluation/EXECUTION-PLAN.md`
- `eval/final-evaluation/MASTER-MATRIX.md`
- `eval/final-evaluation/READINESS.md`
- `eval/final-evaluation/RESULTS-TEMPLATE.md`
- `eval/final-evaluation/objective1/README.md`
- `eval/final-evaluation/objective1/accuracy/accuracy_output.txt`
- `eval/final-evaluation/objective1/accuracy/accuracy_raw.json`
- `eval/final-evaluation/objective1/accuracy/obj1_accuracy.py`
- `eval/final-evaluation/objective1/metrics_combined.json`
- `eval/final-evaluation/objective1/metrics_combined_pretty.txt`
- `eval/final-evaluation/objective1/rep1/after/V02_full/preview.json`
- `eval/final-evaluation/objective1/rep1/after/V03_full/preview.json`
- `eval/final-evaluation/objective1/rep1/after/V03_summary/preview.json`
- `eval/final-evaluation/objective1/rep1/after/V04_full/preview.json`
- `eval/final-evaluation/objective1/rep1/after/V05_full/preview.json`
- `eval/final-evaluation/objective1/rep1/after/V06_full/preview.json`
- `eval/final-evaluation/objective1/rep1/after/V06_summary/preview.json`
- `eval/final-evaluation/objective1/rep1/after/V07_full/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V02_full/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V03_full/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V03_summary/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V04_full/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V05_full/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V06_full/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V06_summary/preview.json`
- `eval/final-evaluation/objective1/rep1/control-old/V07_full/preview.json`
- `eval/final-evaluation/objective1/rep1_out.txt`
- `eval/final-evaluation/objective1/rep2/after/V02_full/preview.json`
- `eval/final-evaluation/objective1/rep2/after/V03_summary/preview.json`
- `eval/final-evaluation/objective1/rep2/after/V04_full/harness.log`
- `eval/final-evaluation/objective1/rep2/after/V04_full/preview.json`
- `eval/final-evaluation/objective1/rep2/after/V06_full/preview.json`
- `eval/final-evaluation/objective1/rep2/after/V06_summary/preview.json`
- `eval/final-evaluation/objective1/rep2/after/V07_full/harness.log`
- `eval/final-evaluation/objective1/rep2/control-old/V02_full/preview.json`
- `eval/final-evaluation/objective1/rep2/control-old/V03_summary/harness.log`
- `eval/final-evaluation/objective1/rep2/control-old/V03_summary/preview.json`
- `eval/final-evaluation/objective1/rep2/control-old/V04_full/preview.json`
- `eval/final-evaluation/objective1/rep2/control-old/V06_full/preview.json`
- `eval/final-evaluation/objective1/rep2/control-old/V06_summary/preview.json`
- `eval/final-evaluation/objective1/rep2/control-old/V07_full/preview.json`
- `eval/final-evaluation/objective1/rep3/after/V07_full/harness.log`
- `eval/final-evaluation/objective1/rep3/control-old/V07_full/harness.log`
- `eval/final-evaluation/objective2/QUALITATIVE-REASON-ANALYSIS.md`
- `eval/final-evaluation/objective2/metrics_combined.json`
- `eval/final-evaluation/objective2/qualitative/obj2_reasons.json`
- `eval/final-evaluation/objective2/qualitative/obj2_tally.py`
- `eval/final-evaluation/objective2/qualitative/reasons_by_case.txt`
- `eval/final-evaluation/objective2/qualitative/tally.txt`
- `eval/final-evaluation/objective2/rep1/after/V02_full/harness.log`
- `eval/final-evaluation/objective2/rep1/after/V03_full/harness.log`
- `eval/final-evaluation/objective2/rep1/after/V03_summary/harness.log`
- `eval/final-evaluation/objective2/rep1/after/V04_full/harness.log`
- `eval/final-evaluation/objective2/rep1/after/V05_full/preview.json`
- `eval/final-evaluation/objective2/rep1/after/V06_full/harness.log`
- `eval/final-evaluation/objective2/rep1/after/V06_summary/harness.log`
- `eval/final-evaluation/objective2/rep1/after/V07_full/harness.log`
- `eval/final-evaluation/objective2/rep1/control-old/V02_full/harness.log`
- `eval/final-evaluation/objective2/rep1/control-old/V03_full/harness.log`
- `eval/final-evaluation/objective2/rep1/control-old/V03_summary/harness.log`
- `eval/final-evaluation/objective2/rep1/control-old/V04_full/preview.json`
- `eval/final-evaluation/objective2/rep1/control-old/V05_full/preview.json`
- `eval/final-evaluation/objective2/rep1/control-old/V06_full/harness.log`
- `eval/final-evaluation/objective2/rep1/control-old/V06_summary/harness.log`
- `eval/final-evaluation/objective2/rep1/control-old/V07_full/harness.log`
- `eval/final-evaluation/objective2/rep2/after/V02_full/harness.log`
- `eval/final-evaluation/objective2/rep2/after/V02_full/preview.json`
- `eval/final-evaluation/objective2/rep2/after/V03_full/preview.json`
- `eval/final-evaluation/objective2/rep2/after/V03_summary/preview.json`
- `eval/final-evaluation/objective2/rep2/after/V04_full/preview.json`
- `eval/final-evaluation/objective2/rep2/after/V06_full/preview.json`
- `eval/final-evaluation/objective2/rep2/after/V06_summary/preview.json`
- `eval/final-evaluation/objective2/rep2/after/V07_full/preview.json`
- `eval/final-evaluation/objective2/rep2/control-old/V02_full/preview.json`
- `eval/final-evaluation/objective2/rep2/control-old/V03_full/preview.json`
- `eval/final-evaluation/objective2/rep2/control-old/V03_summary/harness.log`
- `eval/final-evaluation/objective2/rep2/control-old/V03_summary/preview.json`
- `eval/final-evaluation/objective2/rep2/control-old/V04_full/preview.json`
- `eval/final-evaluation/objective2/rep2/control-old/V06_full/preview.json`
- `eval/final-evaluation/objective2/rep2/control-old/V06_summary/preview.json`
- `eval/final-evaluation/objective2/rep2/control-old/V07_full/preview.json`
- `eval/final-evaluation/objective3/DATA-SETUP.md`
- `eval/final-evaluation/objective3/PROTOCOL.md`
- `eval/final-evaluation/objective4/FUNCTIONAL-TEST.md`
- `eval/final-evaluation/objective4/PARTICIPANT-PLAN.md`
- `eval/final-evaluation/objective4/PROTOCOL.md`
- `eval/final-evaluation/objective4/UI-MANUAL-CHECKLIST.md`
- `eval/final-evaluation/objective4/functional/job-5ab40c1a/INVESTIGATION-NOTES.md`
- `eval/final-evaluation/objective4/functional/run2-post-rebuild/checklist_result.md`
- `eval/final-evaluation/objective4/functional/run2-post-rebuild/process_log.txt`
- `eval/final-evaluation/objective4/functional/run2-post-rebuild/render_log.txt`
- `eval/final-evaluation/objective4/functional/run2-post-rebuild/upload_time.txt`
- `eval/final-evaluation/objective4/functional/run3-v04-repeat/SUMMARY.md`
- `eval/final-evaluation/objective4/functional/run3-v04-repeat/process_log.txt`
- `eval/final-evaluation/objective4/functional/teammate-ui-test-2026-09-26/LOG-ANALYSIS-FROM-TEAMMATE.md`
- `eval/final-evaluation/objective4/functional/teammate-ui-test-2026-09-26/UI-TEST-RESULTS-FROM-TEAMMATE.md`
- `eval/pre-final-audit.md`
- `eval/tools/score.py`
- `eval/worker_all.log`

</details>
