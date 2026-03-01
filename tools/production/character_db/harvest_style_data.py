import os
import shutil
import glob

def harvest():
    src_root = "work/frames"
    dst_img_dir = "dataset/jianlai_style/images"
    dst_cap_dir = "dataset/jianlai_style/captions"
    os.makedirs(dst_img_dir, exist_ok=True)
    os.makedirs(dst_cap_dir, exist_ok=True)

    # find all png files
    all_pngs = []
    for root, dirs, files in os.walk(src_root):
        for f in files:
            if f.endswith(".png"):
                all_pngs.append(os.path.join(root, f))

    all_pngs.sort()
    total = len(all_pngs)
    print(f"Found {total} frames in {src_root}")

    # Sample every 3rd frame to get ~889
    count = 0
    for i in range(0, total, 3):
        src_path = all_pngs[i]
        base_name = os.path.basename(src_path)
        # Create a unique name to avoid collisions across scenes
        # We can use the scene directory name as a prefix
        scene_dir = os.path.basename(os.path.dirname(src_path))
        new_name = f"{scene_dir}_{base_name}"
        
        dst_path = os.path.join(dst_img_dir, new_name)
        shutil.copy2(src_path, dst_path)
        
        # Create caption
        cap_path = os.path.join(dst_cap_dir, new_name.replace(".png", ".txt"))
        with open(cap_path, "w") as f:
            f.write("jianlai_3d")
        
        count += 1

    print(f"Harvested {count} frames and captions to {dst_img_dir}")

if __name__ == "__main__":
    harvest()
