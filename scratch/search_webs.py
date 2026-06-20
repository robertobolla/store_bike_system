import os

search_dir = r"c:\roberto\webs"
target = "DELIVERY_CHECKLIST_GROUPS"

print(f"Searching for '{target}' in {search_dir}...")
found = []

for root, dirs, files in os.walk(search_dir):
    # Skip node_modules and .git
    if "node_modules" in root or ".git" in root or ".next" in root:
        continue
    for f in files:
        if f.endswith((".ts", ".tsx", ".js", ".jsx", ".sql", ".txt", ".json", ".md")):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as file:
                    if target in file.read():
                        print(f"FOUND in: {path}")
                        found.append(path)
            except Exception:
                pass

print(f"Search done. Found {len(found)} files.")
