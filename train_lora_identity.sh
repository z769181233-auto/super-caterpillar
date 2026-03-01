#!/bin/bash
# Production P2-B: Identity Refinement (Cleaned 245 images, UNet LR: 8e-5, Rank 16, Alpha 8)
# Trigger: "cp_chenpingan" (Refined dataset - No beard/realism pollution)

source .venv/bin/activate
export PYTHONUNBUFFERED=1

# Local Snapshot Path for v1.5
MODEL_PATH="/Users/adam/.cache/huggingface/hub/models--runwayml--stable-diffusion-v1-5/snapshots/451f4fe16113bff5a5d2269ed5ad43b0592e9a14"

nohup accelerate launch tools/production/character_db/train_lora_diffusers.py \
  --pretrained_model_name_or_path="$MODEL_PATH" \
  --train_data_dir="dataset/chenpingan_v7_steel/images" \
  --caption_dir="dataset/chenpingan_v7_steel/captions" \
  --output_dir="output/lora_identity_cp" \
  --resolution=448 \
  --train_batch_size=1 \
  --num_train_epochs=2000 \
  --learning_rate=8e-5 \
  --rank=16 \
  --alpha=8 \
  --offset_noise=0.05 \
  --max_train_steps=4000 \
  --sample_prompts_file="dataset/chenpingan_lora/sample_prompts_v7_locked.txt" \
  --sample_steps=500 \
  > output/train_identity_v1.log 2>&1 &

echo "P2-B Identity LoRA Training STARTED (Clean Dataset: 245imgs, LR: 8e-5). Output: output/train_identity_v1.log"
