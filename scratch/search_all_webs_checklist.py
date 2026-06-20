import os

webs_dir = r"c:\roberto\webs"
target = "checklist"

print(f"Searching for '{target}' case-insensitively in {webs_dir}...")
found = []

for root, dirs, files in os.walk(webs_dir):
    if "node_modules" in root or ".git" in root or ".next" in root:
        continue
    for f in files:
        if f.endswith((".ts", ".tsx", ".js", ".jsx", ".sql", ".txt", ".json", ".md")):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as file:
                    content = file.read().lower()
                    if target in content:
                        print(f"FOUND: {path}")
                        found.append(path)
            except Exception:
                pass

print(f"Search complete. Found {len(found)} files.")
