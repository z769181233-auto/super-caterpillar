import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
import os
import json
from PIL import Image

def main():
    device = "mps"
    model_id = "runwayml/stable-diffusion-v1-5"
    lora_path = "output/lora_chenpingan/pytorch_lora_weights.bin"
    output_dir = "docs/_evidence/jianlai_lora_fix/P0_base_vs_lora/"
    os.makedirs(output_dir, exist_ok=True)

    prompt = "cp_chenpingan, jianlai_3d, youth male, black hair, looking at viewer, solo, portrait, sharp focus"
    negative_prompt = "beard, mustache, makeup, lipstick, heavy eyeshadow, old, middle-aged, realistic skin pores, photorealistic"
    seed = 1234
    steps = 25
    cfg = 7.5

    # 1. Generate Base Image
    print("Generating Base Image...")
    pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float32).to(device)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe.safety_checker = None
    
    generator = torch.Generator(device=device).manual_seed(seed)
    base_image = pipe(prompt, negative_prompt=negative_prompt, num_inference_steps=steps, guidance_scale=cfg, generator=generator).images[0]
    base_image.save(os.path.join(output_dir, "base.png"))

    # 2. Generate LoRA Images
    if os.path.exists(lora_path):
        print(f"Loading LoRA from {lora_path}...")
        # We need to use the exact same loading logic as eval_lora.py (manual injection)
        # Because we used custom processors in training
        from train_lora_diffusers import CustomLoRAAttnProcessor
        
        state_dict = torch.load(lora_path, map_location=device)
        
        def apply_lora(pipe, alpha_weight=1.0):
            for name, _ in pipe.unet.attn_processors.items():
                attn_obj = pipe.unet.get_submodule(name.replace(".processor", ""))
                hidden_size = attn_obj.to_q.in_features
                cross_attention_dim = attn_obj.to_k.in_features if attn_obj.to_k.in_features != hidden_size else None
                # Rank 16 from V7 config
                proc = CustomLoRAAttnProcessor(hidden_size, cross_attention_dim, rank=16, alpha=8 * alpha_weight).to(device)
                pipe.unet.get_submodule(name.replace(".processor", "")).processor = proc
            pipe.unet.load_state_dict(state_dict, strict=False)

        # 0.8 weight
        print("Generating LoRA 0.8 Image...")
        apply_lora(pipe, alpha_weight=0.8)
        generator = torch.Generator(device=device).manual_seed(seed)
        lora_0p8 = pipe(prompt, negative_prompt=negative_prompt, num_inference_steps=steps, guidance_scale=cfg, generator=generator).images[0]
        lora_0p8.save(os.path.join(output_dir, "lora_0p8.png"))

        # 1.0 weight
        print("Generating LoRA 1.0 Image...")
        apply_lora(pipe, alpha_weight=1.0)
        generator = torch.Generator(device=device).manual_seed(seed)
        lora_1p0 = pipe(prompt, negative_prompt=negative_prompt, num_inference_steps=steps, guidance_scale=cfg, generator=generator).images[0]
        lora_1p0.save(os.path.join(output_dir, "lora_1p0.png"))
    else:
        print(f"LoRA path {lora_path} not found. Skipping LoRA steps.")

    # 3. Save Meta.json
    meta = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "model_id": model_id,
        "lora_path": lora_path if os.path.exists(lora_path) else "None"
    }
    with open(os.path.join(output_dir, "meta.json"), "w") as f:
        json.dump(meta, f, indent=4)
    
    print(f"P0 Judicial Audit Complete. Evidence saved in {output_dir}")

if __name__ == "__main__":
    main()
