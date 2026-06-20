import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

file_old = "scratch/clean_App_461.tsx"
file_new = "src/App.tsx"

def analyze_file(path, label):
    with open(path, "r", encoding="latin-1") as f:
        content = f.read()
    
    # Let's find state variables
    states = re.findall(r'const\s+\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState', content)
    
    # Let's find currentTab checks
    tabs = re.findall(r"currentTab\s*===\s*'([^']+)'", content)
    tabs += re.findall(r'currentTab\s*===\s*"([^"]+)"', content)
    
    # Let's find function declarations
    functions = re.findall(r'function\s+(\w+)\s*\(', content)
    functions += re.findall(r'const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>', content)
    
    print(f"\n--- Analysis for {label} ({path}) ---")
    print("Total characters:", len(content))
    print("Unique state variables count:", len(set(states)))
    print("Unique tabs found:", set(tabs))
    print("Some functions/components:", list(set(functions))[:20])

analyze_file(file_old, "Recovered Version (461)")
analyze_file(file_new, "Current Version in Workspace")
