#!/bin/bash
# Train LoRA for# V5 Intense Training (Rank 32, 4000 Steps, Fresh Start)

# Create output dirs
mkdir -p output/lora_chenpingan
mkdir -p output/logs
mkdir -p output/samples

# Note: This is now optimized for Mac MPS production training
export PYTORCH_ENABLE_MPS_FALLBACK=1
export PYTHONUNBUFFERED=1

source .venv/bin/activate

# Production V7.1: Steel Identity (Expanded 267 images, UNet 8e-5, Rank 16, Alpha 8)
# Trigger: "cp_chenpingan" (Incorporating Half/Full Body expansion)
nohup accelerate launch tools/production/character_db/train_lora_diffusers.py \
  --pretrained_model_name_or_path="runwayml/stable-diffusion-v1-5" \
  --train_data_dir="dataset/chenpingan_v7_steel/images" \
  --caption_dir="dataset/chenpingan_v7_steel/captions" \
  --output_dir="output/lora_chenpingan" \
  --resolution=448 \
  --train_batch_size=1 \
  --num_train_epochs=2000 \
  --learning_rate=8e-5 \
  --rank=16 \
  --alpha=8 \
  --offset_noise=0.05 \
  --sample_prompts_file="dataset/chenpingan_lora/sample_prompts_v7_locked.txt" \
  --sample_steps=200 \
  --max_train_steps=4000 \
  > output/production_train_v7.log 2>&1 &

echo "V7.1 Steel Identity STARTED (Dataset: 267 imgs, UNet LR: 8e-5). Output: output/production_train_v7.log"
