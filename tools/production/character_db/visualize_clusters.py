import os
import cv2
import numpy as np
import glob

def generate_mosaics():
    dataset_base = "./dataset/"
    output_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    os.makedirs(output_dir, exist_ok=True)
    
    characters = [d for d in os.listdir(dataset_base) if os.path.isdir(os.path.join(dataset_base, d)) and d != "unknown"]
    
    for char in characters:
        char_dir = os.path.join(dataset_base, char)
        face_files = glob.glob(os.path.join(char_dir, "*.png"))
        if not face_files:
            continue
            
        # Select up to 10 images
        face_files = face_files[:10]
        imgs = []
        for f in face_files:
            img = cv2.imread(f)
            if img is not None:
                # Resize specifically for thumbnail consistency
                img = cv2.resize(img, (256, 256))
                imgs.append(img)
        
        if not imgs:
            continue
            
        # Create grid (2x5 or smaller)
        rows = 2
        cols = 5
        grid_img = np.zeros((rows * 256, cols * 256, 3), dtype=np.uint8)
        
        for idx, img in enumerate(imgs):
            r = idx // cols
            c = idx % cols
            grid_img[r*256:(r+1)*256, c*256:(c+1)*256] = img
            
        out_path = os.path.join(output_dir, f"{char}_mosaic.png")
        cv2.imwrite(out_path, grid_img)
        print(f"[Mosaic] Created for {char}: {out_path}")

if __name__ == "__main__":
    generate_mosaics()
