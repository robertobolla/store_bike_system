import ftfy

SRC = r"C:\roberto\webs\the_fast_sheep\scratch\App_461_copy2.tsx"
DST = r"C:\roberto\webs\the_fast_sheep\scratch\App_461_copy2_ftfy.tsx"

with open(SRC, "rb") as f:
    raw = f.read()

# Decode leniently, then drop any junk before the first real "import"
text = raw.decode("utf-8", errors="replace")
idx = text.find("import {")
if idx > 0:
    text = text[idx:]

# ftfy repairs mixed-level mojibake (Ã³, Â¿, etc.)
fixed = ftfy.fix_text(text)

with open(DST, "w", encoding="utf-8", newline="\n") as f:
    f.write(fixed)

# Report
def count(s, t):
    return s.count(t)

print("lines:", fixed.count("\n") + 1)
print("starts with:", repr(fixed[:40]))
for probe in ["Â", "Ã", "¿Eliminar", "Ubicación", "Almacén", "Atención",
              "Confirmación", "delivery_checklist", "Backup a Excel",
              "Tablero de Tareas", "Inspected By"]:
    print(f"  {probe!r}: {count(fixed, probe)}")
