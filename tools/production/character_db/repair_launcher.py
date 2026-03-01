import subprocess
import os
import sys

def launch():
    # P0 Audit (CPU)
    p0_cmd = [
        "python3", "tools/production/character_db/eval_lora.py",
        "--prompts_file", "dataset/chenpingan_lora/sample_prompts_v7_locked.txt",
        "--output_path", "docs/_evidence/jianlai_lora_fix/P0_base_vs_lora/base_grid.png",
        "--seed", "1234",
        "--device", "cpu"
    ]
    with open("output/p0_audit_cpu.log", "w") as f:
        subprocess.Popen(p0_cmd, stdout=f, stderr=f, start_new_session=True)

    # P2-A Training (MPS)
    p2_cmd = ["bash", "train_lora_style.sh"]
    with open("output/train_style_wrapper.log", "w") as f:
        subprocess.Popen(p2_cmd, stdout=f, stderr=f, start_new_session=True)

    print("Persistent repair tasks launched.")

if __name__ == "__main__":
    launch()
