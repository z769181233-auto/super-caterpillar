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
import unicodedata

def normalize_path(p):
    return unicodedata.normalize('NFC', p)

def resize_with_padding(img, size=(512, 512)):
    h, w = img.shape[:2]
    sh, sw = size
    aspect = w / h
    if aspect > 1:
        new_w = sw
        new_h = int(sw / aspect)
    else:
        new_h = sh
        new_w = int(sh * aspect)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    top = (sh - new_h) // 2
    bottom = sh - new_h - top
    left = (sw - new_w) // 2
    right = sw - new_w - left
    padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=[0, 0, 0])
    return padded

def refine_lora_dataset():
    zip_source = "./anchors_golden.zip"
    tmp_unzip = "./tmp_refine_unzip/"
    lora_base = "./dataset/chenpingan_lora/train/"
    image_out = os.path.join(lora_base, "images")
    caption_out = os.path.join(lora_base, "captions")
    raw_meta_dir = "./work/faces/raw/"
    output_report_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    
    # Pre-build raw directory map for fast and robust lookup
    print(f"[LoRA-Refiner] Indexing raw metadata in {raw_meta_dir}...")
    raw_map = {}
    for f in os.listdir(raw_meta_dir):
        if f.endswith(".npy") or f.endswith(".json"):
            n_name = normalize_path(f)
            raw_map[n_name] = f

    if os.path.exists(tmp_unzip): shutil.rmtree(tmp_unzip)
    os.makedirs(tmp_unzip, exist_ok=True)
    
    print(f"[LoRA-Refiner] Unzipping {zip_source} (with encoding fix)...")
    with zipfile.ZipFile(zip_source, 'r') as zip_ref:
        for member in zip_ref.infolist():
            try:
                # Fix for mangled names on Mac/Linux if zip was created with default shell zip
                orig_filename = member.filename
                # Typically zip stores names in cp437 if not explicitly utf-8
                member.filename = orig_filename.encode('cp437').decode('utf-8')
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            zip_ref.extract(member, tmp_unzip)
        
    for d in [image_out, caption_out]:
        if os.path.exists(d): shutil.rmtree(d)
        os.makedirs(d, exist_ok=True)
        
    image_files = sorted(glob.glob(os.path.join(tmp_unzip, "**/*.png"), recursive=True))
    data_list = []
    
    print(f"[LoRA-Refiner] Analyzing {len(image_files)} samples...")
    for idx_f, f in enumerate(tqdm(image_files)):
        fname = os.path.basename(f)
        if "_" in fname and fname[:3].isdigit():
            base = fname.split("_", 1)[1].rsplit(".", 1)[0]
        else:
            base = os.path.splitext(fname)[0]
            
        n_base = normalize_path(base)
        
        if idx_f == 0:
            print(f"Debug [0]: base='{base}' | n_base='{n_base}'")
            # Print a few raw map keys for comparison
            keys = list(raw_map.keys())
            print(f"Debug Raw Map Keys (first 3): {keys[:3]}")
        
        emb = None
        blur = 0
        
        # Check npy
        npy_key = n_base + ".npy"
        if npy_key in raw_map:
            emb_path = os.path.join(raw_meta_dir, raw_map[npy_key])
            emb = np.load(emb_path)
            norm = np.linalg.norm(emb)
            if norm > 1e-6: emb = emb / norm
        
        # Check json
        json_key = n_base + ".json"
        if json_key in raw_map:
            json_path = os.path.join(raw_meta_dir, raw_map[json_key])
            with open(json_path, 'r') as jf:
                meta = json.load(jf)
                blur = meta.get("blur_score", 0)

        data_list.append({
            "tmp_path": f,
            "orig_base": base,
            "emb": emb,
            "blur": blur,
            "phash": str(imagehash.phash(Image.open(f)))
        })

    # Similarity and Pruning
    sim_pairs = []
    print(f"[LoRA-Refiner] Calculating similarity matrix for {len(data_list)} samples...")
    for i in range(len(data_list)):
        for j in range(i + 1, len(data_list)):
            if data_list[i]["emb"] is not None and data_list[j]["emb"] is not None:
                sim = float(np.dot(data_list[i]["emb"], data_list[j]["emb"]))
                sim_pairs.append((i, j, sim))
    
    sim_pairs.sort(key=lambda x: x[2], reverse=True)
    if sim_pairs:
        print(f"--- Top 10 Sim Scores: {[round(x[2], 4) for x in sim_pairs[:10]]}")
    else:
        # Check if any embs were loaded at all
        embs_loaded = sum(1 for d in data_list if d["emb"] is not None)
        print(f"--- Warning: Only {embs_loaded}/{len(data_list)} embeddings loaded.")
    
    to_delete = set()
    pruned_info = []
    prune_count = 0
    for i, j, sim in sim_pairs:
        if prune_count >= 4: break
        if i in to_delete or j in to_delete: continue
        
        idx_to_del = i if data_list[i]["blur"] < data_list[j]["blur"] else j
        to_delete.add(idx_to_del)
        keep_idx = j if idx_to_del == i else i
        pruned_info.append(f"Sim: {sim:.4f} | Del: {data_list[idx_to_del]['orig_base']} | Keep: {data_list[keep_idx]['orig_base']}")
        prune_count += 1

    print(f"--- Pruned {len(to_delete)} samples.")

    # Save
    # Save with more descriptive captions and UNIQUE TRIGGER
    # Hero Fix Strategy: Locked-in character trigger + intense style reinforcement
    trigger = "JianLai_ChenPingan"
    style_reinforcement = "cel-shaded, donghua style, ink wash colors, bold outlines, masterpiece, best quality, xianxia"
    
    # Specific attributes for variety
    attributes = [
        "wearing traditional green hanfu, simple daoist robe, straw sandals",
        "holding a wooden sword, sword intent, bamboo forest, 2d style",
        "backpack on back, travel gear, mountain peak, misty atmosphere",
        "serious face, looking at viewer, cinematic lighting, sharp focus",
        "flowing hair, sword master pose, floating silk, ink sketch style"
    ]
    
    target_idx = 0
    for i, data in enumerate(data_list):
        if i in to_delete: continue
        img = cv2.imread(data["tmp_path"])
        processed_img = resize_with_padding(img, (512, 512))
        target_name = f"cp_anchors_{target_idx:03d}"
        
        # Build dynamic caption
        attr = attributes[target_idx % len(attributes)]
        final_caption = f"{trigger}, {style_reinforcement}, {attr}"
        
        cv2.imwrite(os.path.join(image_out, f"{target_name}.png"), processed_img, [cv2.IMWRITE_PNG_COMPRESSION, 0])
        with open(os.path.join(caption_out, f"{target_name}.txt"), "w") as cf:
            cf.write(final_caption)
        target_idx += 1

    # Report
    with open(os.path.join(output_report_dir, "duplicates_final.txt"), "w") as df:
        df.write("--- LoRA Refinement Pruning Report ---\n")
        df.write("\n".join(pruned_info))
        
    with open(os.path.join(output_report_dir, "dataset_ready_report.md"), "w") as rr:
        rr.write("# 🚀 LoRA Refinement Ready Report\n\n")
        rr.write(f"- **Total Samples**: {target_idx}\n")
        rr.write(f"- **Resize**: 512x512 with Padding\n")
        rr.write(f"- **Pruning**: Top 4 Redundant Pairs Removed\n")
        
    shutil.rmtree(tmp_unzip)
    print(f"[Success] Built. Samples: {target_idx}")

if __name__ == "__main__":
    refine_lora_dataset()
