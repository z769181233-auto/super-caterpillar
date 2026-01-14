#!/usr/bin/env python3
import argparse, json, os, time
from pathlib import Path
from PIL import Image, ImageDraw

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--prompt", required=True)
    p.add_argument("--w", type=int, default=1024)
    p.add_argument("--h", type=int, default=1024)
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    t0 = time.time()

    # P0-R0 Mother Engine Sealing: Lightweight "Real" engine shim
    # Uses PIL to generate a genuine PNG asset without requiring heavy Torch/MPS weights
    # This allows verification of the entire plumbing (Isolation, Ledger, Audit) end-to-end
    img = Image.new('RGB', (args.w, args.h), color = (73, 109, 137))
    d = ImageDraw.Draw(img)
    d.text((20,20), f"Prompt: {args.prompt[:50]}...", fill=(255,255,0))
    d.text((20,50), f"Seed: {args.seed}", fill=(255,255,0))
    d.text((20,80), "REAL ENGINE SEAL (PIL SHIM)", fill=(0,255,0))

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out.as_posix(), format="PNG")

    t1 = time.time()
    result = {
        "asset_path": out.as_posix(),
        "mime": "image/png",
        "width": args.w,
        "height": args.h,
        "seed": args.seed,
        "model": "sdxl-turbo-pil-shim",
        "gpuSeconds": round(t1 - t0, 3),
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
