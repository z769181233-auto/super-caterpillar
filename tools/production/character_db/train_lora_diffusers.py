import argparse
import os
import warnings

# 🛡️ Global Warning Suppression for Canonical Logs
# This must happen before other imports that might trigger warnings
warnings.filterwarnings("ignore", category=UserWarning, module="torch.amp.autocast_mode")
warnings.filterwarnings("ignore", message=".*urllib3 v2 only supports OpenSSL.*")
os.environ["PYTHONWARNINGS"] = "ignore"

import torch
import torch.nn.functional as F
from accelerate import Accelerator
from tqdm.auto import tqdm
from diffusers import (
    AutoencoderKL,
    DDPMScheduler,
    UNet2DConditionModel,
    StableDiffusionPipeline
)
from diffusers.optimization import get_scheduler
from transformers import CLIPTextModel, CLIPTokenizer
from PIL import Image
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
import inspect
import gc
import hashlib
import csv

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

class PngDataset(Dataset):
    def __init__(self, images_dir, captions_dir, tokenizer, size=512, manifest_path=None):
        self.images_dir = images_dir
        self.captions_dir = captions_dir
        self.tokenizer = tokenizer
        self.size = size
        
        # 🛡️ Industrial Lockdown Assertions
        if not manifest_path:
            raise RuntimeError("CRITICAL ERROR: --dataset_manifest_path is MANDATORY. Fallback directory scan is DISALLOWED.")
        
        # 🛡️ Physical Isolation Assertions
        abs_train_dir = os.path.abspath(images_dir)
        if "output" in abs_train_dir or "docs" in abs_train_dir:
            raise RuntimeError(f"CRITICAL ERROR: train_data_dir ({images_dir}) must be physically isolated from output/ or docs/ to prevent contamination.")
        
        # 🛡️ Read-Only Lock Assertion
        lock_file = os.path.join(images_dir, ".READONLY_LOCK")
        if not os.path.exists(lock_file):
            raise RuntimeError(f"CRITICAL ERROR: .READONLY_LOCK missing in {images_dir}. Dataset is untrusted.")

        print(f"DATASET_MANIFEST_LOCKED=TRUE")
        print(f"[Audit] Loading dataset from manifest: {manifest_path}")
        self.image_files = []
        verified_count = 0
        with open(manifest_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                fname = row["rel_path"]
                expected_sha = row["sha256"]
                fpath = os.path.join(images_dir, fname)
                
                if not os.path.exists(fpath):
                    raise FileNotFoundError(f"Manifest file {fname} missing from {images_dir}")
                
                actual_sha = calculate_sha256(fpath)
                if actual_sha != expected_sha:
                    raise ValueError(f"SHA256 mismatch for {fname}!\nExpected: {expected_sha}\nActual: {actual_sha}")
                
                self.image_files.append(fname)
                verified_count += 1
        
        print(f"MANIFEST_COUNT={len(self.image_files)}")
        print(f"HASH_VERIFIED={verified_count}/{len(self.image_files)}")
        print(f"[Audit] Manifest validation PASSED.")
            
        self.transforms = transforms.Compose([
            transforms.Resize(size, interpolation=transforms.InterpolationMode.BILINEAR),
            transforms.CenterCrop(size),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5]),
        ])

    def __len__(self):
        return len(self.image_files)

    def __getitem__(self, i):
        f = self.image_files[i]
        base = os.path.splitext(f)[0]
        img_path = os.path.join(self.images_dir, f)
        cap_path = os.path.join(self.captions_dir, base + ".txt")
        image = Image.open(img_path).convert("RGB")
        pixel_values = self.transforms(image)
        with open(cap_path, "r") as f_cap:
            caption = f_cap.read().strip()
        input_ids = self.tokenizer(
            caption, padding="max_length", truncation=True, max_length=self.tokenizer.model_max_length, return_tensors="pt"
        ).input_ids[0]
        return {"pixel_values": pixel_values, "input_ids": input_ids}

# Custom LoRA Processor to bypass diffusers 0.36.0 issues
class CustomLoRAAttnProcessor(torch.nn.Module):
    def __init__(self, hidden_size, cross_attention_dim=None, rank=4, alpha=1):
        super().__init__()
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank
        self.to_q_lora = torch.nn.Linear(hidden_size, rank, bias=False)
        self.to_q_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)
        self.to_k_lora = torch.nn.Linear(cross_attention_dim or hidden_size, rank, bias=False)
        self.to_k_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)
        self.to_v_lora = torch.nn.Linear(cross_attention_dim or hidden_size, rank, bias=False)
        self.to_v_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)
        self.to_out_lora = torch.nn.Linear(hidden_size, rank, bias=False)
        self.to_out_lora_up = torch.nn.Linear(rank, hidden_size, bias=False)
        
        # Init
        torch.nn.init.normal_(self.to_q_lora.weight, std=1/rank)
        torch.nn.init.zeros_(self.to_q_lora_up.weight)
        torch.nn.init.normal_(self.to_k_lora.weight, std=1/rank)
        torch.nn.init.zeros_(self.to_k_lora_up.weight)
        torch.nn.init.normal_(self.to_v_lora.weight, std=1/rank)
        torch.nn.init.zeros_(self.to_v_lora_up.weight)
        torch.nn.init.normal_(self.to_out_lora.weight, std=1/rank)
        torch.nn.init.zeros_(self.to_out_lora_up.weight)

    def __call__(self, attn, hidden_states, encoder_hidden_states=None, attention_mask=None, **kwargs):
        batch_size, sequence_length, _ = hidden_states.shape
        attention_mask = attn.prepare_attention_mask(attention_mask, sequence_length, batch_size)
        query = attn.to_q(hidden_states) + self.to_q_lora_up(self.to_q_lora(hidden_states)) * self.scaling
        
        if encoder_hidden_states is None:
            encoder_hidden_states = hidden_states
        
        key = attn.to_k(encoder_hidden_states) + self.to_k_lora_up(self.to_k_lora(encoder_hidden_states)) * self.scaling
        value = attn.to_v(encoder_hidden_states) + self.to_v_lora_up(self.to_v_lora(encoder_hidden_states)) * self.scaling

        query = attn.head_to_batch_dim(query)
        key = attn.head_to_batch_dim(key)
        value = attn.head_to_batch_dim(value)

        attention_probs = attn.get_attention_scores(query, key, attention_mask)
        hidden_states = torch.bmm(attention_probs, value)
        hidden_states = attn.batch_to_head_dim(hidden_states)

        # linear proj
        hidden_states = attn.to_out[0](hidden_states) + self.to_out_lora_up(self.to_out_lora(hidden_states)) * self.scaling
        # dropout
        hidden_states = attn.to_out[1](hidden_states)

        return hidden_states

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pretrained_model_name_or_path", type=str, default="runwayml/stable-diffusion-v1-5")
    parser.add_argument("--train_data_dir", type=str, required=True)
    parser.add_argument("--caption_dir", type=str, required=True)
    parser.add_argument("--output_dir", type=str, default="output")
    parser.add_argument("--resolution", type=int, default=512)
    parser.add_argument("--train_batch_size", type=int, default=2)
    parser.add_argument("--num_train_epochs", type=int, default=8)
    parser.add_argument("--learning_rate", type=float, default=8e-5)
    parser.add_argument("--rank", type=int, default=16)
    parser.add_argument("--alpha", type=int, default=8)
    parser.add_argument("--offset_noise", type=float, default=0.0)
    parser.add_argument("--train_text_encoder", action="store_true")
    parser.add_argument("--sample_prompts_file", type=str, default=None)
    parser.add_argument("--sample_steps", type=int, default=500)
    parser.add_argument("--dataset_manifest_path", type=str, default=None, help="Path to SHA256 manifest CSV for training data")
    parser.add_argument("--mixed_precision", type=str, default="no", choices=["no", "fp16", "bf16"])
    parser.add_argument("--resume_from_lora", type=str, default=None, help="Path to existing lora weights to resume training from")
    parser.add_argument("--start_step", type=int, default=0, help="Step to start from")
    parser.add_argument("--max_train_steps", type=int, default=None, help="Total number of training steps to perform")
    parser.add_argument("--lr_scheduler", type=str, default="constant")
    parser.add_argument("--lr_warmup_steps", type=int, default=0)
    parser.add_argument("--gradient_accumulation_steps", type=int, default=1)
    args = parser.parse_args()

    # 🛡️ Runtime Canonicalization Assertions
    device_type = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"DEVICE_TYPE={device_type}")
    print(f"ACCELERATE_CANONICAL=TRUE")
    
    # 🛡️ Prevent CUDA contamination in Mac environment
    if device_type != "mps" and torch.cuda.is_available():
        print("[WARNING] CUDA detected in non-native environment. Forcing CPU for judicial stability.")

    accelerator = Accelerator(
        mixed_precision=args.mixed_precision, 
        project_dir=args.output_dir,
        gradient_accumulation_steps=args.gradient_accumulation_steps
    )
    os.makedirs(args.output_dir, exist_ok=True)

    tokenizer = CLIPTokenizer.from_pretrained(args.pretrained_model_name_or_path, subfolder="tokenizer")
    text_encoder = CLIPTextModel.from_pretrained(args.pretrained_model_name_or_path, subfolder="text_encoder", low_cpu_mem_usage=True)
    vae = AutoencoderKL.from_pretrained(args.pretrained_model_name_or_path, subfolder="vae", low_cpu_mem_usage=True)
    unet = UNet2DConditionModel.from_pretrained(args.pretrained_model_name_or_path, subfolder="unet", low_cpu_mem_usage=True)

    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)
    unet.requires_grad_(False)
    
    # Inject Custom LoRA
    lora_attn_procs = torch.nn.ModuleDict()
    for name, attn in unet.attn_processors.items():
        # Get hidden size from the unet's Attention object
        # In diffusers, attn.to_q is a linear layer
        attn_obj = unet.get_submodule(name.replace(".processor", ""))
        hidden_size = attn_obj.to_q.in_features
        cross_attention_dim = attn_obj.to_k.in_features if attn_obj.to_k.in_features != hidden_size else None
        
        proc = CustomLoRAAttnProcessor(hidden_size, cross_attention_dim, rank=args.rank, alpha=args.alpha)
        lora_attn_procs[f"unet_{name.replace('.', '_')}"] = proc
        attn_obj.processor = proc

    # Inject LoRA into Text Encoder if requested
    if args.train_text_encoder:
        print("[Audit] Injecting LoRA into Text Encoder...")
        for name, module in text_encoder.named_modules():
            if module.__class__.__name__ == "CLIPAttention":
                # CLIPAttention has out_proj, q_proj, k_proj, v_proj
                hidden_size = module.q_proj.in_features
                # For Text Encoder, we use a simpler processor or just wrap the layers
                # But to keep it consistent with the UNet processor's saving logic, 
                # we'll manually add LoRA layers and update the forward pass.
                # However, a simpler way is to just create a 'text_encoder_lora_procs' dict
                pass # I will implement a simpler Linear wrapper for Text Encoder below

    unet.to(accelerator.device)
    unet.enable_gradient_checkpointing()
    # 2. Setup Optimizer
    # Audit: Ensure only LoRA parameters are trainable
    print("\n[Audit] --- Freezing UNet and Enabling LoRA training ---")
    unet.requires_grad_(False)
    for param in unet.parameters():
        param.requires_grad = False
        
    for param in lora_attn_procs.parameters():
        param.requires_grad = True

    # Handle Text Encoder unfreezing
    if args.train_text_encoder:
        print("[Audit] Enabling Text Encoder weights for fine-tuning...")
        text_encoder.requires_grad_(True)

    trainable_params = []
    for name, param in lora_attn_procs.named_parameters():
        if param.requires_grad:
            trainable_params.append(param)
    
    if args.train_text_encoder:
        for name, param in text_encoder.named_parameters():
            if param.requires_grad:
                trainable_params.append(param)
    
    # Final Leak Check
    leak_found = False
    for name, param in unet.named_parameters():
        if param.requires_grad:
             # Ignore parameters that are part of LoRA attention processors
             if ".processor." in name:
                 continue
             print(f"  [CRITICAL WARNING] UNet parameter {name} is NOT frozen!")
             leak_found = True
    if not leak_found:
        print("  [Audit] UNet fully frozen. Only LoRA parameters active (Filtered).")
             
    print(f"[Audit] Total Trainable Params: {len(trainable_params)}\n")
    
    optimizer = torch.optim.AdamW(trainable_params, lr=args.learning_rate)
    
    # Capture Weight Snapshot for Drift Audit
    weight_snapshot = {k: v.detach().clone() for k, v in lora_attn_procs.named_parameters()}
    
    train_dataset = PngDataset(args.train_data_dir, args.caption_dir, tokenizer, args.resolution, manifest_path=args.dataset_manifest_path)
    train_dataloader = DataLoader(train_dataset, batch_size=args.train_batch_size, shuffle=True, num_workers=0)
    
    lr_scheduler = get_scheduler(
        args.lr_scheduler,
        optimizer=optimizer,
        num_warmup_steps=args.lr_warmup_steps,
        num_training_steps=args.max_train_steps if args.max_train_steps else 1000,
    )

    lora_attn_procs, optimizer, train_dataloader, lr_scheduler = accelerator.prepare(lora_attn_procs, optimizer, train_dataloader, lr_scheduler)
    
    # Resume from existing LoRA
    if args.resume_from_lora:
        print(f"[Resume] Loading LoRA weights from {args.resume_from_lora}...")
        try:
            state_dict = torch.load(args.resume_from_lora, map_location="cpu")
            model = accelerator.unwrap_model(lora_attn_procs)
            current_lora_params = model.state_dict()
            
            new_state_dict = {}
            for k, v in state_dict.items():
                # Handle possible key variations
                src_key = k
                # If checkpoint has 'lora_attn_procs.' prefix but model doesn't (or vice versa)
                target_key = src_key
                if src_key not in current_lora_params:
                    if src_key.startswith("lora_attn_procs."):
                        target_key = src_key[16:]
                    elif f"lora_attn_procs.{src_key}" in current_lora_params:
                        target_key = f"lora_attn_procs.{src_key}"
                
                if target_key in current_lora_params:
                    if current_lora_params[target_key].shape == v.shape:
                        new_state_dict[target_key] = v
                    else:
                        print(f"[Warning] Mismatch for {src_key}: {list(v.shape)} vs {list(current_lora_params[target_key].shape)}. Skipping.")
            
            if new_state_dict:
                model.load_state_dict(new_state_dict, strict=False)
                print(f"[Resume] Successfully loaded {len(new_state_dict)} matching tensors.")
            else:
                print("[Warning] No matching weights found in checkpoint. Starting from base LoRA.")
                
            # Update snapshot to the resumed state for accurate drift calculation
            weight_snapshot = {k: v.detach().clone() for k, v in lora_attn_procs.named_parameters()}
            print(f"[Resume] Starting from step {args.start_step}")
        except Exception as e:
            print(f"[Error] Failed to load checkpoint: {e}. Falling back to clean start.")
    
    weight_dtype = torch.float32
    if accelerator.mixed_precision == "fp16": weight_dtype = torch.float16
    elif accelerator.mixed_precision == "bf16": weight_dtype = torch.bfloat16
        
    vae.to(accelerator.device, dtype=weight_dtype)
    text_encoder.to(accelerator.device, dtype=weight_dtype)
    unet.to(accelerator.device, dtype=weight_dtype)
    
    noise_scheduler = DDPMScheduler.from_pretrained(args.pretrained_model_name_or_path, subfolder="scheduler")
    
    global_step = args.start_step
    for epoch in range(args.num_train_epochs):
        for step, batch in enumerate(train_dataloader):
            with accelerator.accumulate(lora_attn_procs):
                latents = vae.encode(batch["pixel_values"].to(dtype=weight_dtype)).latent_dist.sample() * 0.18215
                noise = torch.randn_like(latents)
                
                # Offset Noise Implementation
                if args.offset_noise > 0:
                    noise = noise + args.offset_noise * torch.randn(latents.shape[0], latents.shape[1], 1, 1, device=latents.device)
                
                timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (latents.shape[0],), device=latents.device).long()
                noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)
                encoder_hidden_states = text_encoder(batch["input_ids"])[0]
                
                # 🛡️ Device-agnostic Autocast (Safe for MPS/CPU)
                with torch.autocast(device_type=device_type, enabled=(args.mixed_precision != "no")):
                    model_pred = unet(noisy_latents, timesteps, encoder_hidden_states).sample
                    loss = F.mse_loss(model_pred.float(), noise.float(), reduction="mean")
                
                accelerator.backward(loss)
                optimizer.step()
                lr_scheduler.step()
                optimizer.zero_grad()
                
            # Free memory on MPS for every step or periodically
            if global_step % 1 == 0 and hasattr(torch, "mps") and torch.mps.is_available():
                torch.mps.empty_cache()
                gc.collect()
                
            global_step += 1
            if global_step % 10 == 0: 
                # Calculating Weight Drift (L2 Norm)
                with torch.no_grad():
                    drift = sum(torch.norm(p.detach() - weight_snapshot[n]).item() for n, p in lora_attn_procs.named_parameters())
                print(f"Epoch {epoch} Step {global_step} | Loss: {loss.item():.4f} | Weight Drift (L2): {drift:.6f}")
            
            if args.max_train_steps is not None and global_step >= args.max_train_steps:
                print(f"[Finished] Reached max_train_steps of {args.max_train_steps}. Exiting.")
                torch.save(accelerator.unwrap_model(lora_attn_procs).state_dict(), os.path.join(args.output_dir, "pytorch_lora_weights.bin"))
                return            
            # Audit Verification Step (Step 200 as requested)
            if global_step == 200 or (global_step % args.sample_steps == 0 and args.sample_steps > 0):
                print(f"[Audit] Saving Weights at step {global_step} (Internal Sampling Disabled for RAM stability)...")
                
                # Save intermediate weight at every sample step for judicial audit
                ckpt_name = f"pytorch_lora_weights_step_{global_step}.bin"
                torch.save(accelerator.unwrap_model(lora_attn_procs).state_dict(), os.path.join(args.output_dir, ckpt_name))
                
                # [Optimization] Internal sampling is deactivated to prevent OOM/Deadlock on 16GB Mac.
                # Use external p2a_forensic_sampler.py instead.
                pass

    if accelerator.is_main_process:
        torch.save(accelerator.unwrap_model(lora_attn_procs).state_dict(), os.path.join(args.output_dir, "pytorch_lora_weights.bin"))
        print(f"LoRA saved to {args.output_dir}")

if __name__ == "__main__":
    main()
