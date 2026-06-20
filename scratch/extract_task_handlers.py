import sys

sys.stdout.reconfigure(encoding="utf-8")
file_path = "scratch/clean_App_461.tsx"

with open(file_path, "r", encoding="latin-1") as f:
    lines = f.readlines()

# Extract task handlers range
start_line = 5410
end_line = 5580

extracted = "".join(lines[start_line-1:end_line])

with open("scratch/task_handlers_extracted.tsx", "w", encoding="utf-8") as f:
    f.write(extracted)

print("Saved scratch/task_handlers_extracted.tsx")
