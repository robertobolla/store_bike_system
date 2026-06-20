import os

src_dir = r"c:\roberto\webs\the_fast_sheep\src"
print(f"Listing all files in {src_dir} including hidden ones:")

found_files = []
for root, dirs, files in os.walk(src_dir):
    for f in files:
        path = os.path.join(root, f)
        rel_path = os.path.relpath(path, src_dir)
        size = os.path.getsize(path)
        print(f"  {rel_path} (Size: {size} bytes)")
        found_files.append((rel_path, size))

print(f"Done. Found {len(found_files)} files.")
