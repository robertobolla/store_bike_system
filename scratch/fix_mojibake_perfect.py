import sys

sys.stdout.reconfigure(encoding="utf-8")

with open("scratch/App_461_copy2.tsx", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# Let's write a custom decoder that replaces mojibake sequences.
# Mojibake happens when UTF-8 bytes are interpreted as CP1252 and then saved.
# To reverse this: we take each character, if its ordinal is < 256, we can treat it as a byte.
# But wait! CP1252 maps byte values 128-159 to specific unicode characters (like \u0192 for 131).
# We can create a mapping of CP1252 unicode characters back to their byte values!
# CP1252 mapping table:
cp1252_to_byte = {}
for b in range(256):
    try:
        u = bytes([b]).decode('cp1252')
        cp1252_to_byte[u] = b
    except Exception:
        pass

# Let's map other common double-escapes if any.
# Now, let's convert the string to bytes using this mapping
byte_arr = bytearray()
unmapped = 0
for char in content:
    if char in cp1252_to_byte:
        byte_arr.append(cp1252_to_byte[char])
    else:
        # If it's not in CP1252, it might be a normal character that was not double-encoded,
        # or we just fallback to its low byte
        o = ord(char)
        if o < 256:
            byte_arr.append(o)
        else:
            # It's a high unicode character, let's encode it as utf-8 bytes and append them
            # or keep it as is. If we keep it as is, it'll be fine if we decode later.
            # But since we want to decode the whole bytearray as utf-8, let's encode it to utf-8
            for b in char.encode('utf-8'):
                byte_arr.append(b)
            unmapped += 1

print("Total characters:", len(content))
print("Unmapped high chars:", unmapped)

# Now decode the entire byte array as UTF-8
try:
    fixed = byte_arr.decode('utf-8')
    print("Successfully decoded fixed bytearray as UTF-8!")
except Exception as e:
    print("UTF-8 decode failed:", e)
    fixed = byte_arr.decode('utf-8', errors='replace')

with open("scratch/App_461_copy2_clean_fixed.tsx", "w", encoding="utf-8") as f:
    f.write(fixed)

print("Saved scratch/App_461_copy2_clean_fixed.tsx")
