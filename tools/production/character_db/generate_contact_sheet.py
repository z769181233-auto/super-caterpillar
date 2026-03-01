import os
import math
from PIL import Image

def generate_contact_sheet(directory_path, output_path, max_images=50, thumb_size=(128, 128)):
    # Find images, sort by name or time
    images = []
    for f in sorted(os.listdir(directory_path)):
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            images.append(os.path.join(directory_path, f))
    
    images = images[:max_images]
    if not images:
        print("No images found.")
        return

    num_images = len(images)
    cols = int(math.ceil(math.sqrt(num_images)))
    rows = int(math.ceil(num_images / cols))

    sheet_width = cols * thumb_size[0]
    sheet_height = rows * thumb_size[1]
    
    contact_sheet = Image.new("RGB", (sheet_width, sheet_height), (255, 255, 255))

    for i, img_path in enumerate(images):
        try:
            with Image.open(img_path) as img:
                img.thumbnail(thumb_size)
                x = (i % cols) * thumb_size[0]
                y = (i // cols) * thumb_size[1]
                # Center thumbnail in its cell
                paste_x = x + (thumb_size[0] - img.width) // 2
                paste_y = y + (thumb_size[1] - img.height) // 2
                contact_sheet.paste(img, (paste_x, paste_y))
        except Exception as e:
            print(f"Error processing {img_path}: {e}")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    contact_sheet.save(output_path)
    print(f"Contact sheet saved to {output_path}")

if __name__ == "__main__":
    train_dir = "dataset/jianlai_style/images"
    output = "docs/_evidence/retrain_p2a_v2/dataset_inventory/thumb_contact_sheet_page_01.png"
    generate_contact_sheet(train_dir, output)
