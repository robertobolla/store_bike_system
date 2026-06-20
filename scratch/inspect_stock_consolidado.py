import sys
import subprocess

sys.stdout.reconfigure(encoding="utf-8")

cmd = ["git", "diff", "11c9745", "e9f4634", "--", "src/App.tsx"]
res = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")

lines = res.stdout.splitlines()
added_lines = []

for line in lines:
    if line.startswith("+") and not line.startswith("+++"):
        if any(w in line.lower() for w in ["stock", "location", "distrib", "prodform"]):
            added_lines.append(line)

print("Stock-related lines added in e9f4634 (consolidado):")
print(f"Total: {len(added_lines)}")
for l in added_lines[:30]:
    print(l)
