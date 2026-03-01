import torch
import os
import argparse
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from PIL import Image

def make_grid(utils_list, rows, cols):
    w, h = utils_list[0].size
    grid = Image.new('RGB', size=(cols*w, rows*h))
    for i, img in enumerate(utils_list):
        grid.paste(img, box=(i%cols*w, i//cols*h))
    return grid

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lora_path", type=str, default=None)
    parser.add_argument("--prompts_file", type=str, required=True)
    parser.add_argument("--output_path", type=str, required=True)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument("--device", type=str, default="mps")
    args = parser.parse_args()

    model_id = "runwayml/stable-diffusion-v1-5"
    pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=torch.float32).to(args.device)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe.safety_checker = None
    pipe.enable_attention_slicing()
    if hasattr(pipe.vae, "enable_slicing"):
        pipe.vae.enable_slicing()
    
    if args.lora_path:
        print(f"Loading LoRA weights from {args.lora_path}...")
        state_dict = torch.load(args.lora_path, map_location=args.device)
        from train_lora_diffusers import CustomLoRAAttnProcessor
        for name, _ in pipe.unet.attn_processors.items():
            attn_obj = pipe.unet.get_submodule(name.replace(".processor", ""))
            hidden_size = attn_obj.to_q.in_features
            cross_attention_dim = attn_obj.to_k.in_features if attn_obj.to_k.in_features != hidden_size else None
            proc = CustomLoRAAttnProcessor(hidden_size, cross_attention_dim, rank=16, alpha=8).to(args.device)
            pipe.unet.get_submodule(name.replace(".processor", "")).processor = proc
        pipe.unet.load_state_dict(state_dict, strict=False)
        print("LoRA weights injected.")

    with open(args.prompts_file, "r") as f:
        prompts = [line.strip() for line in f.readlines() if line.strip() and not line.startswith("#")]

    images = []
    generator = torch.Generator(device=args.device).manual_seed(args.seed)
    
    for i, p in enumerate(prompts[:12]):
        print(f"Generating image {i+1}/12: {p}")
        image = pipe(p, num_inference_steps=25, guidance_scale=7.5, generator=generator).images[0]
        images.append(image)

    grid = make_grid(images, rows=3, cols=4)
    grid.save(args.output_path)
    print(f"Grid saved to {args.output_path}")

if __name__ == "__main__":
    main()
