import os
import re

def lint_identity_captions():
    captions_dir = "dataset/chenpingan_v7_steel/captions"
    trigger = "cp_chenpingan"
    # Words that cause identity drift or describe style (which we want to bypass in Identity LoRA)
    forbidden_words = [
        "beard", "mustache", "stubble", "facial hair", 
        "realistic", "hyperrealistic", "man", "adult", 
        "detailed skin", "skin pores", "cinematic lighting",
        "jianlai_3d" # We remove style trigger here to force it to learn identity only
    ]
    
    if not os.path.exists(captions_dir):
        print(f"Error: {captions_dir} not found.")
        return

    print(f"Linting captions in {captions_dir}...")
    
    count = 0
    for filename in sorted(os.listdir(captions_dir)):
        if filename.endswith(".txt"):
            filepath = os.path.join(captions_dir, filename)
            with open(filepath, "r") as f:
                content = f.read().strip()
            
            # Standardize Trigger
            new_content = content
            if trigger not in new_content:
                new_content = f"{trigger}, {new_content}"
            
            # Remove drift words
            for word in forbidden_words:
                pattern = re.compile(re.escape(word), re.IGNORECASE)
                new_content = pattern.sub("", new_content)
            
            # Cleanup commas and spaces
            new_content = re.sub(r',\s*,', ',', new_content)
            new_content = re.sub(r'^\s*,\s*', '', new_content)
            new_content = re.sub(r'\s*,\s*$', '', new_content)
            new_content = re.sub(r'\s+', ' ', new_content).strip()
            new_content = new_content.replace(", ,", ",")
            
            with open(filepath, "w") as f:
                f.write(new_content)
            count += 1

    print(f"Linting complete. {count} captions updated for P2-B Gold Standard.")

if __name__ == "__main__":
    lint_identity_captions()
