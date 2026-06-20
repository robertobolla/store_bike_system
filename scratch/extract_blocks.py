import sys
sys.stdout.reconfigure(encoding="utf-8")

payload_path = "scratch/recovered_db_step_461_step_payload.txt"
output_path = "scratch/extracted_code_utf8.txt"

with open(payload_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

out_f = open(output_path, "w", encoding="utf-8")

def extract_block(target, window_size=10000):
    idx = content.find(target)
    if idx == -1:
        out_f.write(f"--- {target} NOT FOUND ---\n")
        return
    out_f.write(f"\n==========================================\n")
    out_f.write(f"FOUND keyword '{target}' at index {idx}\n")
    start = max(0, idx - window_size)
    end = min(len(content), idx + window_size)
    
    sub = content[start:end]
    out_f.write(f"--- Context (window {window_size}) ---\n")
    out_f.write(sub)
    out_f.write("\n--- End Context ---\n")

# Let's search for the constants and components
extract_block("DELIVERY_CHECKLIST_GROUPS", 4000)
extract_block("InternalChecklistEditor", 12000)
extract_block("downloadBackupXlsx", 4000)
out_f.close()
print("Done writing to extracted_code_utf8.txt")
