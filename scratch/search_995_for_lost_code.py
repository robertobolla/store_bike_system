import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

path = r"C:\Users\rober\.gemini\antigravity-ide\brain\99569607-9662-4ff1-a0b1-76a6902b62e6\.system_generated\logs\transcript.jsonl"
print(f"Reading target transcript: {path}")

keywords = ["checklist", "excel", "backup", "InternalChecklistEditor", "DELIVERY_CHECKLIST_GROUPS", "downloadBackupXlsx"]

if os.path.exists(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line_no, line in enumerate(f, 1):
            line_lower = line.lower()
            found_kws = [kw for kw in keywords if kw.lower() in line_lower]
            if found_kws:
                print(f"Line {line_no} matches: {found_kws}")
                try:
                    step = json.loads(line)
                    print(f"  Step: {step.get('step_index')}, Source: {step.get('source')}, Type: {step.get('type')}")
                    if "tool_calls" in step:
                        for tc in step["tool_calls"]:
                            print(f"    Tool: {tc.get('name')}")
                            # If it modified App.tsx, print some info
                            args = tc.get("args", {})
                            tf = args.get("TargetFile") or args.get("targetFile") or ""
                            if "App.tsx" in tf:
                                print(f"      Modified App.tsx! Desc: {args.get('Description')}")
                except Exception as e:
                    print("  Error parsing JSON:", e)
else:
    print("File does not exist")
