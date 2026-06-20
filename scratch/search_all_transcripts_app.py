import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
print(f"Scanning all transcript files in {brain_dir} for App.tsx...")

for d in os.listdir(brain_dir):
    path = os.path.join(brain_dir, d)
    if os.path.isdir(path):
        transcript_path = os.path.join(path, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(transcript_path):
            count = 0
            try:
                with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if "App.tsx" in line:
                            count += 1
                if count > 0:
                    print(f"Conversation {d}: {count} occurrences of 'App.tsx'")
            except Exception as e:
                print(f"Error reading {transcript_path}: {e}")
