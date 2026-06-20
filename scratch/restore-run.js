import fs from 'fs';

const logPath = 'C:\\Users\\rober\\.gemini\\antigravity-ide\\brain\\c6e1a33f-c242-49c2-b772-bd671052c53e\\.system_generated\\logs\\transcript.jsonl';
const targetFile = 'src/App.tsx';

if (!fs.existsSync(logPath)) {
  console.error("Log file not found!");
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
let step96 = null;
let step120 = null;

for (const line of lines) {
  try {
    const step = JSON.parse(line);
    if (step.source === 'MODEL' && step.step_index === 96) {
      step96 = step.tool_calls[0];
    }
    if (step.source === 'MODEL' && step.step_index === 120) {
      step120 = step.tool_calls[0];
    }
  } catch (err) {
    // Ignore
  }
}

if (!step96 || !step120) {
  console.error("Could not find step 96 or step 120 in transcript.jsonl!");
  process.exit(1);
}

let appContent = fs.readFileSync(targetFile, 'utf8');

// Apply Step 96 (multi_replace_file_content)
console.log("Applying Step 96 (User fields edits)...");
let chunks = step96.args.ReplacementChunks || step96.args.replacementChunks;

if (typeof chunks === 'string') {
  try {
    chunks = JSON.parse(chunks);
  } catch (err) {
    console.log("Standard JSON.parse failed, attempting to clean raw newlines...");
    // Replace raw newlines and carriage returns with escaped counterparts
    const cleaned = chunks
      .replace(/\r/g, '') // remove carriage returns
      .replace(/\n/g, '\\n') // convert raw newlines to escaped \n
      .replace(/\t/g, '\\t'); // convert tabs
    chunks = JSON.parse(cleaned);
  }
}

if (!Array.isArray(chunks)) {
  console.error("chunks is not an array! type:", typeof chunks);
  process.exit(1);
}

chunks.sort((a, b) => b.StartLine - a.StartLine); // Apply from bottom to top to avoid line index shift issues

for (const chunk of chunks) {
  const target = chunk.TargetContent || chunk.targetContent;
  const replacement = chunk.ReplacementContent || chunk.replacementContent;
  
  if (appContent.includes(target)) {
    appContent = appContent.replace(target, replacement);
    console.log(`- Applied chunk starting on line ${chunk.StartLine}`);
  } else {
    console.warn(`- WARNING: Target content for chunk starting on line ${chunk.StartLine} was not found!`);
  }
}

// Apply Step 120 (replace_file_content)
console.log("Applying Step 120 (BAT tax label change)...");
const target120 = step120.args.TargetContent || step120.args.targetContent;
const replacement120 = step120.args.ReplacementContent || step120.args.replacementContent;

if (appContent.includes(target120)) {
  appContent = appContent.replace(target120, replacement120);
  console.log("- Applied Step 120 successfully.");
} else {
  console.warn("- WARNING: Target content for Step 120 was not found!");
}

fs.writeFileSync(targetFile, appContent, 'utf8');
console.log("App.tsx restoration complete!");
