import json
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding="utf-8")

log_path = r"C:\Users\rober\.gemini\antigravity-ide\brain\c6e1a33f-c242-49c2-b772-bd671052c53e\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if i == 17:
            obj = json.loads(line)
            print("Type:", obj.get("type"))
            print("Source:", obj.get("source"))
            # If it's view file, let's see what it showed
            if "content" in obj:
                print("Content:")
                print(obj["content"][:2000])
                if len(obj["content"]) > 2000:
                    print("...[TRUNCATED]")
            break
