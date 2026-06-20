import sys

sys.stdout.reconfigure(encoding="utf-8")

file_path = "scratch/clean_App_461.tsx"
with open(file_path, "r", encoding="latin-1") as f:
    lines = f.readlines()

copy1 = "".join(lines[:22710])
copy2 = "".join(lines[22710:])

with open("scratch/App_461_copy1.tsx", "w", encoding="utf-8") as f:
    f.write(copy1)

with open("scratch/App_461_copy2.tsx", "w", encoding="utf-8") as f:
    f.write(copy2)

print("Saved scratch/App_461_copy1.tsx and scratch/App_461_copy2.tsx")
print("Copy 1 size:", len(copy1), "lines:", len(lines[:22710]))
print("Copy 2 size:", len(copy2), "lines:", len(lines[22710:]))
