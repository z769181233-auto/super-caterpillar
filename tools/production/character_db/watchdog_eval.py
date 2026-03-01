import os
import time
import subprocess
import shutil

def run_eval(ckpt_path, step):
    print(f"[{time.ctime()}] Found checkpoint for step {step}. Starting Evaluation...")
    prompts_file = "dataset/chenpingan_lora/sample_prompts_v7_locked.txt"
    output_grid = f"output/evidence/v7_eval_pack/grid_step{step:04d}.png"
    artifact_path = f"/Users/adam/.gemini/antigravity/brain/00ab576b-730e-49a9-af0a-84c7cbcd4b4d/grid_step{step:04d}.png"
    
    os.makedirs(os.path.dirname(output_grid), exist_ok=True)
    
    cmd = [
        "python3", "tools/production/character_db/eval_lora.py",
        "--lora_path", ckpt_path,
        "--prompts_file", prompts_file,
        "--output_path", output_grid,
        "--seed", "1234"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        shutil.copy(output_grid, artifact_path)
        print(f"[{time.ctime()}] Evaluation Grid for Step {step} finalized and copied to artifacts.")
        
        # Update EVIDENCE_INDEX.md
        index_path = "/Users/adam/.gemini/antigravity/brain/00ab576b-730e-49a9-af0a-84c7cbcd4b4d/EVIDENCE_INDEX.md"
        with open(index_path, "a") as f:
            f.write(f"| {step} | [grid_step{step:04d}.png](file://{artifact_path}) | Character Consistency Audit |\n")
            
    except Exception as e:
        print(f"[{time.ctime()}] Evaluation failed for step {step}: {e}")

def watchdog():
    lora_dir = "output/lora_chenpingan"
    processed_steps = set()
    
    print(f"[{time.ctime()}] Automated Evaluation Watchdog STARTED.")
    
    while True:
        if os.path.exists(lora_dir):
            files = [f for f in os.listdir(lora_dir) if f.startswith("pytorch_lora_weights_step_") and f.endswith(".bin")]
            for f in files:
                try:
                    step = int(f.split("_step_")[1].split(".")[0])
                    if step not in processed_steps:
                        ckpt_path = os.path.join(lora_dir, f)
                        run_eval(ckpt_path, step)
                        processed_steps.add(step)
                except Exception:
                    continue
        
        time.sleep(60) # Poll every minute

if __name__ == "__main__":
    watchdog()
