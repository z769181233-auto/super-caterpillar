import os
import json
import shutil
import glob
from tqdm import tqdm

def grade_quality():
    dataset_base = "./dataset/"
    raw_meta_dir = "./work/faces/raw/"
    
    # Thresholds
    # A: Top (Sharp, Frontal)
    # B: Medium (Acceptable)
    # C: Low (Side, Blur, Noise)
    
    A_THRESH = {"yaw": 15, "pitch": 15, "blur": 60, "det": 0.9}
    B_THRESH = {"yaw": 30, "pitch": 30, "blur": 35, "det": 0.7}

    # Ensure dataset exists
    if not os.path.exists(dataset_base):
        print(f"Error: {dataset_base} not found.")
        return

    characters = [d for d in os.listdir(dataset_base) if os.path.isdir(os.path.join(dataset_base, d)) and d != "unknown"]
    
    if not characters:
        print("No character folders found in dataset/.")
        return

    for char in characters:
        char_dir = os.path.join(dataset_base, char)
        # Create subfolders
        for g in ['A', 'B', 'C']:
            os.makedirs(os.path.join(char_dir, g), exist_ok=True)
            
        face_files = glob.glob(os.path.join(char_dir, "*.png"))
        if not face_files:
            continue
            
        print(f"\n[Grader] Grading {char} ({len(face_files)} images)...")
        
        counts = {"A": 0, "B": 0, "C": 0}
        
        for face_path in tqdm(face_files):
            base_name = os.path.splitext(os.path.basename(face_path))[0]
            json_path = os.path.join(raw_meta_dir, f"{base_name}.json")
            
            target_grade = "C"
            
            if os.path.exists(json_path):
                try:
                    with open(json_path, 'r') as f:
                        meta = json.load(f)
                    
                    pitch, yaw, roll = meta["pose"] if meta["pose"] else (99, 99, 99)
                    blur = meta["blur_score"]
                    det = meta["det_score"]
                    
                    if abs(yaw) <= A_THRESH["yaw"] and abs(pitch) <= A_THRESH["pitch"] and blur >= A_THRESH["blur"] and det >= A_THRESH["det"]:
                        target_grade = "A"
                    elif abs(yaw) <= B_THRESH["yaw"] and abs(pitch) <= B_THRESH["pitch"] and blur >= B_THRESH["blur"] and det >= B_THRESH["det"]:
                        target_grade = "B"
                except Exception as e:
                    print(f"Error reading {json_path}: {e}")
                    target_grade = "C"
            
            shutil.move(face_path, os.path.join(char_dir, target_grade, os.path.basename(face_path)))
            counts[target_grade] += 1
            
        print(f"--- Results for {char}: A={counts['A']}, B={counts['B']}, C={counts['C']}")

if __name__ == "__main__":
    grade_quality()
