import os
import time

brain_dir = r"C:\Users\rober\.gemini\antigravity-ide\brain"
target_cids = [
    "c0aa78b2-5173-4b3d-b0d6-04a32dfa1a51",
    "7a5cdfac-8c2b-42de-8111-5a8505854572",
    "d68a1df4-3934-44a0-8702-bc97bbfb0be2",
    "b08d697d-98b3-4a27-9672-28b43cad75cd",
    "e26fbe58-7cda-4d84-9b7c-eac84dbcea46",
    "fe87140f-3746-415a-9716-01ad41dc08f5",
    "eefc4a59-acb5-4494-b348-29dc7c56d812"
]

print("Modification times for candidate conversations:")
for cid in target_cids:
    path = os.path.join(brain_dir, cid)
    if os.path.exists(path):
        mtime = os.path.getmtime(path)
        print(f"{cid}: {time.ctime(mtime)}")
    else:
        print(f"{cid} does not exist")
