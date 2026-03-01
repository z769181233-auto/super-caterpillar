import os
import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import glob

def generate_final_report():
    dataset_base = "./dataset/"
    raw_dir = "./work/faces/raw/"
    output_dir = "/Users/adam/.gemini/antigravity/brain/16e4ea89-d4cd-4742-9e47-adf1f9e977e2/"
    
    # 1. Collect all data
    data = []
    char_folders = [d for d in os.listdir(dataset_base) if os.path.isdir(os.path.join(dataset_base, d)) and d != "unknown_clusters"]
    
    for char in char_folders:
        # Check subfolders A, B, C and also root for 'unknown' folder
        sub_paths = [os.path.join(dataset_base, char, g) for g in ['A', 'B', 'C']]
        sub_paths.append(os.path.join(dataset_base, char)) # root of the folder
        
        seen_files = set()
        
        for path in sub_paths:
            if not os.path.exists(path): continue
            
            files = glob.glob(os.path.join(path, "*.png"))
            for f in files:
                fname = os.path.basename(f)
                if fname in seen_files: continue
                seen_files.add(fname)
                
                base = os.path.splitext(fname)[0]
                json_p = os.path.join(raw_dir, f"{base}.json")
                
                grade = "Unknown"
                if "/A/" in f: grade = "A"
                elif "/B/" in f: grade = "B"
                elif "/C/" in f: grade = "C"
                
                if os.path.exists(json_p):
                    with open(json_p, 'r') as jf:
                        meta = json.load(jf)
                    
                    p, y, r = meta["pose"] if meta["pose"] else (0,0,0)
                    data.append({
                        "Character": char,
                        "Grade": grade,
                        "Pitch": p,
                        "Yaw": y,
                        "Blur": meta["blur_score"],
                        "Score": meta["det_score"]
                    })

    df = pd.DataFrame(data)
    if df.empty:
        print("No data found for report.")
        return

    # 2. Plotting
    sns.set_theme(style="whitegrid")
    
    # A. Character Distribution
    plt.figure(figsize=(10, 6))
    sns.countplot(data=df, x='Character', hue='Grade', palette='viridis')
    plt.title("Character Asset Distribution by Grade")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "stat_char_dist.png"))
    
    # B. Pose Distribution (Yaw)
    plt.figure(figsize=(10, 6))
    sns.histplot(data=df, x='Yaw', hue='Character', multiple='stack', bins=30, palette='Set2')
    plt.title("Pose Distribution (Horizontal Yaw)")
    plt.xlabel("Degrees (0 = Center)")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "stat_pose_yaw.png"))
    
    # C. Sharpness vs Confidence
    plt.figure(figsize=(10, 6))
    sns.scatterplot(data=df, x='Blur', y='Score', hue='Grade', alpha=0.5)
    plt.title("Sharpness (Blur) vs Detection Confidence")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "stat_quality_scatter.png"))

    # 3. Textual Summary (Markdown)
    report_md = os.path.join(output_dir, "FINAL_REPORT.md")
    with open(report_md, "w") as f_out:
        f_out.write("# 📊 劍來角色資產統計報告\n\n")
        f_out.write("## 1. 數據總錄\n")
        f_out.write(f"- **總圖片數**: {len(df)}\n")
        f_out.write(f"- **識別角色數**: {df['Character'].nunique()}\n\n")
        
        f_out.write("## 2. 質量等級分佈\n")
        grade_summary = df.groupby(['Character', 'Grade']).size().unstack(fill_value=0)
        f_out.write(grade_summary.to_markdown() + "\n\n")
        
        f_out.write("## 3. 平均品質指標\n")
        metrics = df.groupby('Character')[['Blur', 'Score', 'Yaw']].mean()
        f_out.write(metrics.to_markdown() + "\n\n")
        
        f_out.write("## 4. 可視化圖表\n")
        f_out.write(f"### 角色與等級分佈\n![Character Dist](file://{os.path.join(output_dir, 'stat_char_dist.png')})\n\n")
        f_out.write(f"### 姿勢角度分佈\n![Pose Dist](file://{os.path.join(output_dir, 'stat_pose_yaw.png')})\n\n")
        f_out.write(f"### 清晰度與置信度關聯\n![Quality Dist](file://{os.path.join(output_dir, 'stat_quality_scatter.png')})\n")

    print(f"--- Final report generated at {report_md}")

if __name__ == "__main__":
    generate_final_report()
