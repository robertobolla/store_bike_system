import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx", "?checklist="]

print(f"Scanning all transcript.jsonl files in {brain_dir}...")
found = []

for cid in os.listdir(brain_dir):
    cid_path = os.path.join(brain_dir, cid)
    if os.path.isdir(cid_path):
        transcript_path = os.path.join(cid_path, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_no, line in enumerate(f, 1):
                        for kw in keywords:
                            if kw in line:
                                # We found it! Let's parse the JSON to check if it's from MODEL or USER
                                try:
                                    step = json.loads(line)
                                    # If it's the current conversation, skip matches from our search commands to keep it clean
                                    if cid == "c6e1a33f-c242-49c2-b772-bd671052c53e" and step.get("step_index", 0) > 900:
                                        continue
                                    print(f"FOUND keyword '{kw}' in CID {cid} at line {line_no} (Step {step.get('step_index')})")
                                    found.append((cid, line_no, kw, step))
                                except Exception:
                                    pass
            except Exception as e:
                print(f"Error reading {transcript_path}: {e}")

print(f"Scan complete. Found {len(found)} matches in history transcripts.")
