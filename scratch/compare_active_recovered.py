import sys

sys.stdout.reconfigure(encoding="utf-8")

with open("src/App.tsx", "r", encoding="utf-8") as f:
    active = f.read()

with open("scratch/App_461_copy2.tsx", "r", encoding="utf-8") as f:
    recovered = f.read()

print("Active size:", len(active))
print("Recovered size:", len(recovered))

# Let's count some stock-related strings
stock_kws = ["stock", "location", "distribution", "generic", "prodFormQuantity", "locationsList"]
for kw in stock_kws:
    print(f"Keyword '{kw}': Active={active.count(kw)}, Recovered={recovered.count(kw)}")

# Let's write a script to check if there are functions in Active that are not in Recovered
import re
active_funcs = set(re.findall(r'const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>', active))
recovered_funcs = set(re.findall(r'const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>', recovered))

print("\nFunctions in Active but not in Recovered:")
print(active_funcs - recovered_funcs)

print("\nFunctions in Recovered but not in Active:")
print(recovered_funcs - active_funcs)
