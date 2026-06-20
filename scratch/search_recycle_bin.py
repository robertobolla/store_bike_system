import os

recycle_bin = r"C:\$Recycle.Bin"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print(f"Scanning Recycle Bin: {recycle_bin}...")
found = []

if os.path.exists(recycle_bin):
    for root, dirs, files in os.walk(recycle_bin):
        for f in files:
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as file:
                    content = file.read()
                    for kw in keywords:
                        if kw in content:
                            print(f"FOUND keyword '{kw}' in Recycle Bin file: {path} (Size: {os.path.getsize(path)} bytes)")
                            found.append((path, kw))
                            break
            except Exception:
                pass
else:
    print("Recycle Bin path does not exist or access denied.")

print(f"Recycle bin scan complete. Found {len(found)} files.")
