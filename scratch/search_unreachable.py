import subprocess

objects = [
    "1005248ce63930267266760d67f4ed32e1ebaf92",
    "164704050cabf88eed107b0b32dc103049411688",
    "44a66d9cc083ee7b1b498e66cfd5d6649dc6ed9b",
    "86acbdf48843808ac7969648054365dd6d8374fe",
    "4f4604cb6f1ec25e22b12c8914c4413e9dda976f",
    "988b1a13ef1dcb5bc8af04364120fcd9eadca44a"
]

keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx", "?checklist="]

print("Searching unreachable Git objects...")
for obj in objects:
    try:
        # Show object content
        content = subprocess.check_output(["git", "cat-file", "-p", obj], stderr=subprocess.DEVNULL).decode("utf-8", errors="ignore")
        print(f"Object {obj}: length={len(content)}")
        for kw in keywords:
            if kw in content:
                print(f"  FOUND keyword '{kw}' inside {obj}!")
    except Exception as e:
        print(f"Error checking {obj}: {e}")
