import sys

sys.stdout.reconfigure(encoding="utf-8")

with open("scratch/App_461_copy2.tsx", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# Let's try encoding to cp1252 and decoding as utf-8
# We will do it in parts or catch exceptions if there are any non-cp1252 characters.
try:
    # First, let's try direct cp1252/utf-8 fix
    fixed = content.encode('cp1252').decode('utf-8')
    print("Direct conversion succeeded!")
except Exception as e:
    print("Direct conversion failed, doing character-by-character or line-by-line fallback:", e)
    # Let's do a line-by-line fallback
    lines = content.splitlines()
    fixed_lines = []
    for i, line in enumerate(lines):
        try:
            fixed_line = line.encode('cp1252').decode('utf-8')
            fixed_lines.append(fixed_line)
        except Exception as err:
            # If it fails, maybe it is already correct or has specific characters.
            # Let's try latin-1, or just keep it as is.
            fixed_lines.append(line)
    fixed = "\n".join(fixed_lines)

with open("scratch/App_461_copy2_fixed.tsx", "w", encoding="utf-8") as f:
    f.write(fixed)

print("Fixed file written to scratch/App_461_copy2_fixed.tsx")
print("Size of fixed file:", len(fixed))
