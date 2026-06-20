import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

transcript_path = r"C:\Users\rober\.gemini\antigravity-ide\brain\c6e1a33f-c242-49c2-b772-bd671052c53e\.system_generated\logs\transcript.jsonl"
print(f"Scanning all edits to App.tsx in: {transcript_path}")

found = []

if os.path.exists(transcript_path):
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for line_no, line in enumerate(f, 1):
            if "app.tsx" in line.lower() and ("replace_file_content" in line or "write_to_file" in line):
                try:
                    step = json.loads(line)
                    if step.get("source") == "MODEL" and "tool_calls" in step:
                        for tc in step["tool_calls"]:
                            name = tc.get("name")
                            args = tc.get("args", {})
                            target = (
                                args.get("TargetFile") or 
                                args.get("targetFile") or 
                                args.get("AbsolutePath") or 
                                args.get("TargetFilePath") or 
                                ""
                            )
                            target = target.strip('"').replace("\\\\", "\\")
                            if "app.tsx" in target.lower():
                                desc = args.get("Description") or args.get("description") or ""
                                print(f"Step {step.get('step_index')} (Line {line_no}): Tool {name} - Desc: {desc[:100]}")
                                found.append(step.get("step_index"))
                except Exception:
                    pass

print(f"Total edits to App.tsx found: {len(found)}")
