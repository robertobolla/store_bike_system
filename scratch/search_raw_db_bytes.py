import os

db_dir = r"C:\Users\rober\.gemini\antigravity-ide\conversations"
keywords = [b"DELIVERY_CHECKLIST_GROUPS", b"InternalChecklistEditor", b"downloadBackupXlsx"]

print(f"Scanning raw bytes of all DBs in {db_dir}...")
found = []

for f in os.listdir(db_dir):
    if f.endswith(".db"):
        path = os.path.join(db_dir, f)
        try:
            with open(path, "rb") as file:
                content = file.read()
                for kw in keywords:
                    if kw in content:
                        print(f"FOUND keyword {kw} in raw DB bytes: {f} (Size: {os.path.getsize(path)} bytes)")
                        found.append((f, kw))
                        break
        except Exception as e:
            print(f"Error reading {f}: {e}")

print(f"Scan complete. Found {len(found)} matching databases.")
