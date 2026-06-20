import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
targets = ["db.ts", "backup.ts", "index.css"]

print(f"Scanning all transcripts for edits to: {targets}...")
found = []

for cid in os.listdir(brain_dir):
    cid_path = os.path.join(brain_dir, cid)
    if os.path.isdir(cid_path):
        transcript_path = os.path.join(cid_path, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_no, line in enumerate(f, 1):
                        line_lower = line.lower()
                        # check if it contains any of our targets
                        for t in targets:
                            if t in line_lower and ("replace_file_content" in line_lower or "write_to_file" in line_lower):
                                try:
                                    step = json.loads(line)
                                    # Skip the current conversation's matches to keep it clean
                                    if cid == "c6e1a33f-c242-49c2-b772-bd671052c53e" and step.get("step_index", 0) > 900:
                                        continue
                                    print(f"FOUND edit to '{t}' in CID {cid} at line {line_no} (Step {step.get('step_index')})")
                                    found.append((cid, line_no, t, step))
                                except Exception:
                                    pass
            except Exception as e:
                print(f"Error reading {transcript_path}: {e}")

print(f"Scan complete. Found {len(found)} matches.")
