import time
import os
import subprocess

def monitor_and_launch():
    style_log = "output/train_style_v1.log"
    id_script = "./train_lora_identity.sh"
    target_steps = 3000
    
    print(f"Monitoring {style_log} for Step {target_steps}...")
    
    launched = False
    while not launched:
        if os.path.exists(style_log):
            with open(style_log, "r") as f:
                content = f.read()
                # Check for either the final step log or the completion message
                if f"Step {target_steps}" in content or "[Finished]" in content:
                    print(f"Style training reached goal. Launching Identity training (P2-B)...")
                    try:
                        # Launch the shell script which handles its own nohup
                        subprocess.run(["bash", id_script], check=True)
                        launched = True
                    except Exception as e:
                        print(f"Failed to launch P2-B: {e}")
                        break
        
        if not launched:
            time.sleep(60) # Check every minute

if __name__ == "__main__":
    monitor_and_launch()
