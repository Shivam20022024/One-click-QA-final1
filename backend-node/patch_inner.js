const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'agents', 'ExecutionAgent.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Wrap the start of the action loop
const searchStart = `
            stepLogs.splice(stepLogsBeforeBatch); // Reset logs for fresh attempt on THIS batch


      for (const action of batchActions) {`;

const replaceStart = `
            stepLogs.splice(stepLogsBeforeBatch); // Reset logs for fresh attempt on THIS batch

      let attemptFailed = false;
      try {
      for (const action of batchActions) {`;

if (!code.includes(searchStart)) {
    console.error("Could not find start block!");
    process.exit(1);
}
code = code.replace(searchStart, replaceStart);

// 2. Wrap the end of the action loop
const searchEnd = `
        }
        
        if (scriptBlocked) {
          if (recoveryAttempt >= 3) {
            throw new Error("BLOCKED_BY_ANTIBOT: Site protected by anti-bot mechanisms after 3 recovery attempts.");
          }
          continue; // Move to next recovery attempt
        }
        
        batchSuccess = true;
        finalAttemptSuccess = true;`;

const replaceEnd = `
        }
        
        if (scriptBlocked) {
          if (recoveryAttempt >= 3) {
            throw new Error("BLOCKED_BY_ANTIBOT: Site protected by anti-bot mechanisms after 3 recovery attempts.");
          }
          attemptFailed = true;
        }
        
      } catch (err: any) {
         attemptFailed = true;
         if (recoveryAttempt >= 3 || err.message.includes("BLOCKED_BY_ANTIBOT")) {
            batchError = err;
            break; // exit the recovery loop for this batch!
         }
      }
      
      if (attemptFailed) {
         continue; // Move to next recovery attempt
      }
        
      batchSuccess = true;
      finalAttemptSuccess = true;`;

if (!code.includes(searchEnd)) {
    console.error("Could not find end block!");
    process.exit(1);
}
code = code.replace(searchEnd, replaceEnd);

fs.writeFileSync(filePath, code);
console.log("Patched ExecutionAgent.ts inner loop successfully!");
