import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

path = r"C:\Users\rober\.gemini\antigravity-ide\brain\77ea7cf9-fbb8-4522-81e6-9db6f72bfa32\.system_generated\logs\transcript.jsonl"
print(f"Scanning 77ea transcript for any writes/replices: {path}")

if os.path.exists(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line_no, line in enumerate(f, 1):
            if "replace_file_content" in line or "write_to_file" in line:
                try:
                    step = json.loads(line)
                    if step.get("source") == "MODEL" and "tool_calls" in step:
                        for tc in step["tool_calls"]:
                            args = tc.get("args", {})
                            target = (
                                args.get("TargetFile") or 
                                args.get("targetFile") or 
                                args.get("AbsolutePath") or 
                                ""
                            )
                            print(f"Line {line_no} (Step {step.get('step_index')}): {tc.get('name')} -> {target}")
                except Exception as e:
                    pass
else:
    print("File does not exist")
