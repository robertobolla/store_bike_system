import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

db_path = r"C:\Users\rober\.gemini\antigravity-ide\conversations\c6e1a33f-c242-49c2-b772-bd671052c53e.db"
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print(f"Searching SQLite database steps table: {db_path}...")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all columns in the steps table
cursor.execute("PRAGMA table_info(steps)")
columns = [col[1] for col in cursor.fetchall()]
print(f"Columns in steps table: {columns}")

for col in columns:
    for kw in keywords:
        try:
            # Query rows matching keyword
            cursor.execute(f"SELECT idx, {col} FROM steps WHERE {col} LIKE ?", (f"%{kw}%",))
            rows = cursor.fetchall()
            for row in rows:
                step_idx = row[0]
                val = str(row[1])
                # ignore steps from current turn (which started around step index 940+)
                if step_idx > 900:
                    continue
                print(f"\n==========================================")
                print(f"FOUND keyword '{kw}' in step {step_idx}, column {col}!")
                print(f"Content length: {len(val)} chars")
                # print snippet of content
                print(val[:2000])
                if len(val) > 2000:
                    print("...[TRUNCATED]")
                
                # Save full step payload to a recovery file
                out_name = f"scratch/recovered_db_step_{step_idx}_{col}.txt"
                with open(out_name, "w", encoding="utf-8") as out_f:
                    out_f.write(val)
                print(f"Saved full content to {out_name}")
        except Exception as e:
            print(f"Error querying column {col} for keyword {kw}: {e}")

conn.close()
print("Search complete.")
