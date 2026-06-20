import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

path = r"C:\Users\rober\.gemini\antigravity-ide\brain\6ca2aadf-5586-43d0-babb-162b50bf4e8a\.system_generated\logs\transcript.jsonl"
if os.path.exists(path):
    size = os.path.getsize(path)
    print(f"File size: {size} bytes")
    if size > 0:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            print("Content:")
            print(f.read())
else:
    print("File does not exist")
