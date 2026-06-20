import os
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

transcript_path = r"C:\Users\rober\.gemini\antigravity-ide\brain\6ca2aadf-5586-43d0-babb-162b50bf4e8a\.system_generated\logs\transcript.jsonl"
print(f"Reading transcript: {transcript_path}")

if os.path.exists(transcript_path):
    try:
        with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, 1):
                # Search for keywords or edits to App.tsx
                if "App.tsx" in line or "checklist" in line or "backup" in line:
                    print(f"Line {line_no} contains match.")
                    try:
                        step = json.loads(line)
                        print(f"  Step Index: {step.get('step_index')}")
                        print(f"  Type: {step.get('type')}")
                        print(f"  Source: {step.get('source')}")
                        if "tool_calls" in step:
                            for tc in step["tool_calls"]:
                                print(f"  Tool Call: {tc.get('name')}")
                                args = tc.get('arguments', {})
                                for k, v in args.items():
                                    if isinstance(v, str):
                                        print(f"    Arg {k} size: {len(v)}")
                                        if any(kw in v for kw in ["checklist", "backup", "Internal", "DELIVERY"]):
                                            print(f"      Matched text in {k}: {v[:200]}...")
                                            # Write matched content to a recovery file
                                            out_f = f"scratch/recovered_6ca_step_{step.get('step_index')}_{k}.txt"
                                            with open(out_f, "w", encoding="utf-8") as out:
                                                out.write(v)
                                            print(f"      Wrote argument to {out_f}")
                    except Exception as je:
                        print("  JSON parse error:", je)
    except Exception as e:
        print("Error reading transcript:", e)
else:
    print("Transcript does not exist.")
