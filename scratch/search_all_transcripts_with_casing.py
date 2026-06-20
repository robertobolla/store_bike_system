import os
import json
import sys

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
keywords = ["checklist", "excel", "backup", "InternalChecklistEditor", "DELIVERY_CHECKLIST_GROUPS", "downloadBackupXlsx"]

out_path = "scratch/transcript_matches.txt"
print(f"Scanning all transcripts for checklist/excel/backup and writing to {out_path}...")

matches = []

for cid in os.listdir(brain_dir):
    cid_path = os.path.join(brain_dir, cid)
    if os.path.isdir(cid_path):
        transcript_path = os.path.join(cid_path, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_no, line in enumerate(f, 1):
                        line_lower = line.lower()
                        # check if it contains any keyword
                        found_kws = [kw for kw in keywords if kw.lower() in line_lower]
                        if found_kws:
                            # Let's inspect if it contains edits to App.tsx
                            has_app_edit = "app.tsx" in line_lower and ("replace_file_content" in line_lower or "write_to_file" in line_lower)
                            matches.append({
                                "cid": cid,
                                "line_no": line_no,
                                "keywords": found_kws,
                                "has_app_edit": has_app_edit,
                                "snippet": line[:150].strip()
                            })
            except Exception as e:
                matches.append({"cid": cid, "error": str(e)})

# Write results
with open(out_path, "w", encoding="utf-8") as out:
    out.write(f"Found {len(matches)} total matching lines in history.\n\n")
    for m in matches:
        if "error" in m:
            out.write(f"CID: {m['cid']} - Error: {m['error']}\n")
        else:
            out.write(f"CID: {m['cid']} | Line: {m['line_no']} | KWs: {m['keywords']} | AppEdit: {m['has_app_edit']} | Snippet: {m['snippet']}\n")

print(f"Scan complete. Results written to {out_path}.")
