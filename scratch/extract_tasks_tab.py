import sys

sys.stdout.reconfigure(encoding="utf-8")
file_path = "scratch/clean_App_461.tsx"

with open(file_path, "r", encoding="latin-1") as f:
    lines = f.readlines()

# We want to extract the rendering of the tasks tab.
# Let's inspect the lines around 13490.
# We will read 600 lines starting from line 13490.
start_line = 13490
end_line = start_line + 600

extracted = "".join(lines[start_line-1:end_line])

with open("scratch/tasks_tab_extracted.tsx", "w", encoding="utf-8") as f:
    f.write(extracted)

print("Saved scratch/tasks_tab_extracted.tsx")
