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
            line_lower = line.lower()
            if "app.tsx" in line_lower and any(kw in line_lower for kw in keywords):
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
                            # strip any extra quotes
                            target = target.strip('"').replace("\\\\", "\\")
                            if "App.tsx" in target or "app.tsx" in target.lower():
                                print(f"\n==========================================")
                                print(f"FOUND MATCH at Line {line_no} (Step {step.get('step_index')})")
                                print(f"Tool: {name}")
                                desc = args.get("Description") or args.get("description") or ""
                                print(f"Description: {desc}")
                                found_steps.append((step.get("step_index"), line_no, args))
                                
                                # Let's save the args to a file so we can view the replacement chunks
                                out_name = f"scratch/recovered_arg_step_{step.get('step_index')}_{name}.json"
                                with open(out_name, "w", encoding="utf-8") as out_f:
                                    json.dump(args, out_f, indent=2)
                                print(f"Saved args to {out_name}")
                except Exception as e:
                    print("Error:", e)

print(f"\nScan complete. Found {len(found_steps)} edits to App.tsx.")
