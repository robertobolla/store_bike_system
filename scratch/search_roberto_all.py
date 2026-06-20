import os

directories = [
    r"C:\roberto",
    r"C:\Users\rober\Downloads"
]
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print("Searching directories...")
found = []

for base_dir in directories:
    if not os.path.exists(base_dir):
        print(f"Directory does not exist: {base_dir}")
        continue
    print(f"Scanning: {base_dir}...")
    for root, dirs, files in os.walk(base_dir):
        # Skip node_modules, .git, next, cache, etc.
        if any(x in root for x in ["node_modules", ".git", ".next", "Cache", "cache", "GPUCache"]):
            continue
        for f in files:
            if f.endswith((".ts", ".tsx", ".js", ".jsx", ".sql", ".txt", ".json", ".md")):
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

print(f"Search complete. Found {len(found)} files.")
