import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

transcript_path = r"C:\Users\rober\.gemini\antigravity-ide\brain\c6e1a33f-c242-49c2-b772-bd671052c53e\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for i, line in enumerate(f, 1):
        if i == 32:
            obj = json.loads(line)
            print(json.dumps(obj, indent=2))
            break
