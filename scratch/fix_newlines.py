path = "src/App.tsx"
with open(path, encoding="utf-8") as f:
    txt = f.read()

bs_nl = "\\" + "\n"   # backslash + newline (2 chars)
esc = "\\" + "n"      # backslash + n (2 chars)

before = txt.count(bs_nl)
# repeat to collapse consecutive \<NL>\<NL>
while bs_nl in txt:
    txt = txt.replace(bs_nl, esc)

with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(txt)

print("occurrences of backslash+newline fixed:", before)
print("remaining:", txt.count(bs_nl))
