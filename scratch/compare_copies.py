import re
import difflib

# Let's check unique differences or features
with open("scratch/App_461_copy1.tsx", "r", encoding="utf-8") as f:
    c1 = f.read()

with open("scratch/App_461_copy2.tsx", "r", encoding="utf-8") as f:
    c2 = f.read()

# Let's count some keywords
keywords = [
    "vat_applied", "vatApplied", "BAT", "tax", "candado", "lock", "checklist", "Excel", "backup",
    "delivery_checklist", "deliveryChecklist", "DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor"
]

print("Keyword counts in Copy 1 vs Copy 2:")
for kw in keywords:
    print(f"'{kw}': Copy1={c1.count(kw)}, Copy2={c2.count(kw)}")

# Let's find unique lines or lines count
print("\nLines count: Copy1 =", len(c1.splitlines()), ", Copy2 =", len(c2.splitlines()))
