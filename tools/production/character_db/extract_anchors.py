import os
import json
import shutil
import glob
from tqdm import tqdm
import cv2
import numpy as np

def extract_anchors():
    dataset_base = "./dataset/"
    raw_meta_dir = "./work/faces/raw/"
    output_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    anchor_storage = "./dataset/anchors_golden/"
    
    if os.path.exists(anchor_storage):
        shutil.rmtree(anchor_storage)
    os.makedirs(anchor_storage, exist_ok=True)
    
    # 1. Collect all images for character_000 (including sub-clusters)
    # We use character_000 specifically as target
    char_dir = os.path.join(dataset_base, "character_000")
    if not os.path.exists(char_dir):
        print("Error: character_000 dir not found.")
        return

    # User mentioned character_000 is the main focus for anchors. 
    # But he also mentioned "embedding space multi-island", 
    # so we should probably scan the whole dataset/character_000 AND the split clusters if needed?
    # Actually, he wants 40-60 high purity anchors for the character.
    # I will scan all .png files in character_000 recursively.
    
    face_files = glob.glob(os.path.join(char_dir, "**/*.png"), recursive=True)
    if not face_files:
        print("No images found in character_000/.")
        return

    print(f"\n[Anchor-Extractor] Scanning {len(face_files)} images from character_000...")
    
    candidates = []
    
    for face_path in tqdm(face_files):
        base_name = os.path.splitext(os.path.basename(face_path))[0]
        json_path = os.path.join(raw_meta_dir, f"{base_name}.json")
        
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r') as f:
                    meta = json.load(f)
                
                pitch, yaw, roll = meta["pose"] if meta["pose"] else (99, 99, 99)
                blur = meta["blur_score"]
                det = meta["det_score"]
                
                # Thresholds: Relaxed to get ~60
                # Blur > 150, Conf > 0.8, |Yaw| < 25
                if blur > 150 and det > 0.8 and abs(yaw) < 25:
                    candidates.append({
                        "path": face_path,
                        "blur": blur,
                        "det": det,
                        "yaw": yaw,
                        "base": base_name
                    })
            except Exception as e:
                pass

    print(f"--- Found {len(candidates)} raw candidates meeting strict thresholds.")
    
    # Sort by quality (Blur * Confidence)
    candidates.sort(key=lambda x: x["blur"] * x["det"], reverse=True)
    
    # Select Top 60
    top_60 = candidates[:60]
    
    # Save the files and generate preview
    imgs = []
    for idx, c in enumerate(top_60):
        src = c["path"]
        dst = os.path.join(anchor_storage, f"{idx:03d}_{c['base']}.png")
        shutil.copy(src, dst)
        
        img = cv2.imread(src)
        if img is not None:
            # Resize for composite preview
            imgs.append(cv2.resize(img, (256, 256)))
            
    # Generate anchor_preview.png (6x10 grid or similar)
    if imgs:
        rows = 6
        cols = 10
        preview_img = np.zeros((rows * 256, cols * 256, 3), dtype=np.uint8)
        
        for idx in range(len(imgs)):
            r = idx // cols
            c = idx % cols
            if r < rows:
                preview_img[r*256:(r+1)*256, c*256:(c+1)*256] = imgs[idx]
        
        preview_path = os.path.join(output_dir, "anchor_preview.png")
        cv2.imwrite(preview_path, preview_img)
        print(f"--- Mosaic preview saved to {preview_path}")

    # Output manifest
    with open(os.path.join(output_dir, "anchor_manifest.json"), "w") as f:
        json.dump(top_60, f, indent=2)

    print(f"\n[Success] Anchor extraction complete. Total A-grade anchors: {len(top_60)}")

if __name__ == "__main__":
    extract_anchors()
