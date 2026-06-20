import os
import sqlite3

search_dir = r"C:\Users\rober\.gemini\antigravity-ide\conversations"
target = "downloadBackupXlsx"
target2 = "DELIVERY_CHECKLIST_GROUPS"

print(f"Searching databases in {search_dir}...")
for f in os.listdir(search_dir):
    if f.endswith(".db"):
        db_path = os.path.join(search_dir, f)
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            for table in tables:
                cursor.execute(f"PRAGMA table_info({table})")
                cols = [col[1] for col in cursor.fetchall()]
                for col in cols:
                    try:
                        cursor.execute(f"SELECT count(*) FROM {table} WHERE {col} LIKE ? OR {col} LIKE ?", (f"%{target}%", f"%{target2}%"))
                        count = cursor.fetchone()[0]
                        if count > 0:
                            print(f"FOUND in DB {f}, table {table}, column {col} ({count} rows)")
                    except Exception as e:
                        pass
            conn.close()
        except Exception as e:
            print(f"Error reading {f}: {e}")
print("Search complete.")
