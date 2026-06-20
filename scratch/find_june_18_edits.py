import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"

print("Searching transcripts for edits made on June 17 or June 18, 2026...")
found = []

for cid in os.listdir(brain_dir):
    cid_path = os.path.join(brain_dir, cid)
    if os.path.isdir(cid_path):
        transcript_path = os.path.join(cid_path, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_no, line in enumerate(f, 1):
                        if "2026-06-18" in line or "2026-06-17" in line:
                            if "replace_file_content" in line or "write_to_file" in line:
                                try:
                                    step = json.loads(line)
                                    # check created_at
                                    created_at = step.get("created_at", "")
                                    if "2026-06-17" in created_at or "2026-06-18" in created_at:
                                        if step.get("source") == "MODEL" and "tool_calls" in step:
                                            for tc in step["tool_calls"]:
                                                args = tc.get("args", {})
                                                target = args.get("TargetFile") or args.get("targetFile") or args.get("AbsolutePath") or ""
                                                print(f"CID: {cid} | Step: {step.get('step_index')} | Time: {created_at} | Tool: {tc.get('name')} | File: {target}")
                                                found.append((cid, step.get('step_index'), created_at, tc.get('name'), target))
                                except Exception:
                                    pass
            except Exception as e:
                print(f"Error reading {transcript_path}: {e}")

print(f"Search complete. Found {len(found)} file edits on June 17/18.")
