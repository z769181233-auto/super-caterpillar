import os
import hashlib
import csv
from PIL import Image

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def audit_directory(directory_path, output_csv):
    files_data = []
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                filepath = os.path.join(root, file)
                rel_path = os.path.relpath(filepath, directory_path)
                sha256 = calculate_sha256(filepath)
                size_bytes = os.path.getsize(filepath)
                
                try:
                    with Image.open(filepath) as img:
                        width, height = img.size
                except Exception:
                    width, height = 0, 0
                
                files_data.append({
                    "rel_path": rel_path,
                    "sha256": sha256,
                    "bytes": size_bytes,
                    "width": width,
                    "height": height,
                    "ext": os.path.splitext(file)[1].lower()
                })
    
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["rel_path", "sha256", "bytes", "width", "height", "ext"])
        writer.writeheader()
        writer.writerows(files_data)
    
    return len(files_data)

if __name__ == "__main__":
    train_dir = "dataset/jianlai_style/images"
    output = "docs/_evidence/retrain_p2a_v2/dataset_inventory/current_train_dir_manifest.csv"
    os.makedirs(os.path.dirname(output), exist_ok=True)
    count = audit_directory(train_dir, output)
    print(f"Audited {count} files. Manifest saved to {output}")
