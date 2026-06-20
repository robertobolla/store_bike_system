import os
import json

base = os.path.join(os.environ.get("APPDATA", ""), "Antigravity", "User", "History")
print(f"Reading history folder: {base}")
if os.path.exists(base):
    for sd in os.listdir(base):
        sd_path = os.path.join(base, sd)
        if os.path.isdir(sd_path):
            entry_file = os.path.join(sd_path, "entries.json")
            if os.path.exists(entry_file):
                try:
                    with open(entry_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        resource = data.get("resource", "")
                        if "App.tsx" in resource or "the_fast_sheep" in resource:
                            print(f"{sd}: {resource}")
                except Exception as e:
                    print(f"Error parsing {entry_file}: {e}")
else:
    print("History folder does not exist")
