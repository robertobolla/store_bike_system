import sys
import difflib

sys.stdout.reconfigure(encoding="utf-8")

with open("src/App.tsx", "r", encoding="utf-8") as f:
    active = f.read().splitlines()

with open("scratch/App_461_copy2.tsx", "r", encoding="utf-8") as f:
    rec = f.read().splitlines()

diff = list(difflib.unified_diff(active, rec, fromfile="Active", tofile="Recovered", n=0))

# We want to print blocks that are added in Recovered (starting with + but not +++)
# Let's group consecutive additions and show them.
additions = []
current_block = []

for line in diff:
    if line.startswith('+') and not line.startswith('+++'):
        current_block.append(line[1:])
    else:
        if current_block:
            additions.append(current_block)
            current_block = []
if current_block:
    additions.append(current_block)

print(f"Total separate added blocks in Recovered: {len(additions)}")
print("\nTop 15 longest blocks added/restored in Recovered:")
# Sort by block length descending
additions.sort(key=len, reverse=True)

for i, block in enumerate(additions[:15]):
    print(f"\n--- Block {i+1} (Length: {len(block)} lines) ---")
    print("\n".join(block[:20]))
    if len(block) > 20:
        print("...")
