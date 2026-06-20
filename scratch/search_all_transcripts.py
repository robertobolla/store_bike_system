import os
import json

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx", "?checklist="]

print(f"Scanning all transcript files in {brain_dir}...")
found_matches = []

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
                                print(f"FOUND keyword '{kw}' in conversation {cid} (line {line_no})")
                                found_matches.append((cid, transcript_path, kw, line_no))
                                break
            except Exception as e:
                print(f"Error reading {transcript_path}: {e}")

print(f"Scan complete. Found {len(found_matches)} matching lines.")
