import sys

sys.stdout.reconfigure(encoding="utf-8")

match_file = "scratch/transcript_matches.txt"

print("Listing all matches where App.tsx was edited with checklist/backup keywords:")
with open(match_file, "r", encoding="utf-8") as f:
    for line in f:
        if "AppEdit: True" in line:
            print(line.strip())
print("Done.")
