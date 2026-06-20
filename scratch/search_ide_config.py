import os

base_dir = os.path.join(os.environ.get("APPDATA", ""), "Antigravity IDE")
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print(f"Scanning all files in {base_dir}...")
found = []

for root, dirs, files in os.walk(base_dir):
    for f in files:
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

print(f"Search complete. Found {len(found)} files in AppData/Roaming/Antigravity IDE.")
