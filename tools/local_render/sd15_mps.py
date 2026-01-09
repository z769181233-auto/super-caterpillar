#!/usr/bin/env python3
import argparse, json, os, time
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--w", type=int, default=768)
    p.add_argument("--h", type=int, default=768)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    t0 = time.time()

    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

    import torch
    from diffusers import StableDiffusionPipeline
    # from PIL import Image # implied usage in pipe output

    device = "mps" if torch.backends.mps.is_available() else "cpu"

    model_id = "runwayml/stable-diffusion-v1-5"
    pipe = StableDiffusionPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
    )
    pipe = pipe.to(device)
    # Enable attention slicing to save memory on MPS
    pipe.enable_attention_slicing()

    g = torch.Generator(device=device).manual_seed(args.seed)

    # Use 20 steps (enough for verification) and guidance 7.0
    image = pipe(
        prompt=args.prompt,
        width=args.w,
        height=args.h,
        generator=g,
        num_inference_steps=20,
        guidance_scale=7.0,
    ).images[0]

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out.as_posix(), format="PNG")

    t1 = time.time()
    result = {
        "asset_path": out.as_posix(),
        "mime": "image/png",
        "width": args.w,
        "height": args.h,
        "seed": args.seed,
        "model": model_id,
        "gpuSeconds": round(t1 - t0, 3),
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
