import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import glob

def visualize_embeddings():
    raw_dir = "./work/faces/raw/"
    dataset_base = "./dataset/"
    output_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    
    # 1. Load data
    emb_files = glob.glob(os.path.join(raw_dir, "*.npy"))
    if not emb_files:
        print("No embeddings found.")
        return
        
    embeddings = []
    labels = []
    
    # Map file to character ID by checking dataset folder
    char_map = {}
    for char_folder in os.listdir(dataset_base):
        if os.path.isdir(os.path.join(dataset_base, char_folder)):
            # Loop through all pngs in subfolders (A, B, C or root)
            char_files = glob.glob(os.path.join(dataset_base, char_folder, "**/*.png"), recursive=True)
            for f in char_files:
                base = os.path.splitext(os.path.basename(f))[0]
                char_map[base] = char_folder
                
    for f in emb_files:
        base = os.path.splitext(os.path.basename(f))[0]
        if base in char_map:
            embeddings.append(np.load(f))
            labels.append(char_map[base])
            
    if not embeddings:
        print("No matches between embeddings and dataset.")
        return
        
    embeddings = np.array(embeddings)
    
    # 2. PCA
    print("--- Running PCA...")
    pca = PCA(n_components=2)
    vis_data = pca.fit_transform(embeddings)
    
    # 3. Plot
    df = pd.DataFrame(vis_data, columns=['PC1', 'PC2'])
    df['Character'] = labels
    
    plt.figure(figsize=(12, 8))
    sns.scatterplot(data=df, x='PC1', y='PC2', hue='Character', style='Character', palette='Set1', alpha=0.7)
    plt.title("Character Embedding Visualization (PCA)")
    plt.xlabel("Principal Component 1")
    plt.ylabel("Principal Component 2")
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.tight_layout()
    plt.grid(True, linestyle='--', alpha=0.5)
    
    plot_path = os.path.join(output_dir, "embedding_viz.png")
    plt.savefig(plot_path)
    print(f"--- Visualization saved to {plot_path}")
    
    # 4. Cluster Purity Score (Approximate using Silhouette)
    if len(set(labels)) > 1:
        try:
            score = silhouette_score(embeddings, labels)
            print(f"--- Average Silhouette Score (Clustering Purity): {score:.4f}")
            
            # Save stats
            with open(os.path.join(output_dir, "purity_stats.txt"), "w") as f:
                f.write(f"Silhouette Score: {score:.4f}\n")
        except Exception as e:
            print(f"Error calculating silhouette score: {e}")
    else:
        print("--- Single cluster (or not enough labels), skipping Silhouette Score.")

if __name__ == "__main__":
    visualize_embeddings()
