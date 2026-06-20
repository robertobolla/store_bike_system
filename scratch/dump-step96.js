import fs from 'fs';

const logPath = 'C:\\Users\\rober\\.gemini\\antigravity-ide\\brain\\c6e1a33f-c242-49c2-b772-bd671052c53e\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.error("Log file not found!");
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
let step96 = null;

for (const line of lines) {
  try {
    const step = JSON.parse(line);
    if (step.source === 'MODEL' && step.step_index === 96) {
      step96 = step.tool_calls[0];
    }
  } catch (err) {}
}

if (step96) {
  const rawArgs = JSON.stringify(step96.args, null, 2);
  fs.writeFileSync('scratch/chunks-raw.txt', rawArgs, 'utf8');
  console.log("Dumped Step 96 args to scratch/chunks-raw.txt, file size:", fs.statSync('scratch/chunks-raw.txt').size);
} else {
  console.log("Step 96 not found!");
}
