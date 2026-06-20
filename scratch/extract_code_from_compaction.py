import sys

sys.stdout.reconfigure(encoding="utf-8")

payload_path = "scratch/recovered_db_step_461_step_payload.txt"
print(f"Reading recovered payload file: {payload_path}")

keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx", "?checklist="]

with open(payload_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()
    print("Total characters in payload:", len(content))
    
    # Let's search for keywords and extract a larger context around them!
    for kw in keywords:
        idx = content.find(kw)
        if idx != -1:
            print(f"\n==========================================")
            print(f"FOUND keyword '{kw}' at index {idx}")
            # Extract 2000 chars before and 2000 chars after
            start = max(0, idx - 2500)
            end = min(len(content), idx + 2500)
            print("--- Context ---")
            print(content[start:end])
            print("--- End Context ---")
        else:
            print(f"Keyword '{kw}' not found in file (which is weird as SQLite matched it)")
