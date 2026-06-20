import os
import subprocess

git_obj_dir = r"c:\roberto\webs\the_fast_sheep\.git\objects"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print(f"Scanning all Git objects in {git_obj_dir}...")
found = []

# Collect all SHAs
shas = []
for root, dirs, files in os.walk(git_obj_dir):
    # The folder name is the first 2 characters of the SHA
    # The file name is the remaining 38 characters
    folder = os.path.basename(root)
    if len(folder) == 2:
        for f in files:
            if len(f) == 38:
                sha = folder + f
                shas.append(sha)

print(f"Found {len(shas)} potential Git object SHAs. Searching contents...")

for idx, sha in enumerate(shas, 1):
    try:
        # Check object type
        obj_type = subprocess.check_output(["git", "cat-file", "-t", sha], stderr=subprocess.DEVNULL).decode("utf-8").strip()
        if obj_type == "blob":
            content = subprocess.check_output(["git", "cat-file", "-p", sha], stderr=subprocess.DEVNULL).decode("utf-8", errors="ignore")
            for kw in keywords:
                if kw in content:
                    print(f"FOUND keyword '{kw}' in blob {sha} (Size: {len(content)} chars)")
                    found.append((sha, kw, len(content)))
                    # Let's save it to a scratch file
                    out_path = f"scratch/recovered_blob_{sha[:8]}_{kw}.tsx"
                    with open(out_path, "w", encoding="utf-8") as out_f:
                        out_f.write(content)
                    print(f"  Saved content to {out_path}")
                    break
    except Exception as e:
        pass

print(f"Scan complete. Found matches in {len(found)} blobs.")
