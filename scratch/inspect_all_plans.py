import os
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
folders = [
    "0f9a51e4-466e-48d9-8e3a-0c09d2b9d1c2",
    "187fd7ab-007b-4d30-b550-a35dec4e3650",
    "45cd0967-aa83-442b-94b5-20e07e9fb661",
    "6ca2aadf-5586-43d0-babb-162b50bf4e8a",
    "72b78c37-02a4-4518-ab8f-d62683c00502",
    "77ea7cf9-fbb8-4522-81e6-9db6f72bfa32",
    "99cfc5f4-dc32-431a-9260-0a9f6269e566",
    "d3913b27-b06f-4b38-8b19-5066c0d02512"
]

for folder in folders:
    path = os.path.join(brain_dir, folder)
    print(f"\n==================================================")
    print(f"FOLDER: {folder}")
    plan_path = os.path.join(path, "implementation_plan.md")
    walk_path = os.path.join(path, "walkthrough.md")
    
    # Just print the first 300 characters of each file to recognize
    if os.path.exists(plan_path):
        try:
            with open(plan_path, "r", encoding="utf-8") as f:
                head = f.read(400).strip()
                print(f"Plan Head:\n{head}\n...")
        except Exception as e:
            print("Error reading plan:", e)
            
    if os.path.exists(walk_path):
        try:
            with open(walk_path, "r", encoding="utf-8") as f:
                head = f.read(400).strip()
                print(f"Walkthrough Head:\n{head}\n...")
        except Exception as e:
            print("Error reading walkthrough:", e)
            
    # Also check if transcript exists and search it for App.tsx edits
    transcript_path = os.path.join(path, ".system_generated", "logs", "transcript.jsonl")
    if os.path.exists(transcript_path):
        print("Transcript exists. Searching for App.tsx writes...")
        try:
            with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
                count = 0
                for line in f:
                    if "App.tsx" in line and ("replace_file_content" in line or "write_to_file" in line):
                        count += 1
                print(f"  App.tsx edits in transcript: {count}")
        except Exception:
            pass
