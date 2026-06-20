import os
import time

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
print("Scanning for large transcript files...")

large_files = []
for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f == "transcript.jsonl":
            path = os.path.join(root, f)
            size = os.path.getsize(path)
            if size > 100000: # > 100 KB
                mtime = os.path.getmtime(path)
                mtime_str = time.ctime(mtime)
                cid = os.path.basename(os.path.dirname(os.path.dirname(root)))
                large_files.append((cid, size, mtime_str, path))

# Sort by size descending
large_files.sort(key=lambda x: x[1], reverse=True)

for cid, size, mtime, path in large_files:
    print(f"CID: {cid} - Size: {size} bytes - Modified: {mtime}")

print(f"Done. Found {len(large_files)} large transcript files.")
