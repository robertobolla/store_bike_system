import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

transcript_path = r"C:\Users\rober\.gemini\antigravity-ide\brain\c6e1a33f-c242-49c2-b772-bd671052c53e\.system_generated\logs\transcript.jsonl"
print(f"Debugging transcript lines: {transcript_path}")

count = 0
with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_no, line in enumerate(f, 1):
        if "app.tsx" in line.lower():
            count += 1
            print(f"\n--- MATCH {count} (Line {line_no}) ---")
            try:
                step = json.loads(line)
                print(f"Source: {step.get('source')}, Type: {step.get('type')}")
                if "tool_calls" in step:
                    for tc in step["tool_calls"]:
                        print(f"  Tool: {tc.get('name')}")
                        print(f"  Args keys: {list(tc.get('arguments', {}).keys())}")
                        # Print some sample text if there's arguments
                        for k, v in tc.get("arguments", {}).items():
                            if isinstance(v, str):
                                print(f"    Arg {k}: {v[:200]}...")
            except Exception as e:
                print("Error:", e)
            if count >= 10:
                break
