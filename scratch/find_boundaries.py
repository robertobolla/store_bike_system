import sys
sys.stdout.reconfigure(encoding="utf-8")

payload_path = "scratch/recovered_db_step_461_step_payload.txt"
with open(payload_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

target = "file:///c:/roberto/webs/the_fast_sheep/src/App.tsx"
idx = content.find(target)
if idx != -1:
    print(f"Found target at index {idx}")
    print("Next 500 chars:")
    print(repr(content[idx:idx+500]))
    
    # Let's find where it might end or how long it is.
    # Usually, a very long string containing code will end before the next file path or JSON field.
    # Let's search for "file:///" after this index.
    next_file_idx = content.find("file:///", idx + len(target))
    print(f"Next file:/// at index {next_file_idx}")
    if next_file_idx != -1:
        print("Chars before next file:///:")
        print(repr(content[next_file_idx-500:next_file_idx]))
else:
    print("Target not found")
