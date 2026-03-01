import csv
import os
import shutil

def compare_and_quarantine():
    inventory_path = "docs/_evidence/retrain_p2a_v2/dataset_inventory/current_train_dir_manifest.csv"
    gold_manifest_path = "docs/_evidence/retrain_p2a_v2/dataset_inventory/style_gold_manifest.csv"
    diff_dir = "docs/_evidence/retrain_p2a_v2/dataset_inventory/diff"
    quarantine_dir = "dataset/_quarantine/unknown_in_train"
    train_dir = "dataset/jianlai_style/images"

    os.makedirs(diff_dir, exist_ok=True)
    os.makedirs(quarantine_dir, exist_ok=True)

    with open(inventory_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        current_data = list(reader)

    # Rule: Gold standard are files with "剑来" in name
    gold_data = [row for row in current_data if "剑来" in row["rel_path"]]
    
    # Write Gold Manifest
    with open(gold_manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(gold_data)

    # Diff
    gold_hashes = {row["sha256"] for row in gold_data}
    only_in_current = [row for row in current_data if row["sha256"] not in gold_hashes]
    missing_from_gold = [] # Since Gold is derived from current, this is empty for now
    intersection = [row for row in current_data if row["sha256"] in gold_hashes]

    def write_csv(path, data):
        if not data: return
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
            writer.writeheader()
            writer.writerows(data)

    write_csv(os.path.join(diff_dir, "only_in_current.csv"), only_in_current)
    write_csv(os.path.join(diff_dir, "intersection.csv"), intersection)

    # Quarantine
    quarantine_count = 0
    for row in only_in_current:
        src = os.path.join(train_dir, row["rel_path"])
        dst = os.path.join(quarantine_dir, row["rel_path"])
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.move(src, dst)
        quarantine_count += 1
    
    # Quarantine Report
    report_path = "docs/_evidence/retrain_p2a_v2/dataset_inventory/quarantine_report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# 📦 数据集隔离报告 (Quarantine Report)\n\n")
        f.write(f"- **隔离执行时间**: 2026-02-25\n")
        f.write(f"- **隔离数量**: {quarantine_count} 张异物图片\n")
        f.write(f"- **隔离路径**: `{quarantine_dir}/`\n\n")
        f.write("## 隔离文件列表\n")
        for row in only_in_current:
            f.write(f"- `{row['rel_path']}` (SHA256: `{row['sha256'][:8]}...`)\n")

    print(f"Quarantined {quarantine_count} files. Report saved to {report_path}")

if __name__ == "__main__":
    compare_and_quarantine()
