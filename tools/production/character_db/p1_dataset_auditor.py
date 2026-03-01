import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis
import glob
from tqdm import tqdm

def get_composition(img_h, bbox):
    # bbox is [x1, y1, x2, y2]
    face_h = bbox[3] - bbox[1]
    ratio = face_h / img_h
    if ratio > 0.4:
        return "Portrait (Face Focus)"
    elif ratio > 0.15:
        return "Half-Body"
    else:
        return "Full-Body"

def p1_auditor():
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640)) # Lower for speed

    anchor_dir = "dataset/anchors_golden/"
    train_dir = "dataset/chenpingan_v7_steel/images/"
    output_report = "docs/_evidence/jianlai_lora_fix/P1_dataset_audit/report.md"
    os.makedirs(os.path.dirname(output_report), exist_ok=True)

    # 1. Load Anchor Embeddings
    print("Loading Golden Anchors...")
    anchor_feats = []
    raw_meta_dir = "work/faces/raw/"
    anchor_pngs = glob.glob(os.path.join(anchor_dir, "*.png"))
    for png in anchor_pngs:
        # Try finding corresponding .npy in raw_meta_dir
        # Anchor name: 059_E21_...png
        # Raw name: E21_...png (likely)
        base_name = os.path.basename(png)
        # Remove the numeric prefix if it exists (e.g., "059_")
        if "_" in base_name and base_name[:3].isdigit():
            clean_name = base_name.split("_", 1)[1]
        else:
            clean_name = base_name
        
        npy_path = os.path.join(raw_meta_dir, clean_name.replace(".png", ".npy"))
        
        if os.path.exists(npy_path):
            anchor_feats.append(np.load(npy_path))
    
    if not anchor_feats:
        print("Error: No golden anchors found. Attempting to scan first 50 npy from work/faces/raw/...")
        # Emergency scavenger: take first 10 npy files from raw
        raw_npys = glob.glob(os.path.join(raw_meta_dir, "*.npy"))[:50]
        for npy in raw_npys:
            anchor_feats.append(np.load(npy))

    if not anchor_feats:
        print("Fatal: No embeddings found.")
        return

    # 2. Audit Dataset
    print(f"Auditing Dataset (Det Thresh 0.3)...")
    img_files = glob.glob(os.path.join(train_dir, "*.png")) + glob.glob(os.path.join(train_dir, "*.jpg"))
    
    stats = {
        "total": len(img_files),
        "Portrait (Face Focus)": 0,
        "Half-Body": 0,
        "Full-Body": 0,
        "Identity Match (Sim > 0.4)": 0,
        "Identity Weak (Sim < 0.4)": 0,
        "Multi-Face Found": 0,
        "No Face Found": 0
    }

    report_lines = [
        "# P1 Dataset Audit Report",
        f"**Target Directory**: {train_dir}",
        f"**Total Samples**: {len(img_files)}",
        ""
    ]

    kept_list = []
    bad_list = []

    for img_path in tqdm(img_files):
        img = cv2.imread(img_path)
        if img is None: continue
        h, w = img.shape[:2]
        
        # Try multiple detection sizes and lower threshold for animation
        faces = []
        for d_size in [(640, 640), (1024, 1024)]:
            app.prepare(ctx_id=0, det_size=d_size)
            faces = app.get(img)
            # Filter by manual threshold 0.3
            faces = [f for f in faces if f.det_score > 0.3]
            if faces: break
        
        if not faces:
            stats["No Face Found"] += 1
            bad_list.append(f"{os.path.basename(img_path)}: No face detected")
            continue

        if len(faces) > 1:
            stats["Multi-Face Found"] += 1

        # Find best matching face if multiple
        best_sim = -1
        best_face = None
        for f in faces:
            sims = [np.dot(f.normed_embedding, anc) for anc in anchor_feats]
            avg_sim = np.max(sims)
            if avg_sim > best_sim:
                best_sim = avg_sim
                best_face = f
        
        comp = get_composition(h, best_face.bbox)
        stats[comp] += stats.get(comp, 0) # Just incrementing below
        # Wait, stats[comp] += 1 is enough
        
        # Correcting the increment logic
        stats[comp] = stats.get(comp, 0) + 1 # safer

        if best_sim > 0.4:
            stats["Identity Match (Sim > 0.4)"] += 1
            kept_list.append(os.path.basename(img_path))
        else:
            stats["Identity Weak (Sim < 0.4)"] += 1
            bad_list.append(f"{os.path.basename(img_path)}: Sim {best_sim:.2f}")

    # 3. Finalize Report
    report_lines.append("## Composition Statistics")
    for k in ["Portrait (Face Focus)", "Half-Body", "Full-Body"]:
        v = stats[k]
        report_lines.append(f"- **{k}**: {v} ({v/stats['total']*100:.1f}%)")

    report_lines.append("\n## Identity Purity")
    report_lines.append(f"- **Identity Match (Sim > 0.4)**: {stats['Identity Match (Sim > 0.4)']}")
    report_lines.append(f"- **Identity Weak (Sim < 0.4)**: {stats['Identity Weak (Sim < 0.4)']}")
    report_lines.append(f"- **No Face Detected**: {stats['No Face Found']}")

    report_lines.append("\n## Recommendations")
    if stats["Portrait (Face Focus)"] / max(1, stats["total"]) > 0.8:
        report_lines.append("- [WARNING] Dataset is too portrait-heavy. MUST add half/full body samples.")
    if stats["Identity Weak (Sim < 0.4)"] > 0:
        report_lines.append(f"- [DEBUG] Found {stats['Identity Weak (Sim < 0.4)']} potential contamination samples. Check `badlist.txt`.")

    with open(output_report, "w") as f:
        f.write("\n".join(report_lines))

    with open("docs/_evidence/jianlai_lora_fix/P1_dataset_audit/badlist.txt", "w") as f:
        f.write("\n".join(bad_list))

    with open("docs/_evidence/jianlai_lora_fix/P1_dataset_audit/keptlist.txt", "w") as f:
        f.write("\n".join(kept_list))

    print(f"P1 Audit Complete. Report: {output_report}")

if __name__ == "__main__":
    p1_auditor()
