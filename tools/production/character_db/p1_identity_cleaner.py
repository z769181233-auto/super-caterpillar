import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import os
import shutil
from tqdm import tqdm

def clean_identity_dataset(image_dir, output_bad_dir, threshold=0.25):
    device = "cpu" # CLIP is fast enough on CPU for small datasets
    model_id = "openai/clip-vit-base-patch32"
    model = CLIPModel.from_pretrained(model_id).to(device)
    processor = CLIPProcessor.from_pretrained(model_id)

    os.makedirs(output_bad_dir, exist_ok=True)
    images = [f for f in os.listdir(image_dir) if f.endswith(".png")]
    
    # Negative prompts to identify drift
    neg_prompts = [
        "a man with a beard",
        "facial hair",
        "realistic human face",
        "hyperrealistic skin texture",
        "3d realistic character with beard"
    ]
    
    inputs = processor(text=neg_prompts, return_tensors="pt", padding=True).to(device)
    text_embeds = model.get_text_features(**inputs)
    text_embeds = text_embeds / text_embeds.norm(dim=-1, keepdim=True)

    bad_count = 0
    print(f"Auditing {len(images)} images for identity drift...")

    for img_name in tqdm(images):
        img_path = os.path.join(image_dir, img_name)
        image = Image.open(img_path).convert("RGB")
        
        img_input = processor(images=image, return_tensors="pt").to(device)
        img_embed = model.get_image_features(**img_input)
        img_embed = img_embed / img_embed.norm(dim=-1, keepdim=True)

        # Calculate max similarity to any negative prompt
        similarities = (img_embed @ text_embeds.T).squeeze(0)
        max_sim = similarities.max().item()

        if max_sim > threshold:
            print(f"[DRIFT DETECTED] {img_name} (score: {max_sim:.4f})")
            shutil.move(img_path, os.path.join(output_bad_dir, img_name))
            # Also move the caption if it exists
            cap_path = img_path.replace(".png", ".txt").replace("/images/", "/captions/")
            if os.path.exists(cap_path):
                shutil.move(cap_path, os.path.join(output_bad_dir, os.path.basename(cap_path)))
            bad_count += 1

    print(f"Cleaning complete. {bad_count} items moved to {output_bad_dir}")

if __name__ == "__main__":
    clean_identity_dataset(
        image_dir="dataset/chenpingan_v7_steel/images",
        output_bad_dir="dataset/chenpingan_v7_steel/quarantine_drift",
        threshold=0.28 # Adjusted based on typical CLIP ranges
    )
