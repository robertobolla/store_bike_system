import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

folder = r"C:\Users\rober\.gemini\antigravity-ide\brain\99569607-9662-4ff1-a0b1-76a6902b62e6"
files_to_print = ["implementation_plan.md", "walkthrough.md"]

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
