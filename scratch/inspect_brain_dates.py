import os
import time

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
print("Folder modification times in brain directory:")

conversations_around_18 = []

for d in os.listdir(brain_dir):
    path = os.path.join(brain_dir, d)
    if os.path.isdir(path):
        mtime = os.path.getmtime(path)
        mtime_str = time.ctime(mtime)
        # Check if modified between June 17 and June 19
        # Time string format: 'Thu Jun 18 11:31:14 2026'
        if "Jun 17" in mtime_str or "Jun 18" in mtime_str or "Jun 19" in mtime_str:
            print(f"MATCH: {d} - Modified: {mtime_str}")
            conversations_around_18.append((d, mtime_str))
        else:
            # Let's print all to see
            pass

print(f"Done. Found {len(conversations_around_18)} folders modified around June 18.")
