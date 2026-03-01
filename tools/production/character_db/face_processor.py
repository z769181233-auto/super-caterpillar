import os
import cv2
import numpy as np
from insightface.app import FaceAnalysis
import glob
import time
from tqdm import tqdm
import argparse
import json

def align_face(img, kps, output_size=512):
    dst_kps = np.array([
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041]
    ], dtype=np.float32)
    dst_kps = dst_kps * (output_size / 112.0)
    tform = cv2.estimateAffinePartial2D(kps, dst_kps)[0]
    face_img = cv2.warpAffine(img, tform, (output_size, output_size))
    return face_img

def get_blur_score(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()

def process_faces_worker(target_ep_dir):
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640))

    input_base = target_ep_dir
    output_raw = "./work/faces/raw/"
    os.makedirs(output_raw, exist_ok=True)

    processed_frames = set()
    print(f"[Face-Processor] Monitoring {target_ep_dir} for new keyframes...")

    while True:
        frame_paths = glob.glob(os.path.join(input_base, "**/*.png"), recursive=True)
        new_frames = [f for f in frame_paths if f not in processed_frames]
        
        if new_frames:
            for frame_path in tqdm(new_frames):
                try:
                    parts = frame_path.split(os.sep)
                    idx = parts.index('frames')
                    ep = parts[idx+1]
                    clip = parts[idx+2]
                    frame_num = parts[idx+3].split('.')[0]
                except (ValueError, IndexError):
                    ep = "unknown_ep"
                    clip = "unknown_clip"
                    frame_num = os.path.basename(frame_path).split('.')[0]
                
                # Check if JSON exists to avoid re-processing
                # If we updated the script, we might want to re-process once. 
                # But for speed, let's just process new ones or ones missing JSON.
                check_path = os.path.join(output_raw, f"{ep}_{clip}_{frame_num}_0.json")
                if os.path.exists(check_path):
                    processed_frames.add(frame_path)
                    continue

                img = cv2.imread(frame_path)
                if img is None:
                    processed_frames.add(frame_path)
                    continue
                    
                faces = app.get(img)
                
                for i, face in enumerate(faces):
                    bbox = face.bbox.astype(int)
                    w = bbox[2] - bbox[0]
                    h = bbox[3] - bbox[1]
                    if w < 128 or h < 128:
                        continue
                    
                    face_img = align_face(img, face.kps, output_size=512)
                    blur_score = get_blur_score(face_img)
                    
                    label = f"{ep}_{clip}_{frame_num}_{i}"
                    out_path = os.path.join(output_raw, f"{label}.png")
                    emb_path = os.path.join(output_raw, f"{label}.npy")
                    json_path = os.path.join(output_raw, f"{label}.json")
                    
                    meta = {
                        "ep": ep,
                        "clip": clip,
                        "frame": frame_num,
                        "index": i,
                        "det_score": float(face.det_score),
                        "pose": face.pose.tolist() if face.pose is not None else None,
                        "blur_score": float(blur_score),
                        "bbox": bbox.tolist()
                    }
                    
                    cv2.imwrite(out_path, face_img)
                    np.save(emb_path, face.normed_embedding)
                    with open(json_path, 'w') as f:
                        json.dump(meta, f)
                    
                processed_frames.add(frame_path)
        
        time.sleep(20)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=str, required=True)
    args = parser.parse_args()
    process_faces_worker(args.dir)
