import os
import re

def lint_captions():
    captions_dir = "dataset/chenpingan_lora/train/captions"
    trigger = "cp_chenpingan"
    forbidden_words = ["cinematic lighting", "detailed face", "highly detailed", "masterpiece", "best quality", "cel-shaded", "donghua style", "ink wash colors", "bold outlines", "xianxia"]
    
    report = []
    report.append("# Captions Linting Report\n")
    report.append("| File | Trigger Present | Forbidden Words Removed | Final Caption |")
    report.append("| :--- | :---: | :---: | :--- |")
    
    total_files = 0
    trigger_missing = 0
    words_removed_count = 0
    
    for filename in sorted(os.listdir(captions_dir)):
        if filename.endswith(".txt"):
            total_files += 1
            filepath = os.path.join(captions_dir, filename)
            with open(filepath, "r") as f:
                content = f.read().strip()
            
            # 1. Standardize Trigger: Replace any variation with cp_chenpingan
            # Old triggers might be JianLai_ChenPingan or just ChenPingan
            new_content = re.sub(r'(JianLai_ChenPingan|ChenPingan)', trigger, content, flags=re.IGNORECASE)
            if trigger not in new_content:
                new_content = f"{trigger}, {new_content}"
                trigger_missing += 1
            
            # 2. Remove generic style words
            removed = []
            for word in forbidden_words:
                if word in new_content.lower():
                    # Case insensitive replacement with global flag
                    pattern = re.compile(re.escape(word), re.IGNORECASE)
                    new_content = pattern.sub("", new_content)
                    removed.append(word)
                    words_removed_count += 1
            
            # Cleanup commas and spaces
            new_content = re.sub(r',\s*,', ',', new_content)
            new_content = re.sub(r'^\s*,\s*', '', new_content)
            new_content = re.sub(r'\s*,\s*$', '', new_content)
            new_content = re.sub(r'\s+', ' ', new_content).strip()
            
            with open(filepath, "w") as f:
                f.write(new_content)
            
            report.append(f"| {filename} | {'✅' if trigger in new_content else '❌'} | {'✅' if removed else 'None'} | {new_content} |")

    summary = f"\n## Summary\n- Total Files: {total_files}\n- Triggers Fixed/Added: {trigger_missing}\n- Forbidden Words Cleaned: {words_removed_count}\n"
    return summary + "\n".join(report)

if __name__ == "__main__":
    report_content = lint_captions()
    with open("/Users/adam/.gemini/antigravity/brain/00ab576b-730e-49a9-af0a-84c7cbcd4b4d/captions_linted_report.md", "w") as f:
        f.write(report_content)
    print("Linting complete. Report generated at artifacts.")
