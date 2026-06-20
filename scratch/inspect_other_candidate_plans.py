import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
folders = [
    "0bb4cb60-df93-4d51-a056-daab26e2ed89",
    "3f6999a9-ee21-401c-9d17-d5098889ec7b",
    "762d62b6-e704-4d24-b2ef-16d2c07db1cb",
    "7a5cdfac-8c2b-42de-8111-5a8505854572"
]

for folder in folders:
    path = os.path.join(brain_dir, folder)
    print(f"\n==================================================")
    print(f"FOLDER: {folder}")
    plan_path = os.path.join(path, "implementation_plan.md")
    walk_path = os.path.join(path, "walkthrough.md")
    
    if os.path.exists(plan_path):
        try:
            with open(plan_path, "r", encoding="utf-8") as f:
                print(f"--- implementation_plan.md ---\n{f.read()}")
        except Exception as e:
            print("Error reading plan:", e)
            
    if os.path.exists(walk_path):
        try:
            with open(walk_path, "r", encoding="utf-8") as f:
                print(f"--- walkthrough.md ---\n{f.read()}")
        except Exception as e:
            print("Error reading walkthrough:", e)
