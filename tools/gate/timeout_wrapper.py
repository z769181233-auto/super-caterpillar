import subprocess, sys, time, os, signal

if len(sys.argv) < 2:
    print("Usage: python3 wrapper.py <log_path>")
    sys.exit(1)

log_path = sys.argv[1]
cmd = ["bash", "tools/gate/merge_guard.sh"]

timeout_sec = 60 * 20  # 20分钟上限
t0 = time.time()

with open(log_path, "w", encoding="utf-8") as f:
    f.write("CMD=" + " ".join(cmd) + "\n")
    f.write("START_TS=" + time.strftime("%Y%m%d_%H%M%S") + "\n")
    f.flush()

    p = subprocess.Popen(cmd, stdout=f, stderr=subprocess.STDOUT, preexec_fn=os.setsid)
    while True:
        rc = p.poll()
        if rc is not None:
            f.write(f"\nEXIT_CODE={rc}\n")
            f.write("END_TS=" + time.strftime("%Y%m%d_%H%M%S") + "\n")
            f.flush()
            sys.exit(rc)
        if time.time() - t0 > timeout_sec:
            f.write("\n[FATAL] TIMEOUT. Killing process group...\n")
            f.flush()
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGKILL)
            except Exception as e:
                f.write(f"[WARN] killpg failed: {e}\n")
            f.write("EXIT_CODE=124\n")
            f.write("END_TS=" + time.strftime("%Y%m%d_%H%M%S") + "\n")
            f.flush()
            sys.exit(124)
        time.sleep(1)
