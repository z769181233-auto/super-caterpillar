import os
import json
import shutil
import glob
from tqdm import tqdm

def run_quality_filter():
    dataset_base = "./dataset/"
    
    # 篩選標準
    YAW_THRESHOLD = 30 # 偏航角，越小越正
    PITCH_THRESHOLD = 30 # 俯仰角
    BLUR_THRESHOLD = 30.0 # 模糊度評分 (Laplacian方差)，越大越清晰
    DET_SCORE_THRESHOLD = 0.6
    
    characters = [d for d in os.listdir(dataset_base) if os.path.isdir(os.path.join(dataset_base, d))]
    
    print(f"\n[Quality-Filter] Processing {len(characters)} character folders...")
    
    for char in characters:
        if char == "unknown":
            continue
            
        char_dir = os.path.join(dataset_base, char)
        face_files = glob.glob(os.path.join(char_dir, "*.png"))
        
        print(f"--- Cleaning {char} ({len(face_files)} images)...")
        
        for face_path in face_files:
            # 找到對應的 JSON 元數據
            # 原文件名格式: ep_clip_frame_num_index.png
            base_name = os.path.splitext(os.path.basename(face_path))[0]
            json_path = os.path.join("./work/faces/raw/", f"{base_name}.json")
            
            if not os.path.exists(json_path):
                # 如果沒有元數據，可能需要保留或刪除，這裡選擇保留以便後續人工檢查
                continue
                
            with open(json_path, 'r') as f:
                meta = json.load(f)
            
            # 執行過濾邏輯
            drop = False
            
            # 1. 檢測置信度
            if meta["det_score"] < DET_SCORE_THRESHOLD:
                drop = True
            
            # 2. 角度檢查 (Pose: [pitch, yaw, roll])
            if meta["pose"]:
                pitch, yaw, roll = meta["pose"]
                if abs(yaw) > YAW_THRESHOLD or abs(pitch) > PITCH_THRESHOLD:
                    drop = True
            
            # 3. 模糊度檢查
            if meta["blur_score"] < BLUR_THRESHOLD:
                drop = True
            
            if drop:
                # 這裡不直接刪除，而是移動到一個 trash 或 temp 目錄，或直接刪除
                # 用戶要求「刪除」，所以我們執行刪除
                os.remove(face_path)
                # 同時刪除可能的 npy (dataset中的npy通常不會複製，但如果複製了也要刪)
                npy_in_dataset = face_path.replace(".png", ".npy")
                if os.path.exists(npy_in_dataset):
                    os.remove(npy_in_dataset)

    print("\n[Success] Quality filtering complete.")

if __name__ == "__main__":
    run_quality_filter()
