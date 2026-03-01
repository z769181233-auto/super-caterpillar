import os
import shutil
import glob
import cv2
import numpy as np
import imagehash
from PIL import Image
from tqdm import tqdm
import json

def build_lora_dataset():
    input_dir = "./dataset/anchors_golden/"
    lora_base = "./dataset/chenpingan_lora/train/"
    image_out = os.path.join(lora_base, "images")
    caption_out = os.path.join(lora_base, "captions")
    raw_meta_dir = "./work/faces/raw/"
    output_report_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    
    # Reset/Create directories
    for d in [image_out, caption_out]:
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d, exist_ok=True)
        
    # 1. Collect inputs
    image_files = sorted(glob.glob(os.path.join(input_dir, "*.png")))
    if not image_files:
        print("No images found in anchors_golden/.")
        return

    print(f"\n[LoRA-Builder] Processing {len(image_files)} images...")
    
    processed_count = 0
    hashes = {}
    embeddings = {}
    duplicates = []
    
    report_data = []

    caption_text = "chen pingan, sword fantasy anime male, detailed face, cinematic lighting"

    for idx, fpath in enumerate(tqdm(image_files)):
        # base_name_orig: e.g. 000_E26-Scene-099...
        base_name_orig = os.path.splitext(os.path.basename(fpath))[0]
        # target_name: lora_cp_001
        target_name = f"cp_anchors_{idx:03d}"
        
        # A. Resize to 512x512
        img = cv2.imread(fpath)
        if img is None:
            continue
        
        img_resized = cv2.resize(img, (512, 512), interpolation=cv2.INTER_LANCZOS4)
        
        # B. Save Image
        img_path = os.path.join(image_out, f"{target_name}.png")
        cv2.imwrite(img_path, img_resized)
        
        # C. Save Caption
        cap_path = os.path.join(caption_out, f"{target_name}.txt")
        with open(cap_path, "w") as cap_f:
            cap_f.write(caption_text)
            
        # D. Deduplication Tracking (Final Check)
        h = str(imagehash.phash(Image.open(fpath)))
        if h in hashes:
            duplicates.append((target_name, hashes[h], "PHash Match"))
        else:
            hashes[h] = target_name

        # For embedding similarity, we need to map back to original metadata
        # the filename in anchors_golden is e.g. "000_E26_剑来..." 
        # where E26_... is the original base name.
        # We need to extract the original base name part.
        original_base = base_name_orig[4:] # remove "000_" prefix
        emb_path = os.path.join(raw_meta_dir, f"{original_base}.npy")
        if os.path.exists(emb_path):
            emb = np.load(emb_path)
            norm = np.linalg.norm(emb)
            if norm > 1e-6:
                emb_norm = emb / norm
                # Compare with previous
                for other_name, other_emb in embeddings.items():
                    sim = float(np.dot(emb_norm, other_emb))
                    if sim > 0.95:
                        duplicates.append((target_name, other_name, f"Embedding Similarity: {sim:.4f}"))
                embeddings[target_name] = emb_norm

        processed_count += 1
        report_data.append({
            "name": target_name,
            "orig": original_base,
            "res": "512x512",
            "hash": h
        })

    # 2. Final Analytics
    all_embs = np.array(list(embeddings.values()))
    mean_val = np.mean(all_embs) if len(all_embs) > 0 else 0
    std_val = np.std(all_embs) if len(all_embs) > 0 else 0

    # 3. Output duplicates_final.txt
    with open(os.path.join(output_report_dir, "duplicates_final.txt"), "w") as df:
        df.write("--- Final Deduplication Scrutiny ---\n")
        for d in duplicates:
            df.write(f"Pair: {d[0]} <-> {d[1]} | Reason: {d[2]}\n")

    # 4. Output dataset_ready_report.md
    with open(os.path.join(output_report_dir, "dataset_ready_report.md"), "w") as rr:
        rr.write("# 🚀 LoRA Dataset Ready Report: Chen Pingan\n\n")
        rr.write(f"- **Total Samples**: {processed_count}\n")
        rr.write(f"- **Resolution**: 512 x 512 (Standard Stable Diffusion)\n")
        rr.write(f"- **Caption Style**: `Unified Standard`\n")
        rr.write(f"- **Deduplication Results**: {len(duplicates)} potential duplicates marked.\n\n")
        
        rr.write("## 🧬 Data Integrity (Embedding Stats)\n")
        rr.write(f"- **Mean Value**: {mean_val:.6f}\n")
        rr.write(f"- **Std Deviation**: {std_val:.6f}\n\n")
        
        rr.write("## 📂 Folder Manifest\n")
        rr.write("| Index | Target Name | Resolution | Hash (PHash) |\n")
        rr.write("| :--- | :--- | :--- | :--- |\n")
        for idx, item in enumerate(report_data[:20]): # Show first 20
            rr.write(f"| {idx:02d} | {item['name']} | {item['res']} | {item['hash']} |\n")
        if len(report_data) > 20:
            rr.write(f"| ... | ... | ... | ... |\n")

    print(f"\n[Success] LoRA dataset built at {lora_base}")
    print(f"[Success] Ready report: {output_report_dir}dataset_ready_report.md")

if __name__ == "__main__":
    build_lora_dataset()
