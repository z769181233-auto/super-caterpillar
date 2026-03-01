import os
import shutil
import glob
import cv2
import numpy as np
import imagehash
from PIL import Image
from tqdm import tqdm
import json
import zipfile

def finalize_lora_dataset():
    zip_source = "./anchors_golden.zip"
    tmp_unzip = "./tmp_anchors_unzip/"
    lora_base = "./dataset/chenpingan_lora/train/"
    image_out = os.path.join(lora_base, "images")
    caption_out = os.path.join(lora_base, "captions")
    raw_meta_dir = "./work/faces/raw/"
    output_report_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    
    # 1. Unzip
    if not os.path.exists(zip_source):
        print(f"Error: {zip_source} not found.")
        return
        
    if os.path.exists(tmp_unzip):
        shutil.rmtree(tmp_unzip)
    os.makedirs(tmp_unzip, exist_ok=True)
    
    print(f"\n[LoRA-Finalizer] Unzipping {zip_source}...")
    with zipfile.ZipFile(zip_source, 'r') as zip_ref:
        zip_ref.extractall(tmp_unzip)
        
    # 2. Setup output dirs
    for d in [image_out, caption_out]:
        if os.path.exists(d):
            shutil.rmtree(d)
        os.makedirs(d, exist_ok=True)
        
    # 3. Process
    # We look for png files inside the unzipped folder
    image_files = sorted(glob.glob(os.path.join(tmp_unzip, "**/*.png"), recursive=True))
    if not image_files:
        print("No images found in zip.")
        return

    print(f"[LoRA-Finalizer] Processing {len(image_files)} samples...")
    
    hashes = {}
    embeddings = {}
    duplicates = []
    report_items = []
    
    caption_text = "chen pingan, sword fantasy anime male, detailed face, cinematic lighting"

    for idx, fpath in enumerate(tqdm(image_files)):
        target_name = f"cp_final_{idx:03d}"
        
        # A. Resize to 512x512
        img = cv2.imread(fpath)
        if img is None: continue
        img_resized = cv2.resize(img, (512, 512), interpolation=cv2.INTER_LANCZOS4)
        
        # B. Save Image & Caption
        img_dest = os.path.join(image_out, f"{target_name}.png")
        cap_dest = os.path.join(caption_out, f"{target_name}.txt")
        cv2.imwrite(img_dest, img_resized)
        with open(cap_dest, "w") as cap_f:
            cap_f.write(caption_text)
            
        # C. Deduplication
        h = str(imagehash.phash(Image.open(fpath)))
        if h in hashes:
            duplicates.append((target_name, hashes[h], "PHash Match"))
        else:
            hashes[h] = target_name
            
        # D. Local Embedding Map (Finding original metadata)
        # Assuming the original base name is still recoverable from the filename
        # Our zip contains paths like dataset/anchors_golden/000_E26_...
        fname = os.path.basename(fpath)
        # Try to find original base name for embedding lookup
        # Original format: {idx}_{original_base}.png
        # We need the original_base part to look up in work/faces/raw/
        orig_candidate = fname[4:-4] if fname[0:3].isdigit() else os.path.splitext(fname)[0]
        emb_path = os.path.join(raw_meta_dir, f"{orig_candidate}.npy")
        
        if os.path.exists(emb_path):
            emb = np.load(emb_path)
            norm = np.linalg.norm(emb)
            if norm > 1e-6:
                emb_norm = emb / norm
                for prev_name, prev_emb in embeddings.items():
                    sim = float(np.dot(emb_norm, prev_emb))
                    if sim > 0.95:
                        duplicates.append((target_name, prev_name, f"Embedding Sim: {sim:.4f}"))
                embeddings[target_name] = emb_norm

        report_items.append({
            "idx": idx,
            "name": target_name,
            "hash": h
        })

    # 4. Reports
    with open(os.path.join(output_report_dir, "duplicates_final.txt"), "w") as df:
        df.write("--- Final Deduplication Scrutiny (Phase 10) ---\n")
        for d in duplicates:
            df.write(f"Pair: {d[0]} <-> {d[1]} | Reason: {d[2]}\n")
            
    with open(os.path.join(output_report_dir, "dataset_ready_report.md"), "w") as rr:
        rr.write("# 🚀 LoRA Dataset Ready Report: Chen Pingan (Phase 10 Final)\n\n")
        rr.write(f"- **Source**: `anchors_golden.zip`\n")
        rr.write(f"- **Total Samples**: {len(report_items)}\n")
        rr.write(f"- **Resolution**: 512x512\n")
        rr.write(f"- **Caption**: `{caption_text}`\n")
        rr.write(f"- **Potential Duplicates**: {len(duplicates)}\n\n")
        
        rr.write("## 📂 Folder Manifest (Top 10)\n")
        rr.write("| Index | Name | PHash |\n| :--- | :--- | :--- |\n")
        for it in report_items[:10]:
            rr.write(f"| {it['idx']:02d} | {it['name']} | {it['hash']} |\n")

    # Cleanup tmp
    shutil.rmtree(tmp_unzip)
    print(f"\n[Success] LoRA dataset finalized at {lora_base}")

if __name__ == "__main__":
    finalize_lora_dataset()
