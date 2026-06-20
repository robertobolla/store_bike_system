import sys

sys.stdout.reconfigure(encoding="utf-8")
file_path = "scratch/clean_App_461.tsx"

with open(file_path, "r", encoding="latin-1") as f:
    lines = f.readlines()

print("Total lines:", len(lines))

def find_kw(kw):
    print(f"\nMatches for '{kw}':")
    for i, line in enumerate(lines):
        if kw in line:
            print(f"Line {i+1}: {line.strip()[:100]}")

find_kw("DELIVERY_CHECKLIST_GROUPS")
find_kw("InternalChecklistEditor")
find_kw("sendDeliveryChecklistInviteEmail")
find_kw("downloadBackupXlsx")
find_kw("?checklist=")
