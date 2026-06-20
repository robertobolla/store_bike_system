import os
import sqlite3

base = os.path.join(os.environ.get("APPDATA", ""), "Antigravity IDE", "User", "workspaceStorage")
keywords = ["DELIVERY_CHECKLIST_GROUPS", "InternalChecklistEditor", "downloadBackupXlsx"]

print(f"Scanning state.vscdb files in {base}...")

for root, dirs, files in os.walk(base):
    for f in files:
        if f == "state.vscdb":
            db_path = os.path.join(root, f)
            # Find the workspace JSON to identify the folder name
            ws_json = os.path.join(root, "workspace.json")
            ws_name = ""
            if os.path.exists(ws_json):
                try:
                    with open(ws_json, "r", encoding="utf-8") as wjf:
                        ws_name = wjf.read().strip()
                except Exception:
                    pass
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]
                for table in tables:
                    cursor.execute(f"PRAGMA table_info({table})")
                    cols = [col[1] for col in cursor.fetchall()]
                    for col in cols:
                        for kw in keywords:
                            try:
                                cursor.execute(f"SELECT count(*) FROM {table} WHERE {col} LIKE ?", (f"%{kw}%",))
                                count = cursor.fetchone()[0]
                                if count > 0:
                                    print(f"FOUND: DB={db_path} ({ws_name}), table={table}, col={col}, kw={kw} ({count} rows)")
                                    # let's fetch matching rows
                                    cursor.execute(f"SELECT {col} FROM {table} WHERE {col} LIKE ?", (f"%{kw}%",))
                                    for r in cursor.fetchall():
                                        val = str(r[0])
                                        print(f"  Snippet: {val[:200]}...")
                            except Exception:
                                pass
                conn.close()
            except Exception as e:
                print(f"Error reading {db_path}: {e}")

print("Vscdb scan complete.")
