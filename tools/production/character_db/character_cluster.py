import os
import numpy as np
from sklearn.cluster import DBSCAN
import shutil
import glob
from tqdm import tqdm

def run_clustering():
    raw_dir = "./work/faces/raw/"
    dataset_dir = "./dataset/"
    
    # 1. 加載所有 Embedding
    emb_files = glob.glob(os.path.join(raw_dir, "*.npy"))
    if not emb_files:
        print("No embeddings found.")
        return

    print(f"\n[Clustering] Loading {len(emb_files)} embeddings...")
    embeddings = []
    labels_order = []
    
    for f in tqdm(emb_files):
        emb = np.load(f)
        embeddings.append(emb)
        # 提取文件名作為 ID (去除 .npy)
        labels_order.append(os.path.basename(f).replace(".npy", ""))
        
    embeddings = np.array(embeddings)

    # 2. DBSCAN 聚類
    # eps=0.6, min_samples=5, metric=cosine (根據用戶要求)
    print("--- Running DBSCAN...")
    db = DBSCAN(eps=0.6, min_samples=5, metric='cosine').fit(embeddings)
    cluster_labels = db.labels_

    # 3. 整理結果
    unique_labels = set(cluster_labels)
    n_clusters = len(unique_labels) - (1 if -1 in unique_labels else 0)
    print(f"--- Detected {n_clusters} character clusters (Label -1 is unknown).")

    for label in unique_labels:
        folder_name = f"character_{label:03d}" if label != -1 else "unknown"
        target_dir = os.path.join(dataset_dir, folder_name)
        os.makedirs(target_dir, exist_ok=True)
        
        # 找出屬於該類別的文件
        indices = np.where(cluster_labels == label)[0]
        for idx in indices:
            base_name = labels_order[idx]
            src_png = os.path.join(raw_dir, f"{base_name}.png")
            dst_png = os.path.join(target_dir, f"{base_name}.png")
            
            if os.path.exists(src_png):
                shutil.copy(src_png, dst_png)

    print(f"\n[Success] Clustering complete. Results in {dataset_dir}")

    # 統計信息
    print("\n[Statistics]")
    for label in sorted(unique_labels):
        name = f"character_{label:03d}" if label != -1 else "unknown"
        count = np.sum(cluster_labels == label)
        print(f"- {name}: {count} images")

if __name__ == "__main__":
    run_clustering()
