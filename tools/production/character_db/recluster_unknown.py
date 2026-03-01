import os
import numpy as np
from sklearn.cluster import DBSCAN
import shutil
import glob
from tqdm import tqdm
import cv2

def recluster_unknown():
    unknown_dir = "./dataset/unknown/"
    raw_dir = "./work/faces/raw/"
    output_dir = "./dataset/unknown_clusters/"
    
    # Reset output dir if exists for clean run
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Get all unknown PNGs
    unknown_pngs = glob.glob(os.path.join(unknown_dir, "*.png"))
    if not unknown_pngs:
        print("No files in unknown/ to re-cluster.")
        return

    print(f"\n[Re-Clustering] Found {len(unknown_pngs)} images in unknown/.")
    
    embeddings = []
    labels_order = []
    
    for f in tqdm(unknown_pngs):
        base_name = os.path.splitext(os.path.basename(f))[0]
        emb_path = os.path.join(raw_dir, f"{base_name}.npy")
        if os.path.exists(emb_path):
            emb = np.load(emb_path)
            embeddings.append(emb)
            labels_order.append(base_name)
    
    if not embeddings:
        print("No embeddings found for unknown files.")
        return
        
    embeddings = np.array(embeddings)
    
    # 2. DBSCAN
    print("--- Running DBSCAN (eps=0.5, min_samples=3, metric='cosine')...")
    db = DBSCAN(eps=0.5, min_samples=3, metric='cosine').fit(embeddings)
    cluster_labels = db.labels_
    
    unique_labels = set(cluster_labels)
    n_sub = len(unique_labels) - (1 if -1 in unique_labels else 0)
    print(f"--- Detected {n_sub} character sub-clusters.")
    
    # 3. Move and Export Previews
    for label in unique_labels:
        folder_name = f"sub_{label:03d}" if label != -1 else "noise"
        target_dir = os.path.join(output_dir, folder_name)
        os.makedirs(target_dir, exist_ok=True)
        
        indices = np.where(cluster_labels == label)[0]
        print(f"--- Folder {folder_name}: {len(indices)} images")
        
        for idx in indices:
            name = labels_order[idx]
            src = os.path.join(unknown_dir, f"{name}.png")
            dst = os.path.join(target_dir, f"{name}.png")
            if os.path.exists(src):
                shutil.copy(src, dst)
                
        # Generate Preview for the cluster
        if label != -1 and len(indices) > 0:
            preview_files = [os.path.join(target_dir, f"{labels_order[idx]}.png") for idx in indices[:10]]
            img_list = []
            for pf in preview_files:
                img = cv2.imread(pf)
                if img is not None:
                    img_list.append(cv2.resize(img, (128, 128)))
            
            if img_list:
                combined = np.hstack(img_list)
                cv2.imwrite(os.path.join(output_dir, f"preview_{folder_name}.png"), combined)

    print(f"\n[Success] Re-clustering complete. Results in {output_dir}")

if __name__ == "__main__":
    recluster_unknown()
