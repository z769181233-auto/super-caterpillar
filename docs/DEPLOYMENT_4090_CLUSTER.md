# Deployment Guide: 8x RTX 4090 Cluster

> **Status**: DRAFT
> **Target**: Commercial Production Environment
> **Engine**: Super Caterpillar Fusion Engine (Sora-Style)

## 1. Infrastructure Requirements

- **Hardware**: 8x NVIDIA RTX 4090 (24GB VRAM each).
- **Driver**: NVIDIA Driver 535+, CUDA 12.1+.
- **OS**: Ubuntu 22.04 LTS.

## 2. Docker Deployment

We use a unified Docker container for the Fusion Engine Worker.

### A. Build Image

```bash
cd apps/fusion-engine
docker build -t super-caterpillar/fusion-worker:v1.0 .
```

### B. Run Cluster (Docker Compose)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'
services:
  fusion-worker-0:
    image: super-caterpillar/fusion-worker:v1.0
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: ['0']
    environment:
      - DEVICE_ID=0
      - WORKER_API_KEY=${WORKER_API_KEY}
      - MODEL_path=/data/models/OpenSora-v1-3
      - LORA_path=/data/models/lora/maomaochong_style.adapter
      - REF_NET_path=/data/models/ReferenceNet
    volumes:
      - ./data:/data
    restart: always

  # Replicate for gpu-1 to gpu-7 ...
```

## 3. Model Weights Layout

Ensure the `/data` volume is mounted properly:

```
/data
├── models
│   ├── OpenSora-v1-3/        # Base DiT Weights
│   ├── ReferenceNet/         # Reference Control Modules
│   ├── ControlNet/           # DensePose Weights
│   └── lora/
│       └── maomaochong_style.adapter  # Your Trained LoRA
└── outputs                   # Generated Videos
```

## 4. Legal Compliance Check

Verify the `obfuscation` flag is ENABLED in `apps/workers/.env`:

```bash
ENABLE_OBFUSCATION=true
OBFUSCATION_WATERMARK="Super Caterpillar Engine"
```

## 5. Launch Command

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 6. Health Check

Monitor logs to ensure LoRA injection is successful:

```bash
docker logs -f fusion-worker-0 | grep "LoRA"
# Expect: "✅ Injecting 'MaoMaoChong-Style' LoRA... Success"
```
