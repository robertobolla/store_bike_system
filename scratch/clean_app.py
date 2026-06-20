import sys
import re

sys.stdout.reconfigure(encoding="utf-8")

payload_path = "scratch/recovered_db_step_461_step_payload.txt"
with open(payload_path, "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

# Locate "import { useState" after the file path
start_target = "file:///c:/roberto/webs/the_fast_sheep/src/App.tsx"
start_idx = content.find(start_target)
if start_idx == -1:
    print("Could not find start target")
    sys.exit(1)

# Find "import { useState" within 200 chars
import_idx = content.find("import { useState", start_idx, start_idx + 200)
if import_idx == -1:
    # If not found, let's look for "import"
    import_idx = content.find("import", start_idx, start_idx + 200)

if import_idx == -1:
    print("Could not find import statement start")
    sys.exit(1)

# Find the end boundary. We saw Chars before next file:/// ends with:
# "}\n\n  );\n}\n2\x0b\x08\xa4"
# Let's search for "file:///" after start_idx
next_file_idx = content.find("file:///", start_idx + len(start_target))
if next_file_idx == -1:
    # Fallback to end of file
    next_file_idx = len(content)

# Substring containing App.tsx
app_raw = content[import_idx:next_file_idx]

# Let's clean up up to the trailing Protobuf/metadata marker.
# We know the file ends with the closing of the App component or a style/div.
# Let's find the last occurrence of "}\n\n  );\n}" or simply search backwards for "}\n" or standard closing structures.
# Chars before next file:/// showed:
# "      <style>{`\n        @keyframes scaleUpConfirm {\n          from { transform: scale(0.95); opacity: 0; }\n          to { transform: scale(1); opacity: 1; }\n        }\n      `}</style>\n\n    </div>\n\n  );\n}\n2\x0b\x08\xa4"
# Wait, let's look for the last "}\n" in the string and cut it there.
# Let's do a regex search backwards or simply find the last pattern.
end_match = re.search(r"}\s*;\s*}\s*$", app_raw)
# Let's check for the marker "2\x0b\x08" or similar non-ASCII sequences
binary_match = re.search(r"2\\x0b\\x08|2\x0b\x08", app_raw)
if binary_match:
    end_pos = binary_match.start()
    app_raw = app_raw[:end_pos]
else:
    # fallback: try to find the last style tag and closing div
    last_div_idx = app_raw.rfind("</div>")
    if last_div_idx != -1:
        # Include some lines after it
        app_raw = app_raw[:last_div_idx + 500]

# Now, we need to unescape the string.
# Since it is stored with double-escaped characters (like \\n, \\', etc.), let's do replacement.
def unescape_string(s):
    # First, let's replace unicode escapes if any
    # e.g. \xe2\x80\x94
    # Let's decode hex escape sequences using a bytes decoding trick if possible.
    # But since it's a string, we can do it by encoding to ascii/latin1 and decoding as utf-8 or raw-unicode-escape.
    # Let's do a simple unescape function:
    s = s.replace("\\n", "\n")
    s = s.replace("\\t", "\t")
    s = s.replace("\\'", "'")
    s = s.replace('\\"', '"')
    s = s.replace("\\\\", "\\")
    
    # Handle hex escapes like \xe2\x80\x94
    def hex_repl(match):
        hex_str = match.group(0) # e.g. \xe2
        val = int(hex_str[2:], 16)
        return bytes([val]).decode('latin-1')
        
    s_latin = re.sub(r'\\x[0-9a-fA-F]{2}', hex_repl, s)
    # Now convert from latin-1 (which preserves byte values 0-255) to utf-8 bytes, then decode as utf-8
    try:
        s_utf8 = s_latin.encode('latin-1').decode('utf-8')
        return s_utf8
    except Exception as e:
        print("Warning: UTF-8 decode failed, using latin-1 decoded version", e)
        return s_latin

clean_code = unescape_string(app_raw)

# Save to scratch/clean_App_461.tsx
with open("scratch/clean_App_461.tsx", "w", encoding="utf-8") as f:
    f.write(clean_code)

print("Saved clean code of App.tsx to scratch/clean_App_461.tsx")
print("Size of clean file:", len(clean_code))
