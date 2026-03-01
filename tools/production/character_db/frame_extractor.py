import os
import subprocess
import glob
import time
from concurrent.futures import ThreadPoolExecutor

def extract_iframes(clip_path, frame_output_dir):
    try:
        os.makedirs(frame_output_dir, exist_ok=True)
        # 提取 I 幀
        cmd = [
            'ffmpeg', '-y', '-i', clip_path,
            '-vf', "select='eq(pict_type,I)'",
            '-vsync', 'vfr',
            os.path.join(frame_output_dir, '%05d.png')
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        print(f"Error processing {clip_path}: {e}")
        return False

def run_extraction_worker():
    clips_base = "./work/clips/"
    frames_base = "./work/frames/"
    
    executor = ThreadPoolExecutor(max_workers=8)
    processed_clips = set()

    print("[Extractor-Worker] Monitoring work/clips/ for new segments...")

    while True:
        # 獲取所有 mp4
        all_clips = glob.glob(os.path.join(clips_base, "**/*.mp4"), recursive=True)
        
        new_clips = [c for c in all_clips if c not in processed_clips]
        
        if new_clips:
            print(f"--- Found {len(new_clips)} new clips. Extracting I-frames...")
            for clip in new_clips:
                ep = os.path.basename(os.path.dirname(clip))
                clip_label = os.path.splitext(os.path.basename(clip))[0]
                frame_out = os.path.join(frames_base, ep, clip_label)
                
                # Check if already has frames
                if os.path.exists(frame_out) and os.listdir(frame_out):
                    processed_clips.add(clip)
                    continue

                executor.submit(extract_iframes, clip, frame_out)
                processed_clips.add(clip)
        
        # Check if scene_segmenter is likely still running
        # (Very naive check: if total clips still increasing, sleep shorter)
        time.sleep(10)

if __name__ == "__main__":
    run_extraction_worker()
