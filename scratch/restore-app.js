import fs from 'fs';

const logPath = 'C:\\Users\\rober\\.gemini\\antigravity-ide\\brain\\c6e1a33f-c242-49c2-b772-bd671052c53e\\.system_generated\\logs\\transcript.jsonl';

if (!fs.existsSync(logPath)) {
  console.error("Log file not found!");
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
const edits = [];

for (const line of lines) {
  try {
    const step = JSON.parse(line);
    
    // Look for tool calls from the model
    if (step.source === 'MODEL' && step.tool_calls) {
      for (const tc of step.tool_calls) {
        if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content' || tc.name === 'write_to_file') {
          const args = tc.args;
          const file = args.TargetFile || args.targetFile || args.TargetFilePath || '';
          edits.push({
            step_index: step.step_index,
            name: tc.name,
            file: file,
            desc: args.Description || args.description,
            status: 'unknown'
          });
        }
      }
    }
    
    if (step.type === 'CODE_ACTION' && step.status === 'DONE') {
      const matchingCall = edits.find(e => e.step_index === step.step_index);
      if (matchingCall) {
        matchingCall.status = 'DONE';
      }
    }
  } catch (err) {
    // Ignore parse errors
  }
}

console.log(`Found ${edits.length} total edits in the log:`);
edits.forEach(e => {
  console.log(`Step ${e.step_index}: name=${e.name}, file=${e.file}, status=${e.status}, desc=${e.desc}`);
});
