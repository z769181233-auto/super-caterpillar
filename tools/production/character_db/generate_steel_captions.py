import os

def generate_steel_captions():
    images_dir = "dataset/chenpingan_v7_steel/images"
    captions_dir = "dataset/chenpingan_v7_steel/captions"
    os.makedirs(captions_dir, exist_ok=True)
    
    trigger = "cp_chenpingan"
    style = "jianlai_3d"
    
    total = 0
    for filename in os.listdir(images_dir):
        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            base = os.path.splitext(filename)[0]
            caption_file = os.path.join(captions_dir, f"{base}.txt")
            
            # Simple but consistent caption structure
            # For scavenged images, we don't have existing captions, so we build them
            content = f"{trigger}, {style}, 1boy, solo"
            
            with open(caption_file, "w") as f:
                f.write(content)
            total += 1
            
    # Also copy existing hardened captions from the original dataset if applicable
    # Wait, the merge copied all PNGs. I should check if captions exist in the source folders.
    # Actually, the original 57 had some specific captions. Let's merge them better.
    
    orig_captions_dir = "dataset/chenpingan_lora/train/captions"
    for filename in os.listdir(orig_captions_dir):
        if filename.endswith(".txt"):
            src = os.path.join(orig_captions_dir, filename)
            dst = os.path.join(captions_dir, filename)
            # copy original hardened captions (these are better than generic ones)
            import shutil
            shutil.copy(src, dst)
            
    print(f"Generated/Merged {total} captions for Steel Dataset.")

if __name__ == "__main__":
    generate_steel_captions()
