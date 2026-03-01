#!/bin/bash
# train_lora_style_v2.sh
# Production P2-A (V2): Style Locking (Toon-Prior Arch)
# Use Mistoon_Anime as base model

set -e

source .venv/bin/activate

MODEL_PATH="models/mistoon-anime-v2"
OUTPUT_DIR="output/lora_style_jianlai3d_v2_mistoon"

# Strategy V2.1: 
# - Resolution 512, Batch 1 x Acc 2 (Effective 2)
# - UNet LR: 8e-5, Scheduler: cosine_with_restarts
# - Frozen Text Encoder (to avoid base drift)

nohup accelerate launch tools/production/character_db/train_lora_diffusers.py \
  --pretrained_model_name_or_path="$MODEL_PATH" \
  --train_data_dir="dataset/jianlai_style/images" \
  --caption_dir="dataset/jianlai_style/captions" \
  --output_dir="$OUTPUT_DIR" \
  --resolution=512 \
  --train_batch_size=1 \
  --gradient_accumulation_steps=2 \
  --num_train_epochs=10 \
  --learning_rate=8e-5 \
  --lr_scheduler="cosine_with_restarts" \
  --lr_warmup_steps=200 \
  --rank=32 \
  --alpha=16 \
  --offset_noise=0.1 \
  --max_train_steps=1500 \
  --sample_prompts_file="dataset/chenpingan_lora/sample_prompts_v7_locked.txt" \
  --sample_steps=250 \
  > output/train_style_v2.log 2>&1 &

echo "P2-A Style LoRA Training V2 STARTED (Mistoon-Prior, Res: 512). Output: output/train_style_v2.log"
