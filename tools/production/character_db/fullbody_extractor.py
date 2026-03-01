import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis
import glob
import json
import argparse
from tqdm import tqdm

def get_cosine_similarity(feat1, feat2):
    return np.dot(feat1, feat2) / (np.linalg.norm(feat1) * np.linalg.norm(feat2))

def fullbody_extractor(source_dir, anchor_dir, output_dir):
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(1280, 1280)) # Increased for body shots

    # Load Anchors
    anchor_feats = []
    raw_meta_dir = "./work/faces/raw/"
    png_files = glob.glob(os.path.join(anchor_dir, "*.png"))
    print(f"Found {len(png_files)} anchor PNGs in {anchor_dir}")
    for anchor_path in png_files:
        # Standard anchor filenames are like "000_E21_..._0.png"
        # Original name is after the first 4 chars
        base_name = os.path.basename(anchor_path)[4:-4]
        emb_path = os.path.join(raw_meta_dir, f"{base_name}.npy")
        
        if os.path.exists(emb_path):
            anchor_feats.append(np.load(emb_path))
        else:
            # Fallback to direct extraction if possible
            img = cv2.imread(anchor_path)
            if img is not None:
                faces = app.get(img)
                if faces:
                    anchor_feats.append(faces[0].normed_embedding)
    
    if not anchor_feats:
        print(f"Error: No golden anchors features extracted from {len(png_files)} files.")
        return

    os.makedirs(output_dir, exist_ok=True)
    images_found = glob.glob(os.path.join(source_dir, "**/*.png"), recursive=True)
    
    print(f"Processing {len(images_found)} source images...")
    
    stats = {"half": 0, "full": 0, "face": 0}
    
    for img_path in tqdm(images_found):
        img = cv2.imread(img_path)
        if img is None: continue
        
        faces = app.get(img)
        for face in faces:
            # Identity Check
            sims = [get_cosine_similarity(face.normed_embedding, a) for a in anchor_feats]
            if max(sims) < 0.38: # Further lowered to 0.38 for maximum yield in complex animation lighting
                continue
            
            pitch, yaw, roll = face.pose
            if abs(yaw) > 45: # Relaxed yaw as per user request
                continue
            
            bbox = face.bbox.astype(int)
            h, w, _ = img.shape
            
            # Extract Half Body / Full Body based on Face BBox
            # Naive estimation: 
            # Half body: head height * 4 downwards
            # Full body: head height * 8 downwards
            face_h = bbox[3] - bbox[1]
            face_w = bbox[2] - bbox[0]
            
            # Half Body Crop (approx 512x768 aspect)
            half_top = max(0, bbox[1] - face_h)
            half_bottom = min(h, bbox[1] + face_h * 5)
            half_left = max(0, bbox[0] - face_w * 2)
            half_right = min(w, bbox[2] + face_w * 2)
            
            half_img = img[half_top:half_bottom, half_left:half_right]
            if half_img.size > 0:
                cv2.imwrite(os.path.join(output_dir, f"half_{os.path.basename(img_path)}"), half_img)
                stats["half"] += 1

            # Full Body Crop (approx head height * 8 downwards)
            full_bottom = min(h, bbox[1] + face_h * 9)
            full_img = img[half_top:full_bottom, half_left:half_right]
            if full_img.size > 0:
                cv2.imwrite(os.path.join(output_dir, f"full_{os.path.basename(img_path)}"), full_img)
                stats["full"] += 1
                
    print(f"Extraction complete: {stats}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=str, required=True)
    parser.add_argument("--anchors", type=str, default="./dataset/anchors_golden/")
    parser.add_argument("--output", type=str, default="./dataset/chenpingan_lora_ext/")
    args = parser.parse_args()
    fullbody_extractor(args.source, args.anchors, args.output)
