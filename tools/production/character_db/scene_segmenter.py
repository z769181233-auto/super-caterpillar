import os
import glob
from scenedetect import detect, ContentDetector, split_video_ffmpeg

def process_videos():
    video_dir = "./docs/_specs/jianlai/"
    output_base = "./work/clips/"
    
    # 查找所有 E21-E26 的影片
    video_files = []
    for ep in range(21, 27):
        pattern = os.path.join(video_dir, f"*E{ep}*.mp4")
        video_files.extend(glob.glob(pattern))
    
    video_files.sort()
    
    for video_path in video_files:
        # 提取集數
        ep_name = ""
        for ep in range(21, 27):
            if f"E{ep}" in video_path:
                ep_name = f"E{ep}"
                break
        
        if not ep_name:
            continue
            
        print(f"\n>>> Detecting scenes in: {os.path.basename(video_path)}")
        output_dir = os.path.join(output_base, ep_name)
        os.makedirs(output_dir, exist_ok=True)
        
        # 檢測場景
        scene_list = detect(video_path, ContentDetector())
        
        # 切分影片
        print(f"--- Splitting into {len(scene_list)} clips for {ep_name}...")
        split_video_ffmpeg(video_path, scene_list, output_dir, arg_override='-c:v libx264 -preset ultrafast -crf 22 -an')

if __name__ == "__main__":
    process_videos()
