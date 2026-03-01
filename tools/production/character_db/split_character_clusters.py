import os
import numpy as np
import hdbscan
import shutil
import glob
from tqdm import tqdm
import cv2

def split_character_clusters():
    char_000_dir = "./dataset/character_000/"
    raw_dir = "./work/faces/raw/"
    output_dir = "./dataset/character_000_split/"
    
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Get all images in character_000 (recursively find A, B, C)
    char_pngs = glob.glob(os.path.join(char_000_dir, "**/*.png"), recursive=True)
    if not char_pngs:
        print("No images found in character_000/.")
        return

    print(f"\n[Split-Cluster] Found {len(char_pngs)} images in character_000/.")
    
    embeddings = []
    labels_order = []
    original_paths = []
    
    for f in tqdm(char_pngs):
        base_name = os.path.splitext(os.path.basename(f))[0]
        emb_path = os.path.join(raw_dir, f"{base_name}.npy")
        if os.path.exists(emb_path):
            emb = np.load(emb_path)
            embeddings.append(emb)
            labels_order.append(base_name)
            original_paths.append(f)
    
    if not embeddings:
        print("No embeddings found for character_000 files.")
        return
        
    embeddings = np.array(embeddings)
    
    # 2. HDBSCAN
    # Use L2-normalization + Euclidean to simulate Cosine distance
    print("--- Normalizing embeddings and running HDBSCAN (min_cluster_size=10, metric='euclidean')...")
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings_norm = embeddings / (norms + 1e-10)
    
    clusterer = hdbscan.HDBSCAN(min_cluster_size=10, metric='euclidean', gen_min_span_tree=True)
    cluster_labels = clusterer.fit_predict(embeddings_norm)
    
    unique_labels = set(cluster_labels)
    n_sub = len(unique_labels) - (1 if -1 in unique_labels else 0)
    print(f"--- Detected {n_sub} sub-clusters (Label -1 is noise).")
    
    # 3. Move and Export Previews
    for label in unique_labels:
        folder_name = f"cluster_{label:03d}" if label != -1 else "noise"
        target_dir = os.path.join(output_dir, folder_name)
        os.makedirs(target_dir, exist_ok=True)
        
        indices = np.where(cluster_labels == label)[0]
        print(f"--- Folder {folder_name}: {len(indices)} images")
        
        for idx in indices:
            name = labels_order[idx]
            src = original_paths[idx]
            dst = os.path.join(target_dir, f"{name}.png")
            shutil.copy(src, dst)
            
        # Generate Preview for the cluster
        if len(indices) > 0:
            # Pick up to 10 for preview
            preview_indices = indices[:10]
            img_list = []
            for p_idx in preview_indices:
                img = cv2.imread(original_paths[p_idx])
                if img is not None:
                    img_list.append(cv2.resize(img, (200, 200)))
            
            if img_list:
                # Arrange in a row or grid
                combined = np.hstack(img_list)
                cv2.imwrite(os.path.join(output_dir, f"preview_{folder_name}.png"), combined)

    print(f"\n[Success] Sub-cluster splitting complete. Results in {output_dir}")

if __name__ == "__main__":
    split_character_clusters()
