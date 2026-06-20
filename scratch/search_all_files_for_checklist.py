import os

ide_dir = r"C:\Users\rober\.gemini\antigravity-ide"
exclude_cid = "c6e1a33f-c242-49c2-b772-bd671052c53e"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print(f"Scanning all files in {ide_dir} excluding current conversation...")
found = []

for root, dirs, files in os.walk(ide_dir):
    if exclude_cid in root:
        continue
    for f in files:
        if exclude_cid in f:
            continue
        path = os.path.join(root, f)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as file:
                content = file.read()
                for kw in keywords:
                    if kw in content:
                        print(f"FOUND keyword '{kw}' in: {path} (Size: {os.path.getsize(path)} bytes)")
                        found.append((path, kw))
                        break
        except Exception:
            pass

print(f"Scan complete. Found {len(found)} files.")
