#!/bin/bash
set -e

source .venv/bin/activate

# Local Snapshot Path for v1.5 to bypass network timeouts
MODEL_PATH="/Users/adam/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5/snapshots/451f4fe16113bff5a5d2269ed5ad43b0592e9a14"

# Production P2-A: Style Locking (890 frames, UNet LR: 1e-4, Rank 32, Alpha 16)
# Trigger: "jianlai_3d" (Focused on texture and lighting)
nohup accelerate launch tools/production/character_db/train_lora_diffusers.py \
  --pretrained_model_name_or_path="$MODEL_PATH" \
  --train_data_dir="dataset/jianlai_style/images" \
  --caption_dir="dataset/jianlai_style/captions" \
  --output_dir="output/lora_style_jianlai3d" \
  --resolution=448 \
  --train_batch_size=1 \
  --num_train_epochs=5 \
  --learning_rate=1e-4 \
  --rank=32 \
  --alpha=16 \
  --offset_noise=0.05 \
  --max_train_steps=3000 \
  --sample_prompts_file="dataset/chenpingan_lora/sample_prompts_v7_locked.txt" \
  --sample_steps=500 \
  > output/train_style_v1.log 2>&1 &

echo "P2-A Style LoRA Training STARTED (Local Mode, Res: 448). Output: output/train_style_v1.log"
