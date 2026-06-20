import sys

sys.stdout.reconfigure(encoding="utf-8")

match_file = "scratch/transcript_matches.txt"
target_cid = "77ea7cf9-fbb8-4522-81e6-9db6f72bfa32"

print(f"Listing matches for CID {target_cid}:")
count = 0
with open(match_file, "r", encoding="utf-8") as f:
    for line in f:
        if target_cid in line:
            print(line.strip())
            count += 1
print(f"Done. Found {count} lines.")
