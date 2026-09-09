<div align="center">

# 🎬 AI Video Smart Editor

**Automated video editor powered by Whisper + Gemini · วิเคราะห์ทั้งภาพและเสียง · GPU-accelerated · Thai/English bilingual**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)
[![CUDA](https://img.shields.io/badge/CUDA-12.4-76B900.svg)](https://developer.nvidia.com/cuda-zone)

อัปโหลดวิดีโอ → AI **ฟังเสียงและดูภาพ** → ตัดเฉพาะส่วนสำคัญ → ตรวจ/แก้เองได้ก่อนตัดจริง → ได้วิดีโอที่กระชับขึ้น พร้อม subtitle อัตโนมัติ

</div>

---

## ✨ Features

### Core
- 🎯 **2 โหมดตัด** — `full` (คลีนนิ่ง ไม่ตัดเนื้อหา) / `summary` (สรุปให้เข้าใจครบ)
- 🎬 **2 Output formats** — Standard 16:9 และ TikTok/Reels 9:16 (เลือกได้ว่าจะ **เห็นครบ** หรือ **เต็มจอ**)
- 👁️ **วิเคราะห์ภาพ** — ตรวจฉากเปลี่ยน/จอดำ/ภาพค้าง + **ส่งคีย์เฟรมให้ Gemini ดู** ตอนตัดสินใจตัด
- 📝 **Subtitle อัตโนมัติ** — PyThaiNLP word tokenizer + smart sentence boundary
- 🇹🇭 **Bilingual support** — Thai-native + English embedded → auto-translate
- ⚡ **GPU Acceleration** — CUDA + Whisper float16 + BatchedInferencePipeline
- 🛡️ **Multi API Key fallback** — auto-switch เมื่อ quota หมด

### Advanced
- 🎛️ **Preview แบบแก้ได้จริง** — เห็นช่วงที่ AI ตัดออกและกดเอากลับได้ · ขยับขอบทีละ 1 วิ–1 นาที ·
  **แยก/รวมช่วง** เองเพื่อทำไฮไลต์ · แถบไทม์ไลน์พร้อมขีดจุดฉากเปลี่ยน
- ✏️ **Subtitle Editor** — แก้ subtitle ทีละบรรทัด **เฉพาะช่วงที่เลือกไว้จริง** ก่อน burn-in
- 🩹 **ซ่อมท่อนที่ Whisper หลอน** — Pass 3 ตรวจ repetition loop แล้วถอดเสียงใหม่ กู้เนื้อหาที่หายกลับมา
- 🤖 **AI Post-correction** — Gemini แก้ชื่อเฉพาะ + แปลประโยค English ↔ Thai
- 🎙️ **Topic-aware Whisper** — initial_prompt ตาม preset ช่วยให้ accuracy +10-15%
- 🔧 **Whisper Gap-fill** — Pass 2 รับฟัง English embedded ที่ Pass 1 ข้าม
- 💾 **Audio hash cache** — re-upload วิดีโอเดิม = instant result (<10s)
- 🛠️ **Guard เชิงโครงสร้าง** — ตรวจว่าประเด็นหลักไม่หาย / ขอบตัดจบประโยค / คลิปไม่จบห้วน
  (ไม่พึ่งคำสั่งในพรอมป์อย่างเดียว — ดู [CLAUDE.md](CLAUDE.md))

---

## ⚡ Performance

ทดสอบกับวิดีโอ podcast 19 นาที (Warren Buffett Investment Talk):

| Stage | Original | Optimized (Pack X+Y) |
|---|---|---|
| Audio extract + VAD | 1 min | 1 min |
| 🎙️ Whisper transcribe | 13 min | **2 min** (BatchedInference x4) |
| 🤖 AI Correction | 3 min | **1.5 min** (parallel 2 keys) |
| 🎯 AI Deletion | 1.5 min | parallel with correction |
| 🎞️ FFmpeg render | 2 min | 2 min |
| **Total (first run)** | **22 min** | **~7 min** ⚡ |
| **Repeat upload** | 22 min | **<10s** 🚀 (cache hit) |

---

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend      │   React 19 + Vite + Tailwind
│   (port 80)     │   Browser → Preview / Edit subtitle
└────────┬────────┘
         │ HTTP/JSON
┌────────▼────────┐
│   Backend API   │   FastAPI + Pydantic validation
│   (port 8000)   │   Upload / Status / Render / Subtitle CRUD
└────────┬────────┘
         │
┌────────▼────────────────────────────────────────────┐
│              Celery Worker                          │
│  ┌───────────────────────────────────────────────┐  │
│  │ 1. extract_clean_audio (FFmpeg + loudnorm)    │  │
│  │ 2. VAD (Silero) — detect voice activity       │  │
│  │ 2b. Visual signals (ฉากเปลี่ยน/จอดำ/ภาพค้าง)   │  │
│  │ 3. Whisper Pass 1 (BatchedInferencePipeline)  │  │
│  │ 4. Whisper Pass 2 (gap-fill English embed)    │  │
│  │ 4b. Whisper Pass 3 (ซ่อมท่อนที่หลอน)          │  │
│  │ 5. AI Correction + Deletion (parallel)        │  │
│  │    Deletion เห็นทั้ง transcript และคีย์เฟรม    │  │
│  │ 6. Guard 4 ชั้น (outline/outro/snap/จบประโยค) │  │
│  │ 7. Phrase generation (sentence-aware)         │  │
│  │ 8. FFmpeg render (cut + concat + burn-in SRT) │  │
│  └───────────────────────────────────────────────┘  │
└─────┬───────────────────────────────┬───────────────┘
      │                               │
┌─────▼─────┐                  ┌──────▼──────┐
│   Redis   │                  │   GPU       │
│ (queue)   │                  │  (NVIDIA)   │
└───────────┘                  └─────────────┘
```

### Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 · Vite · Tailwind CSS · Axios |
| **Backend** | FastAPI · Pydantic · Python 3.11 |
| **Queue** | Celery + Redis |
| **Transcription** | faster-whisper 1.2 (BatchedInference) |
| **AI Analysis** | Google Gemini 2.5/2.0/3-flash |
| **Audio** | Silero VAD + FFmpeg afftdn + loudnorm |
| **Visual** | FFmpeg scdet / blackdetect / freezedetect + คีย์เฟรมส่งเข้า Gemini |
| **Video** | FFmpeg libx264 + ASS subtitle burn-in |
| **Thai NLP** | PyThaiNLP newmm tokenizer |
| **GPU** | NVIDIA CUDA 12.4 + PyTorch + float16 |
| **Container** | Docker Compose (4 services) |

---

## 📋 Requirements

| Component | Min | Recommended |
|---|---|---|
| **OS** | Linux / Windows 11 + WSL2 | Linux |
| **GPU** | NVIDIA RTX 30-series 6GB | RTX 40-series 12GB+ |
| **VRAM** | 6 GB | 12+ GB (batch_size 8+) |
| **RAM** | 8 GB | 16 GB |
| **Disk** | 30 GB | 100 GB SSD |
| **Docker** | Docker Compose v2 + NVIDIA Container Toolkit | |
| **Gemini API Key** | 1 key (free tier) | 2+ keys (parallel calls) |

---

## 🚀 Quick Start

### 1. Clone

```bash
git clone https://github.com/Chirayut001/ai-video-editor.git
cd ai-video-editor
```

### 2. Configure API keys

```bash
cp backend/.env.example backend/.env
```

แก้ `backend/.env`:

```env
# 1 key (basic)
GEMINI_API_KEYS=AIzaSy...your_key...

# 2+ keys (parallel calls — 2x faster on AI Correction)
GEMINI_API_KEYS=AIzaSy...key1...,AIzaSy...key2...

REDIS_URL=redis://redis:6379/0
```

> 💡 ขอ Gemini API key ฟรีจาก [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3. Build + Start

```bash
docker compose up -d --build
```

> ⏱️ ครั้งแรกใช้เวลา 5-15 นาที (download CUDA image + PyTorch + Whisper model)

### 4. Open

| Service | URL |
|---|---|
| 🌐 **Web UI** | http://127.0.0.1 |
| 🔌 API docs | http://127.0.0.1:8000/docs |
| ❤️ Health | http://127.0.0.1:8000/health |

---

## 📖 Usage

1. **Upload** วิดีโอ (.mp4, .mov, .mkv) ขนาด ≤ 2GB
2. **เลือกโหมดตัด** — `เก็บเนื้อหาครบ` (คลีนนิ่ง) หรือ `สรุปให้เข้าใจครบ`
3. **เลือกสัดส่วน** — แนวนอน 16:9 หรือ แนวตั้ง 9:16
   (ถ้าเลือกแนวตั้ง จะมีให้เลือกอีกว่า **เห็นครบ** หรือ **เต็มจอ** — ดู [`tiktok_fit`](#การแปลงเป็น-916-tiktok_fit))
4. **เลือกหัวข้อคลิป** (ไม่บังคับ) — ไพรม์คำศัพท์ให้ Whisper ถอดเสียงแม่นขึ้น
   `วิดีโอสอน` / `พอดแคสต์` / `รีวิวสินค้า` / `Vlog`
5. **บอก AI เพิ่ม** ในช่องข้อความได้ เช่น `"เก็บช่วงที่พูดถึงราคา"` (ไม่บังคับ)
6. ☑ **Preview Mode** (แนะนำมาก — ตรวจและแก้เองก่อน render) · ☑ **ใส่ subtitle อัตโนมัติ**
7. กด **Submit** → รอ ~5-7 นาที (วิดีโอ 10-20 นาที)
8. **หน้า Preview** — ตรงนี้คือหัวใจ
   - ติ๊ก/ติ๊กออกทีละช่วง · ช่วงที่ AI ตัดออกก็กดเอากลับมาได้
   - **ขยับขอบ** ทีละ 1 วิ / 5 วิ / 15 วิ / 1 นาที พร้อมเล่นให้ฟังรอยตัด
   - **แยกช่วง** ตรงตำแหน่งที่เล่นอยู่ แล้ว **รวมกลับ** ได้ถ้าเปลี่ยนใจ
   - แถบไทม์ไลน์มีขีดบอกจุดฉากเปลี่ยน กดปุ่ม `‹ ฉาก ›` กระโดดไปให้ตรงจุด
9. **Edit Subtitle** — แก้คำที่ผิด (เห็นเฉพาะบรรทัดของช่วงที่เลือกไว้จริง)
10. **Render** → ดาวน์โหลด

> **ทำไฮไลต์สั้น ๆ:** ที่หน้า Preview กด `ล้าง` → เลื่อนวิดีโอไปจุดที่ชอบ → `แยกตรงนี้` สองครั้ง
> → ติ๊กเฉพาะช่วงตรงกลาง

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEYS` | required | Gemini key(s), comma-separated |
| `GEMINI_MODELS` | `gemini-2.5-flash,gemini-3.6-flash` | fallback chain — แก้ได้ถ้า Google ปิด model เก่า (404) |
| `REDIS_URL` | `redis://redis:6379/0` | Redis broker URL |
| `WHISPER_BATCH_SIZE` | `4` | Batched inference batch size (↑ = faster, ↑ VRAM) |
| `WHISPER_MODEL` | `medium` (GPU) / `small` (CPU) | Whisper model size. `WHISPER_MODEL_CPU` / `WHISPER_MODEL_CUDA` override per-device. ↑ = แม่นขึ้น, ช้าลง (CPU ~2-3x) |
| `SUBTITLE_LEAD_TIME` | `0.18` | วินาทีที่ subtitle ขึ้นก่อนเสียง (`0.05` = ตามเสียงเป๊ะ, `0.25` = ขึ้นก่อนเยอะ) |
| `SUBTITLE_MAX_CHARS` | `28` | ความยาวสูงสุดต่อบรรทัดซับ (↑ = บรรทัดยาวขึ้น, เบรกกลางประโยคน้อยลง) |
| `SUBTITLE_MAX_DURATION` | `2.2` | เวลาสูงสุดต่อบรรทัดซับ (วินาที) |
| `FILTERGRAPH_MAX_SEGMENTS` | `80` | ถ้าจำนวนช่วงตัด ≤ ค่านี้ → render แบบ 1-pass (frame-accurate); เกินกว่านี้ fallback ไป per-part |
| `SILENCE_HINT_MIN_GAP` | `3.0` | ช่องว่างในทรานสคริปต์ที่ยาว ≥ ค่านี้ (วินาที) → ส่งเป็น hint ให้ Gemini พิจารณาตัดออก (AI ตัดเอง ไม่ตัดแบบกลไก) |
| `HOOK_LEAD_FIRST` | `0` | โหมด `hook`: `1` = เอาช่วง role=hook ขึ้นก่อน (ที่เหลือเรียงตามเวลา) ; `0` = เรียงตามเวลาล้วน |
| `SUMMARY_OUTLINE` | `1` | โหมด `summary`: `1` = ให้ AI ร่าง outline ประเด็นหลักก่อนตัด แล้วตรวจว่าประเด็น core ครบ ; `0` = ปิด (พฤติกรรมเดิม, ประหยัด Gemini 1 call) |
| `SUMMARY_OUTLINE_MIN_COVERAGE` | `0.35` | เนื้อหาแนวอธิบาย/สอน: ประเด็น core ที่เหลืออยู่น้อยกว่าสัดส่วนนี้ → คืนช่วงนั้นกลับอัตโนมัติ (↑ = คืนบ่อยขึ้น/ผลลัพธ์ยาวขึ้น) |
| `SUMMARY_OUTLINE_MIN_COVERAGE_NARRATIVE` | `0.6` | เนื้อหาแนวเล่าเรื่อง (ประวัติศาสตร์/สารคดี): เกณฑ์เดียวกันแต่สูงกว่า — เรื่องเล่าเหลือครึ่งเดียวก็ตามไม่ทันแล้ว |
| `NARRATIVE_MERGE_GAP` | `8.0` | เนื้อหาแนวเล่าเรื่อง: รอยตัดที่สั้นกว่าค่านี้ (วินาที) จะถูกคืนกลับ — กันอาการ "ดูกระโดด ไม่ได้ใจความ" (↑ = ต่อเนื่องขึ้นแต่ตัดได้น้อยลง) |
| `OUTRO_SEARCH_WINDOW` | `180.0` | ค้นคำพูดปิดคลิป ("แล้วพบกันใหม่", "ขอบคุณที่รับชม") ย้อนหลังจากคำพูดสุดท้ายกี่วินาที — ถ้าถูกตัดทิ้งจะคืนกลับอัตโนมัติ กันคลิปจบห้วน |
| `OUTRO_LEAD` | `20.0` | เก็บเนื้อหา "เกริ่นก่อนจบ" (สรุปส่งท้าย) ก่อนถึงคำลากี่วินาที |
| `OUTRO_MIN_TAIL` | `25.0` | ตัวกันขั้นต่ำ: เสียงพูดกี่วินาทีสุดท้ายที่ต้องเก็บเสมอ แม้ Whisper ถอดคำลาเพี้ยนจนไม่แมตช์ (`0` = ปิด พึ่งการแมตช์คำลาอย่างเดียว) |
| `OUTRO_END_TOLERANCE` | `1.5` | คลิปจบก่อนคำพูดสุดท้ายได้ไม่เกินกี่วินาที ถึงยังถือว่าจบสมบูรณ์ — เกินกว่านี้จะคืนช่วงท้ายกลับ |
| `OUTRO_MAX_RESTORE` | `90.0` | เพดานความยาวที่ยอมคืนกลับตอนท้าย (วินาที) |
| `SENTENCE_PAUSE` | `0.45` | ช่องว่างระหว่างท่อนถอดเสียงที่ยังถือว่า "พูดต่อเนื่อง" — ใช้ยืดขอบตัดให้จบประโยคจริง (↑ = ยืดไกลขึ้น, เสี่ยงเก็บเกิน) |
| `SNAP_MAX_EXTEND` | `6.0` | เพดานการยืดขอบตัดต่อด้าน (วินาที) กันกรณีพูดรัวไม่หยุด |
| `SNAP_MAX_SENTENCE` | เท่ากับ `SNAP_MAX_EXTEND` (`6.0`) | เพดานการ "กลืนท่อนถอดเสียงให้จบ" — เกินกว่านี้ใช้ขอบคำแทน ; เดิมตั้ง 25 บนสมมติฐานว่า 1 ท่อน ≈ 1 ประโยค แต่วัดจริงแล้วไม่จริง (p75 = 11.3 วิ) จนลาก filler กลับมา 14.5 วิ |
| `SNAP_MAX_THOUGHT` | `12.0` | เพดานการยืดต่อเมื่อท่อนลงท้ายด้วยคำเชื่อมที่ยังไม่เฉลย ("...ปรากฏว่า") — ข้ามการเว้นจังหวะก่อนเฉลยได้ |
| `THOUGHT_GRACE` | `0` (ปิด) | ยืดเพิ่ม 1 ท่อนเมื่อท่อนถัดไปเริ่มเร็วกว่าค่านี้ แม้ไม่มีคำเชื่อมให้จับ — **ปิดไว้โดยตั้งใจ** เพราะเปิดแล้วมันยิงที่เกือบทุกรอยตัด แล้วดึงประโยคแรกของช่วงที่ถูกลบเข้ามา ทำให้เนื้อหากระโดดทั้งคลิป |
| `LAST_SENTENCE_MAX_EXTEND` | `20.0` | เพดานการยืด **ช่วงสุดท้ายของคลิป** ให้พูดจบประโยค (กว้างกว่าจุดอื่นโดยตั้งใจ — คลิปจบกลางประโยคดูเหมือนไฟล์เสีย) |
| `HOOK_LENGTH_TOLERANCE` | `0.3` | โหมด `hook`: ยอมให้ผลรวมเกิน `target_length` ได้กี่เท่า (`0.3` = +30% ; hard cap = +60% เฉพาะตอนเติมให้ครบ 2 ช่วง) |
| `HOOK_MAX_SEGMENTS` | `5` | โหมด `hook`: จำนวนช่วงสูงสุด |
| `SENTENCE_END_MIN_GAP` | `0.35` | โหมด `hook`: ช่องว่างระหว่างท่อนถอดเสียง ≥ ค่านี้ = จุดจบประโยค (ใช้ snap ขอบช่วง) |
| `SENTENCE_SNAP_FWD` | `10.0` | โหมด `hook`: มองไปข้างหน้าจากขอบที่ AI เลือกกี่วินาที เพื่อหาจุดจบประโยคจริง (กันประโยคขาด) |
| `TRANSCRIPT_CACHE_DIR` | `/app/transcript_cache` | Audio hash → transcript cache (ชื่อไฟล์มี version — bump เมื่อแก้ตรรกะที่กระทบ transcript) |

#### ซ่อมท่อนที่ Whisper หลอน (Pass 3)

Whisper ติด repetition loop ได้เมื่อเสียงฟังยาก — พ่นคำเดิมซ้ำเป็นร้อยรอบแล้วเนื้อหาจริงหาย
เกณฑ์ทั้งหมดวัดจาก transcript จริง 3,073 segment

| Variable | Default | Description |
|---|---|---|
| `HALLUC_LOOP_RATIO` | `0.70` | สัดส่วนที่หน่วยเดิมซ้ำติดกัน ≥ 3 รอบ เกินค่านี้ = วนลูป (เนื้อหาจริงสูงสุดที่วัดได้ 0.61) |
| `HALLUC_MAX_CPS` | `2.0` | ตัวอักษร/วินาที ต่ำกว่านี้บนท่อนยาว = ผิดปกติ (ค่ากลางของจริง 13.7) |
| `HALLUC_MIN_DUR` | `5.0` | ท่อนสั้นกว่านี้ไม่ตัดสินด้วย cps (คนเว้นจังหวะกลางประโยคเป็นเรื่องปกติ) |
| `HALLUC_MIN_LOGPROB` | `-2.0` | `avg_logprob` ของผลถอดใหม่ต่ำกว่านี้ = เดามั่ว ไม่รับ (อ่านไม่ออก -2.5 / ได้ใจความ -1.4) |

#### วิเคราะห์ภาพ

| Variable | Default | Description |
|---|---|---|
| `VISUAL_CONTEXT` | `1` | ส่งคีย์เฟรมให้ Gemini ดูตอนตัดสินใจตัด — `0` = ปิด กลับไปวิเคราะห์จากเสียงล้วน |
| `VISUAL_SCENE_THRESHOLD` | `15.0` | เกณฑ์ `scdet` สำหรับจุดฉากเปลี่ยน (score ของ scdet เทียบข้ามคลิปไม่ได้ แต่จำนวนจุดที่ 10–20 เทียบได้) |
| `VISUAL_SCENE_MIN_GAP` | `0.5` | จุดที่ห่างกันน้อยกว่านี้นับเป็นจุดเดียว (fade/dissolve ยิงติดกันหลายเฟรม) |
| `VISUAL_BLACK_MIN_DUR` | `0.3` | ความยาวขั้นต่ำของช่วงจอดำ (กรองแฟลชสั้น ๆ ทิ้ง) |
| `VISUAL_FREEZE_MIN_DUR` | `2.0` | ความยาวขั้นต่ำของภาพค้าง — ค่ายอดนิยม 0.5 หลวมเกิน (คลิปพูดหน้ากล้องได้ 29 ครั้งใน 7 นาที) |
| `VISUAL_WIDTH` | `320` | ย่อภาพก่อนวิเคราะห์ (คลิป 7–11 นาทีใช้ ~14 วินาที) |
| `VISUAL_TIMEOUT` | `900` | เกินนี้ยอมไม่มีสัญญาณภาพ ดีกว่าให้ทั้งงานค้าง |
| `KEYFRAME_MAX` | `20` | จำนวนภาพสูงสุดที่ส่งให้ Gemini ต่อคลิป (~258 โทเคน/ภาพ) |
| `KEYFRAME_WIDTH` | `512` | ความกว้างของภาพที่ส่ง |
| `KEYFRAME_QUALITY` | `7` | คุณภาพ mjpeg (2 ดีสุด – 31 แย่สุด) |
| `KEYFRAME_LEAD` | `0.5` | ขยับออกจากรอยต่อฉากกี่วินาที (เฟรมตรงรอยต่อมักเป็นภาพกลาง transition) |
| `KEYFRAME_MIN_GAP` | `3.0` | จุดที่ห่างกันน้อยกว่านี้ถือว่าเป็นภาพเดียวกัน |

#### Render 9:16

| Variable | Default | Description |
|---|---|---|
| `TIKTOK_BLUR_RADIUS` | `40` | ความแรงการเบลอพื้นหลังในโหมด "เห็นครบ" |
| `TIKTOK_BLUR_PASSES` | `4` | จำนวนรอบการเบลอ |

### Tuning Performance

ใน `docker-compose.yml` ปรับ `WHISPER_BATCH_SIZE` ตาม VRAM:

| GPU | Recommended |
|---|---|
| RTX 3050 6GB | `4` (default) |
| RTX 3060 12GB | `8` |
| RTX 4070+ | `16` |
| A100/H100 | `32+` |

### โหมดการตัด (`edit_mode`)

| โหมด | ทำอะไร | ความยาวผลลัพธ์ |
|---|---|---|
| `full` เก็บเนื้อหาครบ | คลีนนิ่ง — ตัดแค่ช่วงเงียบ / ติดขัด / ปัญหาเทคนิค **ไม่ตัดเนื้อหา** (การตัดสินใจเชิงเนื้อหาเป็นงานของคนตัดต่อ) | ≈ ต้นฉบับ − ส่วนน้ำ |
| `summary` สรุปให้เข้าใจครบ | Deletion แบบตัดหนัก — เก็บทุกประเด็นหลัก + context ให้ดูแทนคลิปเต็มได้ **AI ประเมินความยาวเอง** | ปกติ 10–40% ของต้นฉบับ ตามความแน่นของเนื้อหา |

### การแปลงเป็น 9:16 (`tiktok_fit`)

เลือกที่หน้าอัปโหลด มีผลเฉพาะเมื่อ**ต้นฉบับกว้างกว่า 9:16** (ต้นฉบับที่เป็นแนวตั้งอยู่แล้วสองโหมดให้ผลเท่ากัน)

| โหมด | ทำอะไร | เหมาะกับ |
|---|---|---|
| `blur` **เห็นครบ** (ค่าตั้งต้น) | ย่อทั้งเฟรมให้เห็นครบ แล้วเติมขอบด้วยภาพเดิมที่เบลอ | คลิปที่มีข้อความบนจอ ภาพเทียบซ้าย-ขวา กริดคลิปย่อย |
| `crop` **เต็มจอ** | ขยายจนเต็มจอแล้วตัดส่วนล้นทิ้ง | คลิปที่ subject อยู่กลางเฟรมตลอด |

วัดจากคลิปจริง 2.35:1 (1280×544): `crop` เก็บความกว้างต้นฉบับไว้แค่ **24%** — สุ่มดู 12 เฟรม
เสียหาย 10 (ข้อความเต็มบรรทัด 5 · ภาพเทียบซ้าย-ขวา 3 · กริด/b-roll 2) จึงตั้ง `blur` เป็นค่าตั้งต้น

`aspect` (16:9 / 9:16) แยกจาก `edit_mode` — ใช้กับโหมดไหนก็ได้
client เก่าที่ส่ง `edit_mode=short` หรือ `hook` → map เป็น `summary`

#### `hook` (ไฮไลต์ดึงคนดู) — ปิดไว้ 🚧

โหมด Selection ที่ให้ AI เลือก 2–5 ช่วงเด็ดมาต่อเป็นคลิปสั้น **ถูกปิดไว้** — โค้ดยังอยู่ครบใน
[`_analyze_hook_mode`](backend/core/ai_logic.py) เปิดกลับได้โดยเพิ่ม `"hook"` กลับเข้า
`ALLOWED_EDIT_MODES` ([backend/main.py](backend/main.py)) และคืนการ์ดใน `CUT_MODES`
([UploadScreen.jsx](frontend/src/components/UploadScreen.jsx))

**เหตุผลที่ปิด:** โหมดนี้ต้องทำ 3 อย่างพร้อมกัน — เลือกช่วงที่ "เด็ด" + ลงขอบให้ตรงประโยค +
คุมความยาวให้พอดี — แก้อย่างหนึ่งพังอีกอย่างทุกรอบ (แก้ไป 5 รอบยังไม่นิ่ง) และข้อแรกเป็น
**การตัดสินใจเชิงสร้างสรรค์** ที่ขึ้นกับกลุ่มเป้าหมาย ซึ่ง AI อ่านแค่ transcript แล้วตัดสินได้ไม่แม่น

**ทำไฮไลต์แทนได้ที่หน้า preview**: รัน `summary` → กด `ล้าง` → ติ๊กเฉพาะช่วงที่ต้องการ → ตัดต่อ
วิธีนี้ให้ผลดีกว่าเพราะคนตัดสินใจเองว่าช่วงไหนน่าสนใจ (human-in-the-loop)

> env `HOOK_*` / `SENTENCE_*` ด้านบนมีผลเฉพาะเมื่อเปิดโหมดนี้กลับมา

### Subtitle Sync

- Subtitle timing ใช้ **word-level timestamps** จาก Whisper โดยตรง (ตัดวรรคที่จังหวะหยุดพูดจริง)
  ถ้า transcript ถูก AI แปล/เขียนใหม่จน word ไม่ตรง จะ fallback ไปเฉลี่ยเวลาตามตัวอักษร
- การตัด+รวมคลิปทำใน `filter_complex` pass เดียว → **frame/sample-accurate** ไม่มี A/V drift สะสม
  → subtitle อยู่บน timeline เดียวกับวิดีโอ output เป๊ะ
- ปรับ lead time (subtitle ขึ้นก่อนเสียง) ผ่าน env `SUBTITLE_LEAD_TIME` — เช่น `SUBTITLE_LEAD_TIME=0.05`

---

## 🗂️ Project Structure

```
ai-video-editor/
├── backend/
│   ├── core/
│   │   ├── ai_logic.py        # Whisper + Gemini + cache + parallel calls
│   │   ├── ffmpeg_utils.py    # Audio extract + cut + concat + burn subtitle
│   │   ├── srt_utils.py       # SRT generation + phrase splitting + lead time
│   │   ├── vad_logic.py       # Silero VAD wrapper
│   │   └── visual_logic.py    # สัญญาณจากภาพ + ดึงคีย์เฟรมให้ Gemini
│   ├── main.py                # FastAPI app (endpoints)
│   ├── tasks.py               # Celery tasks (process_video + render_only)
│   ├── requirements.txt
│   ├── Dockerfile             # CUDA base + Python deps
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # State machine: processing/preview/editing/done
│   │   ├── components/
│   │   │   ├── UploadScreen.jsx
│   │   │   ├── Processing.jsx
│   │   │   ├── PreviewScreen.jsx
│   │   │   ├── SegmentRow.jsx        # แถวช่วง (ติ๊ก/ขยับขอบ/แยก/รวม)
│   │   │   ├── TimelineStrip.jsx     # แถบไทม์ไลน์ + ขีดฉากเปลี่ยน
│   │   │   ├── useTimelineRows.js    # โมเดลแถวทั้งหมด (pure, เทสต์ได้)
│   │   │   ├── time.js               # formatter เวลาที่ใช้ร่วมกัน
│   │   │   └── SubtitleEditScreen.jsx
│   │   └── config.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml          # 4 services (frontend / backend / worker / redis)
└── CLAUDE.md                   # กฎที่ห้ามพัง + กับดักที่เคยเจอ (อ่านก่อนแก้โค้ด)
```

---

## 🔬 Pipeline Details

### Whisper Optimization
- **medium model** บน CUDA float16 → ~3.5GB VRAM
- **BatchedInferencePipeline** → 3-4x faster (parallel chunks)
- **Topic-aware initial_prompt** → +10-15% accuracy
- **Pass 2 gap-fill** → catch English embedded ที่ Pass 1 ข้าม
- **Pass 3 ซ่อมท่อนที่หลอน** → ตรวจ repetition loop (คำเดิมซ้ำติดกัน / ตัวอักษรต่อวินาทีต่ำผิดปกติ)
  แล้วถอดเสียงช่วงนั้นใหม่ด้วยค่าที่ทนกว่า — รับผลใหม่เมื่อ `avg_logprob` ผ่านเกณฑ์ ไม่งั้นทิ้งท่อนนั้น
  (ไม่มีข้อมูลดีกว่ามีข้อมูลผิด เพราะข้อความหลอนจะไปหลอกทั้ง Gemini และการสร้างซับ)
- **Audio hash cache** → instant repeat for same audio

### Visual Analysis
- **ffmpeg pass เดียว** ย่อ 320px → จุดฉากเปลี่ยน (`scdet`) / จอดำ (`blackdetect`) / ภาพค้าง (`freezedetect`)
- จุดฉากเปลี่ยนแสดงเป็นขีดบนไทม์ไลน์หน้า preview + ปุ่ม `‹ ฉาก ›` กระโดดไปให้ตรงจุด
  (**ไม่ทำเป็น guard อัตโนมัติ** — มันจะยิงที่เกือบทุกรอยตัดแล้วทำให้เนื้อหากระโดด)
- คีย์เฟรมจาก `scene_cuts` + จุดกระจายทั่วคลิป ส่งเข้า Gemini พร้อม transcript ตอนตัดสินใจตัด
  → เห็นการ์ดปิดท้าย / สไลด์ที่กำลังอธิบาย / ภาพเสีย ซึ่ง transcript บอกไม่ได้

### AI Correction (Gemini)
- แก้ชื่อเฉพาะ (Andrew Huberman, Python, React)
- แปลประโยค English embedded → Thai
- คงชื่อเฉพาะเป็นอังกฤษ
- Parallel chunks ระหว่าง API keys (2x speedup)
- Auto-skip ถ้า transcript เป็นไทยล้วน
- payload ที่ส่งเหลือแค่ `start`/`end`/`text` — เดิมพก `words[]` ไปด้วยซึ่งกิน **96%** ของขนาด
  (คลิป 11 นาที 321,311 → 11,798 ตัวอักษร) ทำให้ Gemini ตอบช้าและโดน 503 บ่อย

### Sentence Boundary
- PyThaiNLP word tokenization (Thai)
- 4-level break priority: punctuation > end particle > conjunction > script transition
- Merge phrases <9 chars เข้ากับ neighbor
- Soft/hard char limits: 14/28

### Subtitle Burn-in
- Garuda font (Thai + Latin)
- Standard 16:9: FontSize 20, Outline 1, white text
- TikTok 9:16: FontSize 18, MarginV 30 (TikTok-style)
- 180ms lead time (subtitle ปรากฏก่อนเสียง)

---

## 🐳 Docker Commands

```bash
# Start
docker compose up -d

# Build + start (after code change)
docker compose up -d --build

# Watch logs
docker compose logs -f worker

# Rebuild single service
docker compose build worker
docker compose up -d --force-recreate worker

# Stop
docker compose down

# Stop + remove volumes (delete cache)
docker compose down -v
```

---

## 🧪 Testing

```bash
# Backend — integration test (เป็นสคริปต์ ไม่ใช่ pytest)
# ⚠️ ใช้ Gemini API จริงและ render จริง ช้าและเปลืองโควตา ไม่เหมาะกับการรันบ่อย
docker compose exec worker python test_core.py

# Frontend — ตรรกะไทม์ไลน์เป็น pure function ทั้งหมด เช็ก compile ด้วย esbuild ได้
cd frontend && npx esbuild src/components/<file>.jsx --loader:.jsx=jsx --bundle --outfile=/dev/null
```

**ตั้งค่า threshold ใหม่ให้วัดจากข้อมูลจริงก่อนเสมอ** — `backend/storage/*/preview.json`
มี transcript จริงหลายพัน segment ให้หาค่า percentile (ดู [CLAUDE.md](CLAUDE.md) กฎข้อ 3)

---

## 🛣️ Roadmap

### Planned
- [ ] **Face-aware crop** สำหรับ 9:16 — เป็นตัวเลือกที่ 3 เพิ่มจาก เห็นครบ/เต็มจอ
      (วัดแล้วยังไม่คุ้มเป็นตัวหลัก เหมาะเฉพาะคลิปพูดหน้ากล้องที่ถ่ายไวด์ — แผนละเอียดใน [CLAUDE.md](CLAUDE.md) §6.1)
- [ ] Multi-language subtitle (Thai-only / English-only / Bilingual)
- [ ] Subtitle-only mode (ไม่ตัด — แค่ใส่ subtitle)
- [ ] Custom dictionary (user-provided proper nouns)
- [ ] NVENC hardware encoder (5x faster render)
- [ ] WebRTC live stream input

### Done ✅
- [x] BatchedInferencePipeline (Whisper 3-4x)
- [x] Audio hash cache
- [x] Parallel Gemini calls · payload เล็กลง 96% (เลิกส่ง `words[]`)
- [x] Pipeline parallelism
- [x] Whisper gap-fill Pass 2
- [x] **Whisper Pass 3** — ตรวจ repetition loop แล้วถอดเสียงใหม่
- [x] AI auto-translate English embedded
- [x] Subtitle editor UI — อิงช่วงที่เลือกจริง
- [x] Sentence boundary improvements
- [x] Subtitle lead time
- [x] Preview mode — เอาช่วงที่ AI ตัดกลับมา / ขยับขอบ / **แยก-รวมช่วง**
- [x] **วิเคราะห์ภาพ** — ฉากเปลี่ยน/จอดำ/ภาพค้าง + ส่งคีย์เฟรมให้ Gemini
- [x] **9:16 เลือกได้** — เห็นครบ (เบลอขอบ) / เต็มจอ (crop)

---

## 🔐 Security

- ✅ Path traversal protection (filename sanitization)
- ✅ File size limit (2GB upload max)
- ✅ Extension whitelist (only video formats)
- ✅ CORS lockdown (localhost only by default)
- ✅ API keys via env (never committed)
- ✅ Storage cleanup (auto-delete jobs > 7 days)

---

## 🤝 Contributing

PRs welcome! สำหรับ feature ใหญ่ ๆ เปิด issue ก่อนเพื่อ discuss

```bash
git checkout -b feature/your-feature
# ทำงาน...
git commit -m "feat: your feature description"
git push origin feature/your-feature
# → open PR
```

---

## 📜 License

[MIT](LICENSE) © 2026

---

## 🙏 Acknowledgements

- [OpenAI Whisper](https://github.com/openai/whisper) — speech recognition
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) — optimized inference
- [Google Gemini](https://ai.google.dev/) — content analysis & translation
- [Silero VAD](https://github.com/snakers4/silero-vad) — voice activity detection
- [PyThaiNLP](https://github.com/PyThaiNLP/pythainlp) — Thai NLP toolkit
- [FFmpeg](https://ffmpeg.org/) — video/audio processing

---

<div align="center">

**Made with ❤️ for content creators**

[Report Bug](https://github.com/Chirayut001/ai-video-editor/issues) · [Request Feature](https://github.com/Chirayut001/ai-video-editor/issues)

</div>
