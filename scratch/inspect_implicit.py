import os

implicit_dir = r"C:\Users\rober\.gemini\antigravity-ide\implicit"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print(f"Scanning files in {implicit_dir}...")
found = []

if os.path.exists(implicit_dir):
    for root, dirs, files in os.walk(implicit_dir):
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
else:
    print("Implicit folder does not exist")

print(f"Implicit scan complete. Found {len(found)} files.")
