import os

base = os.path.join(os.environ.get("APPDATA", ""), "Antigravity IDE", "User", "History")
keywords = ["checklist", "backup", "xlsx"]

print(f"Scanning all history files in {base}...")
found = []

if os.path.exists(base):
    for root, dirs, files in os.walk(base):
        for f in files:
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as file:
                    content = file.read().lower()
                    matched_kws = [kw for kw in keywords if kw in content]
                    if matched_kws:
                        print(f"FOUND matches {matched_kws} in: {path} (Size: {os.path.getsize(path)} bytes)")
                        found.append((path, matched_kws))
            except Exception:
                pass
else:
    print("History folder does not exist")

print(f"History scan complete. Found {len(found)} files.")
