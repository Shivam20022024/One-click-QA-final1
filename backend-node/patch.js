const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'agents', 'ExecutionAgent.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Setup batching before the recovery loop
const batchingSetup = `
      // --- BATCHING SETUP ---
      const batches: any[][] = [];
      let currentBatch: any[] = [];
      let currentBatchScenarios = new Set<string>();

      for (const action of actions) {
          if (action.scenarioName) {
             if (!currentBatchScenarios.has(action.scenarioName) && currentBatchScenarios.size >= 5) {
                 batches.push(currentBatch);
                 currentBatch = [];
                 currentBatchScenarios = new Set<string>();
             }
             currentBatchScenarios.add(action.scenarioName);
          }
          currentBatch.push(action);
      }
      if (currentBatch.length > 0) {
          batches.push(currentBatch);
      }

      let overallExecutionSuccess = true;
      let finalAttemptSuccess = false; // keep for legacy compatibility
      
      for (let b = 0; b < batches.length; b++) {
         const batchActions = batches[b];
         let batchSuccess = false;
         let batchError: any = null;
         const stepLogsBeforeBatch = stepLogs.length;

         for (let recoveryAttempt = 1; recoveryAttempt <= 3; recoveryAttempt++) {
            if (recoveryAttempt > 1) {
               emitLog('agent_log', \`[Recovery Strategy] Initiating execution retry attempt \${recoveryAttempt}/3 for batch \${b+1}/\${batches.length} on existing page...\`);
               await context.clearCookies().catch(() => {});
               await page.goto(batchActions.find((a: any) => a.action === 'goto')?.url || 'about:blank', { waitUntil: 'domcontentloaded' }).catch(() => {});
            }
            
            const injectHumanSimulation = recoveryAttempt >= 2;
            const injectSlowCrawl = recoveryAttempt >= 3;
            let scriptBlocked = false;
            stepLogs.splice(stepLogsBeforeBatch); // Reset logs for fresh attempt on THIS batch
`;

// Replace the start of the loop
code = code.replace(
    /let finalAttemptSuccess = false;\s*for \(let recoveryAttempt = 1; recoveryAttempt <= 3; recoveryAttempt\+\+\) \{\s*if \(recoveryAttempt > 1\) \{[\s\S]*?stepLogs = \[\]; \/\/ Reset logs for fresh attempt/g,
    batchingSetup
);

// 2. Replace 'for (const action of actions) {' with 'for (const action of batchActions) {'
code = code.replace(/for \(const action of actions\) \{/g, 'for (const action of batchActions) {');

// 3. Find the end of the recovery loop and close the batch loop
const endOfRecoveryLoop = `      if (!finalAttemptSuccess) {
         throw new Error("Execution failed after recovery attempts");
      }`;

const closeBatchLoop = `
      if (!batchSuccess && batchError) {
         overallExecutionSuccess = false;
         emitLog('browser_log', \`Execution batch \${b+1} failed: \${batchError.message}\`);
         
         // Mark remaining scenarios in this batch as FAIL
         for (const a of batchActions) {
             if (a.scenarioName && scenario_status[a.scenarioName] === 'IN_PROGRESS') {
                 scenario_status[a.scenarioName] = 'FAIL';
                 logTranscriptEvent('scenario fail', a.scenarioName, undefined, 'FAIL', a.scenarioName);
             }
         }
      }
      } // end of batch loop
      
      if (!overallExecutionSuccess) {
         // We don't throw! We just let it finish so remaining batches results are saved!
         // The worker will mark it as FAILED if requested != passed
      }
`;

code = code.replace(endOfRecoveryLoop, closeBatchLoop);

// 4. Update the catch block at the bottom of the try inside recoveryAttempt
// We need to find: `if (recoveryAttempt >= 3) { throw err; }`
// And replace it with setting batchError and breaking
code = code.replace(/if \(recoveryAttempt >= 3\) \{\s*throw err;\s*\}/g, `if (recoveryAttempt >= 3) { batchError = err; break; }`);

// 5. Update finalAttemptSuccess = true;
// We need to set batchSuccess = true
code = code.replace(/finalAttemptSuccess = true;/g, 'batchSuccess = true;');


fs.writeFileSync(filePath, code);
console.log("Patched ExecutionAgent.ts successfully");
