# GPU-enabled image (CUDA 12.4 + cuDNN 9 + Python 3.11)
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3-pip \
    ffmpeg \
    fonts-noto-cjk fonts-thai-tlwg \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# torch + torchaudio (CUDA 12.4 build) — ตรงกับ base image
# --retries + --timeout เผื่อเน็ตช้า/ปะทุ
RUN pip install --no-cache-dir --retries 10 --timeout 600 \
    torch==2.4.1 \
    torchaudio==2.4.1 \
    --index-url https://download.pytorch.org/whl/cu124

RUN pip install --no-cache-dir --retries 10 --timeout 300 -r requirements.txt

# Pre-download Silero VAD model ตอน build (มีเน็ตแน่นอนตอน build)
# กัน crash ตอน runtime ถ้า container เข้าเน็ตไม่ได้ (DNS/network issue)
ENV TORCH_HOME=/tmp/torch_hub
RUN python3 -c "import torch; torch.hub.load(repo_or_dir='snakers4/silero-vad', model='silero_vad', trust_repo=True, force_reload=False)"

COPY . .

RUN mkdir -p storage

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
