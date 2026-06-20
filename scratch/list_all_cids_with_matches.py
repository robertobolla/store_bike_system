from collections import Counter

match_file = "scratch/transcript_matches.txt"
cids = []

with open(match_file, "r", encoding="utf-8") as f:
    for line in f:
        if "|" in line:
            parts = line.split("|")
            cid = parts[0].replace("CID:", "").strip()
            cids.append(cid)

counts = Counter(cids)
print("Matching counts per Conversation ID:")
for cid, count in counts.most_common():
    print(f"  {cid}: {count} matches")
