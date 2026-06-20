import sys

sys.stdout.reconfigure(encoding="utf-8")

with open("src/App.tsx", "r", encoding="utf-8") as f:
    active_lines = [line.strip() for line in f if line.strip()]

with open("scratch/App_461_copy2.tsx", "r", encoding="utf-8") as f:
    rec_lines = [line.strip() for line in f if line.strip()]

active_set = set(active_lines)
rec_set = set(rec_lines)

# Show some lines in active file that are not in the recovered file and mention "stock" or "location" or "quantity"
print("Lines in ACTIVE that are NOT in RECOVERED:")
count = 0
for line in active_lines:
    if line not in rec_set:
        if any(w in line.lower() for w in ["stock", "location", "qty", "quantity", "generic", "distrib"]):
            print(f"- {line}")
            count += 1
            if count > 30:
                print("... truncated ...")
                break
if count == 0:
    print("None found!")

print("\nLines in RECOVERED that are NOT in ACTIVE:")
count = 0
for line in rec_lines:
    if line not in active_set:
        if any(w in line.lower() for w in ["stock", "location", "qty", "quantity", "generic", "distrib"]):
            print(f"- {line}")
            count += 1
            if count > 30:
                print("... truncated ...")
                break
if count == 0:
    print("None found!")
