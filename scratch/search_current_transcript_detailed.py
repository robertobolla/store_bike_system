import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

transcript_path = r"C:\Users\rober\.gemini\antigravity-ide\brain\c6e1a33f-c242-49c2-b772-bd671052c53e\.system_generated\logs\transcript.jsonl"
print(f"Scanning current transcript: {transcript_path}")

keywords = ["checklist", "delivery", "backup", "xlsx", "excel"]

found_steps = []

if os.path.exists(transcript_path):
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for line_no, line in enumerate(f, 1):
            # Convert to lower case for search
            line_lower = line.lower()
            if "app.tsx" in line_lower and any(kw in line_lower for kw in keywords):
                try:
                    step = json.loads(line)
                    # We are only interested in MODEL tool calls or CODE_ACTION completions
                    if step.get("source") == "MODEL" and "tool_calls" in step:
                        for tc in step["tool_calls"]:
                            name = tc.get("name")
                            args = tc.get("arguments", {})
                            target = args.get("TargetFile") or args.get("targetFile") or ""
                            if "App.tsx" in target:
                                print(f"\n==========================================")
                                print(f"FOUND MATCH at Line {line_no} (Step {step.get('step_index')})")
                                print(f"Tool: {name}")
                                print(f"Description: {args.get('Description') or args.get('description')}")
                                found_steps.append((step.get("step_index"), line_no, args))
                except Exception as e:
                    pass

print(f"\nScan complete. Found {len(found_steps)} edits to App.tsx.")
