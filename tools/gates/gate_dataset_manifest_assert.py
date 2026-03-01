import os
import hashlib
import csv
import sys
from datetime import datetime

def calculate_sha256(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def run_gate():
    source_dir = "dataset/jianlai_style/images"
    gold_manifest = "docs/_evidence/retrain_p2a_v2/dataset_inventory/style_gold_manifest.csv"
    log_file = "docs/_evidence/retrain_p2a_v2/dataset_inventory/gate_dataset_manifest_assert.log"
    
    with open(log_file, "a", encoding="utf-8") as f_log:
        f_log.write(f"\n--- Gate Run: {datetime.now()} ---\n")
        
        # Load Gold
        gold_map = {}
        if not os.path.exists(gold_manifest):
            f_log.write(f"ERROR: Gold manifest not found at {gold_manifest}\n")
            return False
            
        with open(gold_manifest, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                gold_map[row["rel_path"]] = row["sha256"]
        
        # Scan Actual
        actual_files = []
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    actual_files.append(os.path.relpath(os.path.join(root, file), source_dir))
        
        f_log.write(f"Expected count: {len(gold_map)}\n")
        f_log.write(f"Actual count: {len(actual_files)}\n")
        
        errors = []
        if len(gold_map) != len(actual_files):
            errors.append(f"Count mismatch: Expected {len(gold_map)}, found {len(actual_files)}")
            
        for rel_path in actual_files:
            if rel_path not in gold_map:
                errors.append(f"Unexpected file: {rel_path}")
            else:
                actual_sha = calculate_sha256(os.path.join(source_dir, rel_path))
                if actual_sha != gold_map[rel_path]:
                    errors.append(f"SHA256 mismatch for {rel_path}")
        
        for rel_path in gold_map:
            if rel_path not in actual_files:
                errors.append(f"Missing file: {rel_path}")
        
        if errors:
            f_log.write("FAIL: Discrepancies found:\n")
            for err in errors:
                f_log.write(f"  - {err}\n")
            return False
        else:
            f_log.write("PASS: Dataset matches manifest perfectly.\n")
            return True

if __name__ == "__main__":
    if run_gate():
        print("Gate PASSED")
        sys.exit(0)
    else:
        print("Gate FAILED")
        sys.exit(1)
