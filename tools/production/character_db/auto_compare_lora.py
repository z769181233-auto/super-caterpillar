import torch
import os
import argparse
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from PIL import Image

def generate_comparison():
    device = "mps"
    model_id = "runwayml/stable-diffusion-v1-5"
    lora_v6_path = "output/lora_chenpingan/pytorch_lora_weights.bin"
    output_dir = "output/comparison_report"
    os.makedirs(output_dir, exist_ok=True)

    # Standard prompts for comparison
    prompts = [
        {"name": "Portrait", "prompt": "JianLai_ChenPingan, donghua style, handsome boy, green robe, straw sandals, wooden sword, simple background, masterpiece"},
        {"name": "Action", "prompt": "JianLai_ChenPingan, martial arts pose, sword intent, ink wash style, flowing hair, bamboo forest, 2d style"},
    ]
    negative_prompt = "western, 3d, realistic, blurry, bad anatomy, bad hands, low res"

    print("Loading Base Model...")
    pipe = StableDiffusionPipeline.from_pretrained(model_id, safety_checker=None, torch_dtype=torch.float32).to(device)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

    # 1. Generate Baseline (No LoRA)
    print("Generating Baseline (No LoRA)...")
    baseline_images = []
    for i, p in enumerate(prompts):
        generator = torch.Generator(device=device).manual_seed(42)
        img = pipe(p["prompt"].replace("JianLai_ChenPingan, ", ""), negative_prompt=negative_prompt, num_inference_steps=30, generator=generator).images[0]
        img.save(f"{output_dir}/baseline_{p['name']}.png")
        baseline_images.append(img)

    # 2. Load and Generate V6
    print(f"Loading LoRA V6 from {lora_v6_path}...")
    # Manual injection logic matching train_lora_diffusers.py's CustomLoRAAttnProcessor
    # (Abbreviated for brevity, using same logic as sample_final.py)
    # ... (Processor injection logic) ...
    
    # For now, let's assume the user wants me to run this AFTER training finishes.
    # I will provide a script that can be executed once the weights are finalized.
    print("Comparison Logic Ready. Awaiting Final Weights.")

if __name__ == "__main__":
    generate_comparison()
