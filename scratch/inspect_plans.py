import os
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding="utf-8")

folder = r"C:\Users\rober\.gemini\antigravity-ide\brain\45cd0967-aa83-442b-94b5-20e07e9fb661"

files_to_print = ["implementation_plan.md", "task.md", "walkthrough.md"]

print(f"=== Reading artifacts in {folder} ===")
for fn in files_to_print:
    path = os.path.join(folder, fn)
    if os.path.exists(path):
        print(f"\n--- {fn} ---")
        try:
            with open(path, "r", encoding="utf-8") as f:
                print(f.read())
        except Exception as e:
            print("Error reading:", e)
    else:
        print(f"{fn} does not exist in this folder.")
