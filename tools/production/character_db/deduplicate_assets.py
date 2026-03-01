import os
import numpy as np
import glob
from PIL import Image
import imagehash
from tqdm import tqdm

def detect_duplicates():
    dataset_base = "./dataset/"
    raw_dir = "./work/faces/raw/"
    output_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    
    # 1. Get all images in dataset
    # We look in grouped folders
    char_files = glob.glob(os.path.join(dataset_base, "**/*.png"), recursive=True)
    # Remove visualizations from search
    char_files = [f for f in char_files if "mosaic" not in f and "preview" not in f and "embedding_viz" not in f]
    
    if not char_files:
        print("No images found in dataset/.")
        return

    print(f"\n[Deduplication] Scanning {len(char_files)} images...")
    
    hashes = {} # hash -> path
    embeddings = {} # path -> normalized_embedding
    duplicates = []
    
    for f in tqdm(char_files):
        base_name = os.path.splitext(os.path.basename(f))[0]
        
        # A. Hash check
        try:
            h = str(imagehash.phash(Image.open(f)))
            if h in hashes:
                duplicates.append((f, hashes[h], "PHash Match"))
                continue 
            else:
                hashes[h] = f
        except Exception as e:
            # print(f"Error hashing {f}: {e}")
            pass
            
        # B. Load embedding for similarity check
        # We find global meta for these files
        emb_path = os.path.join(raw_dir, f"{base_name}.npy")
        if os.path.exists(emb_path):
            emb = np.load(emb_path)
            norm = np.linalg.norm(emb)
            if norm > 1e-6:
                embeddings[f] = emb / norm

    # C. Embedding similarity check (>0.95)
    print("--- Comparing embeddings (this may take a moment)...")
    keys = list(embeddings.keys())
    for i in range(len(keys)):
        # Optimization: only check against seen hashes as we already handled direct matches
        # but embedding offers higher sensitivity.
        for j in range(i + 1, len(keys)):
            sim = float(np.dot(embeddings[keys[i]], embeddings[keys[j]]))
            if sim > 0.95:
                duplicates.append((keys[i], keys[j], f"Embedding Similarity: {sim:.4f}"))

    # 2. Output Report
    report_path = os.path.join(output_dir, "duplicates_report.txt")
    with open(report_path, "w") as f_out:
        f_out.write("--- Duplicate Detection Report ---\n\n")
        f_out.write(f"Total images checked: {len(char_files)}\n")
        f_out.write(f"Duplicate pairs found: {len(duplicates)}\n\n")
        
        for d in duplicates:
            f_out.write(f"Match found:\n - {d[0]}\n - {d[1]}\n - Reason: {d[2]}\n\n")
            
    print(f"--- Duplicate report saved to {report_path}")
    print(f"--- Total duplicate entries found: {len(duplicates)}")

if __name__ == "__main__":
    detect_duplicates()
