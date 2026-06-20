import os
import json

log_path = r"C:\Users\rober\.gemini\antigravity-ide\brain\c6e1a33f-c242-49c2-b772-bd671052c53e\.system_generated\logs\transcript.jsonl"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx", "?checklist="]

print(f"Scanning {log_path} for edits to App.tsx...")
with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line_no, line in enumerate(f, 1):
        try:
            step = json.loads(line)
            if step.get("source") == "MODEL" and "tool_calls" in step:
                for tc in step["tool_calls"]:
                    name = tc.get("name")
                    args = tc.get("arguments", {})
                    # Look for file write / edit tools
                    target_file = args.get("TargetFile") or args.get("targetFile") or ""
                    if "App.tsx" in target_file:
                        # check if replacement or content contains keywords
                        val_str = str(args)
                        found_kws = [kw for kw in keywords if kw in val_str]
                        if found_kws:
                            print(f"\n==============================================")
                            print(f"FOUND MATCH in Step {step.get('step_index')} (Line {line_no})")
                            print(f"Tool: {name}")
                            print(f"Matching keywords: {found_kws}")
                            print(f"Description: {args.get('Description') or args.get('description')}")
                            # Let's save the exact replacement content or args to a file for review
                            out_name = f"scratch/recovered_step_{step.get('step_index')}_{name}.json"
                            with open(out_name, "w", encoding="utf-8") as out_f:
                                json.dump(args, out_f, indent=2)
                            print(f"Saved complete arguments to {out_name}")
        except Exception as e:
            pass
print("Scan complete.")
