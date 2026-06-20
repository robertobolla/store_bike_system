import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
keywords = ["checklist", "excel", "backup", "InternalChecklistEditor", "DELIVERY_CHECKLIST_GROUPS"]

print(f"Scanning all markdown files in {brain_dir}...")
found = []

for root, dirs, files in os.walk(brain_dir):
    for f in files:
        if f.endswith(".md"):
            path = os.path.join(root, f)
            try:
                with open(path, "r", encoding="utf-8") as file:
                    content = file.read().lower()
                    for kw in keywords:
                        if kw.lower() in content:
                            print(f"FOUND keyword '{kw}' in markdown: {path} (Size: {os.path.getsize(path)} bytes)")
                            found.append((path, kw))
                            break
            except Exception:
                pass

print(f"Scan complete. Found {len(found)} plan/markdown files.")
