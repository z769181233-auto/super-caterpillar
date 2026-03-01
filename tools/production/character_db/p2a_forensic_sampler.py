import torch
from diffusers import StableDiffusionPipeline, UNet2DConditionModel
import os
import argparse
from PIL import Image
import hashlib
import json
import subprocess

# Mirroring the training script's processor for forensic consistency
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

        hidden_states = attn.to_out[0](hidden_states) + self.to_out_lora_up(self.to_out_lora(hidden_states)) * self.scaling
        hidden_states = attn.to_out[1](hidden_states)
        return hidden_states

def make_grid(imgs, rows, cols):
    w, h = imgs[0].size
    grid = Image.new('RGB', size=(cols*w, rows*h))
    for i, img in enumerate(imgs):
        grid.paste(img, box=(i%cols*w, i//cols*h))
    return grid

def calculate_sha256(filepath):
    if not os.path.exists(filepath): return "NOT_FOUND"
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def get_git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"]).decode("ascii").strip()
    except:
        return "UNKNOWN"

def save_meta(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def inject_lora(unet, lora_path, rank=32, alpha=16):
    state_dict = torch.load(lora_path, map_location="cpu")
    lora_attn_procs = torch.nn.ModuleDict()
    
    for name, attn in unet.attn_processors.items():
        attn_obj = unet.get_submodule(name.replace(".processor", ""))
        hidden_size = attn_obj.to_q.in_features
        cross_attention_dim = attn_obj.to_k.in_features if attn_obj.to_k.in_features != hidden_size else None
        
        proc = CustomLoRAAttnProcessor(hidden_size, cross_attention_dim, rank=rank, alpha=alpha)
        
        # Load weights
        key_prefix = f"unet_{name.replace('.', '_')}"
        proc_state_dict = {}
        for k, v in state_dict.items():
            if k.startswith(key_prefix):
                proc_state_dict[k.replace(key_prefix + ".", "")] = v
        
        if proc_state_dict:
            proc.load_state_dict(proc_state_dict)
        
        # Move to same device/dtype as unet
        proc.to(device=unet.device, dtype=unet.dtype)
        
        lora_attn_procs[name.replace('.', '_')] = proc
        attn_obj.processor = proc
    return unet

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", type=str, required=True)
    parser.add_argument("--lora_path", type=str, required=True)
    parser.add_argument("--output_dir", type=str, required=True)
    parser.add_argument("--step", type=int, required=True)
    parser.add_argument("--rank", type=int, default=32)
    parser.add_argument("--alpha", type=int, default=16)
    parser.add_argument("--device", type=str, default=None)
    args = parser.parse_args()

    if args.device:
        device = args.device
    else:
        device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
    
    # Force float32 for forensic auditing to avoid NaNs
    weight_dtype = torch.float32
    os.makedirs(args.output_dir, exist_ok=True)
    
    scenes = [
        "youth male, teen boy, black hair, jianlai_3d, rainy street umbrella",
        "youth male, teen boy, black hair, jianlai_3d, night scene neon",
        "youth male, teen boy, black hair, jianlai_3d, indoor warm light",
        "youth male, teen boy, black hair, jianlai_3d, backlight silhouette",
        "youth male, teen boy, black hair, jianlai_3d, overcast outdoor",
        "youth male, teen boy, black hair, jianlai_3d, strong sunlight high contrast"
    ]

    base_images = []
    
    # 1. Load Base Pipeline, Generate Base Scenes, then DELETE
    print(f"[Optimization] Loading Base Pipeline (Sequential Phase 1): {args.model_path}")
    pipe_base = StableDiffusionPipeline.from_pretrained(
        args.model_path, 
        torch_dtype=weight_dtype,
        safety_checker=None,
        low_cpu_mem_usage=True
    ).to(device)

    for i, p in enumerate(scenes):
        print(f"Generating BASE Scene {i+1}...")
        generator = torch.Generator(device).manual_seed(1234)
        img_base = pipe_base(p, num_inference_steps=25, generator=generator).images[0]
        base_images.append(img_base)
    
    del pipe_base
    import gc
    gc.collect()
    if "mps" in device: torch.mps.empty_cache()

    # 2. Load LoRA Pipeline (Sequential Phase 2)
    print(f"[Optimization] Loading LoRA Pipeline (Sequential Phase 2)...")
    pipe_lora = StableDiffusionPipeline.from_pretrained(
        args.model_path, 
        torch_dtype=weight_dtype,
        safety_checker=None,
        low_cpu_mem_usage=True
    ).to(device)
    import gc
    gc.collect() # Extra safety
    
    inject_lora(pipe_lora.unet, args.lora_path, rank=args.rank, alpha=args.alpha)

    prompts = [
        "youth male, teen boy, black hair, chinese xianxia少年, solo, jianlai_3d, portrait, sharp focus",
        "youth male, teen boy, serious expression, masterpiece, high quality, face focus, jianlai_3d",
        "youth male, teen boy, side profile, looking away, cinematic, jianlai_3d",
        "youth male, teen boy, wearing green robe, wooden sword on back, holding bamboo stick, jianlai_3d",
        "youth male, teen boy, training with wooden sword, dynamic pose, 3d render look, jianlai_3d",
        "youth male, teen boy, wearing simple daoist robe, standing in xianxia environment, full body, jianlai_3d"
    ]
    seeds = [11, 22, 33, 44, 55, 66, 77, 88]

    # 3. Multi-seed Stability (LoRA)
    stability_dir = os.path.join(args.output_dir, f"stability_multiseed/step_{args.step:04d}")
    os.makedirs(stability_dir, exist_ok=True)
    
    for i, p in enumerate(prompts):
        print(f"Generating Multi-seed Grid for Prompt {i+1}...")
        results = []
        for s in seeds:
            generator = torch.Generator(device).manual_seed(s)
            img = pipe_lora(p, num_inference_steps=25, generator=generator).images[0]
            results.append(img)
        grid = make_grid(results, 2, 4)
        grid.save(os.path.join(stability_dir, f"prompt_{i+1:02d}_multiseed_grid.png"))

    # 4. Generalization Scenes (Comparison)
    gen_dir = os.path.join(args.output_dir, f"generalization_scenes/step_{args.step:04d}")
    os.makedirs(gen_dir, exist_ok=True)

    for i, p in enumerate(scenes):
        print(f"Generating LoRA Scene {i+1} & Comparison...")
        generator = torch.Generator(device).manual_seed(1234)
        img_lora = pipe_lora(p, num_inference_steps=25, generator=generator).images[0]
        
        comp = Image.new('RGB', (1024, 512))
        comp.paste(base_images[i], (0, 0))
        comp.paste(img_lora, (512, 0))
        comp.save(os.path.join(gen_dir, f"scene_{i+1:02d}_comparison.png"))

    # 5. Structure Decoupling Board
    print(f"Generating Structure Decoupling Board...")
    decouple_prompts = [
        "adult female, woman, long hair, jianlai_3d, solo",
        "elderly male, old man, white beard, jianlai_3d, solo",
        "western male, caucasian, blonde hair, jianlai_3d, solo",
        "little girl, child, cute, jianlai_3d, solo"
    ]
    decouple_dir = os.path.join(args.output_dir, "structure_decoupling")
    os.makedirs(decouple_dir, exist_ok=True)
    
    decouple_imgs = []
    for p in decouple_prompts:
        generator = torch.Generator(device).manual_seed(1234)
        img = pipe_lora(p, num_inference_steps=25, generator=generator).images[0]
        decouple_imgs.append(img)
    
    board = make_grid(decouple_imgs, 1, 4)
    board_path = os.path.join(decouple_dir, f"step_{args.step:04d}_board.png")
    board.save(board_path)

    # 6. Meta Data Generation
    manifest_path = "docs/_evidence/retrain_p2a_v2/dataset_inventory/style_gold_manifest.csv"
    meta_base = {
        "base_model_vae_sha256": calculate_sha256(os.path.join(args.model_path, "vae/diffusion_pytorch_model.safetensors")),
        "base_model_text_encoder_sha256": calculate_sha256(os.path.join(args.model_path, "text_encoder/model.safetensors")),
        "base_model_unet_sha256": calculate_sha256(os.path.join(args.model_path, "unet/diffusion_pytorch_model.safetensors")),
        "lora_checkpoint_sha256": calculate_sha256(args.lora_path),
        "dataset_manifest_path": manifest_path,
        "dataset_manifest_sha256": calculate_sha256(manifest_path),
        "sampler": "PNDMScheduler",
        "steps": 25,
        "cfg": 7.5,
        "script_git_commit": get_git_commit()
    }
    
    save_meta(os.path.join(decouple_dir, f"step_{args.step:04d}_board.json"), meta_base)
    print("Audit Sampling & Meta Schema Complete.")

if __name__ == "__main__":
    main()
