import torch
from diffusers import StableDiffusionPipeline
import os

model_path = "models/mistoon-anime-v2"
prompt = "youth male, teen boy, black hair, jianlai_3d, portrait"

def test_device(device, name):
    print(f"Testing {name} ({device})...")
    dtype = torch.float32
    pipe = StableDiffusionPipeline.from_pretrained(model_path, torch_dtype=dtype, safety_checker=None).to(device)
    generator = torch.Generator(device).manual_seed(1234)
    image = pipe(prompt, num_inference_steps=20, generator=generator).images[0]
    image.save(f"debug_test_{name}.png")
    print(f"Saved debug_test_{name}.png, size: {os.path.getsize(f'debug_test_{name}.png')} bytes")

if __name__ == "__main__":
    # 1. Test Base Model on MPS (Should work)
    if torch.backends.mps.is_available():
        print("--- Testing Base Model on MPS ---")
        pipe = StableDiffusionPipeline.from_pretrained(model_path, torch_dtype=torch.float32, safety_checker=None).to("mps")
        generator = torch.Generator("mps").manual_seed(1234)
        image = pipe(prompt, num_inference_steps=20, generator=generator).images[0]
        image.save("debug_base_mps.png")
        print(f"Saved debug_base_mps.png, size: {os.path.getsize('debug_base_mps.png')} bytes")
