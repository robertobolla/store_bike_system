import sys
import subprocess

sys.stdout.reconfigure(encoding="utf-8")

# Let's run git diff and search for lines added/removed in src/App.tsx
# containing "stock", "location", "distrib", or related words.
cmd = ["git", "diff", "e63021b", "6260bd9", "--", "src/App.tsx"]
res = subprocess.run(cmd, capture_output=True, text=True, errors="ignore")

lines = res.stdout.splitlines()
added_lines = []
removed_lines = []

for line in lines:
    if line.startswith("+") and not line.startswith("+++"):
        if any(w in line.lower() for w in ["stock", "location", "distrib", "prodform"]):
            added_lines.append(line)
    elif line.startswith("-") and not line.startswith("---"):
        if any(w in line.lower() for w in ["stock", "location", "distrib", "prodform"]):
            removed_lines.append(line)

print("Stock-related lines added in 6260bd9 (snapshot vs parent):")
print(f"Total: {len(added_lines)}")
for l in added_lines[:15]:
    print(l)

print("\nStock-related lines removed in 6260bd9 (snapshot vs parent):")
print(f"Total: {len(removed_lines)}")
for l in removed_lines[:15]:
    print(l)
