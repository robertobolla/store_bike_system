import sys

sys.stdout.reconfigure(encoding="utf-8")
file_path = "scratch/clean_App_461.tsx"

with open(file_path, "r", encoding="latin-1") as f:
    lines = f.readlines()

def get_range(start_idx, end_idx):
    return "".join(lines[start_idx-1:end_idx])

out = []

out.append("### 1. Import of downloadBackupXlsx\n")
out.append("```typescript\n" + get_range(47, 47) + "```\n\n")

out.append("### 2. DELIVERY_CHECKLIST_GROUPS Definition\n")
out.append("```typescript\n" + get_range(288, 348) + "```\n\n")

out.append("### 3. InternalChecklistEditor Component\n")
out.append("```typescript\n" + get_range(445, 608) + "```\n\n")

out.append("### 4. Email template functions (sendDeliveryChecklistInviteEmail / sendDeliveryChecklistCopyEmail)\n")
out.append("```typescript\n" + get_range(609, 680) + "```\n\n")

out.append("### 5. Wizard Submission integration (create & send delivery checklist / internal checklist)\n")
out.append("```typescript\n" + get_range(4760, 4810) + "```\n\n")

out.append("### 6. Public Delivery Checklist Page (?checklist=)\n")
out.append("```typescript\n" + get_range(4995, 5175) + "```\n\n")

out.append("### 7. Excel Backup execution block (downloadBackupXlsx)\n")
out.append("```typescript\n" + get_range(5745, 5770) + "```\n\n")

with open("scratch/extracted_blocks_clean.md", "w", encoding="utf-8") as f:
    f.write("".join(out))

print("Blocks extracted to scratch/extracted_blocks_clean.md")
print("Total characters extracted:", sum(len(x) for x in out))
