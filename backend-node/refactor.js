const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'queue', 'executionWorker.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Import
code = code.replace(
  "import { OrchestratorAgent } from '../agents/OrchestratorAgent';",
  "import { OrchestratorAgent } from '../agents/OrchestratorAgent';\nimport { ScenarioParserAgent } from '../agents/ScenarioParserAgent';"
);

// 2. Extract Phase 5 into a helper function (insert after line 146)
const helperFunction = `
        const executeScriptWithRetry = async (scriptCodeToRun: string) => {
          let currentExecResult: any;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              emit('agent_progress', { agent: 'ExecutionAgent', status: attempt > 1 ? \`retrying (Attempt \${attempt})\` : 'executing' });
              currentExecResult = await execAgent.executeScript(
                executionId,
                scriptCodeToRun,
                browser || 'chromium',
                (type, msg) => {
                  if (type === 'browser_log') logMsg(\`[Playwright] \${msg}\`);
                  else emit(type, { message: msg });
                },
                {
                  accessibility: job.data.features?.accessibility || false,
                  security: job.data.features?.security || false,
                  sharedPage: sharedPage
                },
                (frame) => {
                  io.to(executionId).emit('live_frame', { executionId, frame });
                }
              );

              if (currentExecResult && currentExecResult.stepLogs) {
                 finalStepLogs.push(...currentExecResult.stepLogs);
              }

              if (!currentExecResult.success) {
                throw new Error(currentExecResult.error || 'Execution failed');
              }
              break; // Success, exit retry loop
            } catch (e: any) {
              if (attempt === 2) throw e;
              
              const errMsg = e.message || '';
              if (errMsg.includes('Selector not found') || errMsg.includes('Execution failed after recovery attempts') || errMsg.includes('Assertion failed') || errMsg.includes('ActionTypeMismatchError') || errMsg.includes('WrongPageError')) {
                logMsg(\`[Error] Execution failed due to deterministic script/selector error: \${errMsg}. Invalidating script cache to force replan on next attempt.\`);
                if (job.data.isAutonomous) {
                   const crypto = await import('crypto');
                   const urlHash = crypto.createHash('md5').update(job.data.targetUrl).digest('hex');
                   const cacheKeySuffix = \`\${activeExecution?.suiteId || 'default'}:\${urlHash}\`;
                   await redisConnection.del(\`suite_script:\${cacheKeySuffix}\`);
                   await redisConnection.del(\`suite_fingerprint:\${cacheKeySuffix}\`);
                   await job.updateData({ ...job.data, scriptCode: undefined });
                }
                throw e;
              }

              logMsg(\`[Warning] Execution attempt \${attempt} failed: \${e.message}. Retrying execution phase locally...\`);
              
              const video = sharedPage.video();
              await sharedPage.close().catch(() => {});
              await sharedContext.close().catch(() => {});
              
              if (video) {
                try {
                  const videoPath = await video.path();
                  if (fsSync.existsSync(videoPath) && fsSync.statSync(videoPath).size > 0) {
                    const videoData = await fs.promises.readFile(videoPath);
                    await supabase.storage.from('videos').upload(\`\${executionId}_attempt\${attempt}.mp4\`, videoData, { contentType: 'video/mp4', upsert: true });
                  }
                } catch (vidErr) {}
              }

              const videoDir = \`./temp/videos/\${executionId}\`;
              sharedContext = await sharedBrowser.newContext({
                recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) }
              });
              await sharedContext.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
              });
              sharedPage = await sharedContext.newPage();
              sharedPage.on('console', (msg: any) => logMsg(\`Console [\${msg.type()}]: \${msg.text()}\`));
              sharedPage.on('pageerror', (error: any) => logMsg(\`Page Error: \${error.message}\`));
            }
          }
          return currentExecResult;
        };
`;

code = code.replace(
  "sharedPage.on('pageerror', (error: any) => logMsg(`Page Error: ${error.message}`));\n\n        if (job.data.steps)",
  "sharedPage.on('pageerror', (error: any) => logMsg(`Page Error: ${error.message}`));\n" + helperFunction + "\n        let aggregatedExecResult: any = { success: true, scenario_status: {} };\n        if (job.data.steps)"
);

// 3. Refactor STRICT_SCENARIO block (Lines 229-235)
const strictScenarioBlockOld = `
                  if (currentMode === 'STRICT_SCENARIO') {
                     planResult = await orchestratorAgent.planStrictScenarioQA(
                       job.data.targetUrl,
                       logMsg,
                       (agent, status) => emit('agent_progress', { agent, status }),
                       { sharedPage, preDiscovered, customScenarioText: job.data.customScenario }
                     );
                  } else {`;

const strictScenarioBlockNew = `
                  if (currentMode === 'STRICT_SCENARIO') {
                     // Phase: Pre-parse ALL scenarios
                     const scenarioParser = new ScenarioParserAgent(executionId);
                     emit('agent_progress', { agent: 'ScenarioParserAgent', status: 'parsing_scenarios' });
                     const allParsedScenarios = await scenarioParser.parse(job.data.customScenario);
                     
                     emitLog('telemetry', \`PARSED_SCENARIO_COUNT=\${allParsedScenarios.length}\`);
                     
                     const batches = [];
                     for (let i = 0; i < allParsedScenarios.length; i += 5) {
                         batches.push(allParsedScenarios.slice(i, i + 5));
                     }
                     
                     let executedCount = 0;
                     let allTestCases: any[] = [];
                     
                     for (let b = 0; b < batches.length; b++) {
                         emitLog('telemetry', \`EXECUTION_BATCH_STARTED=\${b+1}\`);
                         
                         const batchPlanResult = await orchestratorAgent.planStrictScenarioQA(
                           job.data.targetUrl,
                           logMsg,
                           (agent, status) => emit('agent_progress', { agent, status }),
                           { sharedPage, preDiscovered, preParsedScenarios: batches[b] }
                         );
                         
                         if (!batchPlanResult.success) {
                             throw new Error("Orchestrator failed to plan execution for batch " + (b+1) + ": " + batchPlanResult.error);
                         }
                         
                         if (batchPlanResult.testCases) {
                             allTestCases.push(...batchPlanResult.testCases);
                         }
                         
                         const batchScriptCode = sanitizeExecutionPlan(batchPlanResult.executionPlan || '[]', logMsg);
                         const batchExecResult = await executeScriptWithRetry(batchScriptCode);
                         
                         if (batchExecResult && batchExecResult.scenario_status) {
                             Object.assign(aggregatedExecResult.scenario_status, batchExecResult.scenario_status);
                         }
                         if (batchExecResult) {
                             aggregatedExecResult.videoUrl = batchExecResult.videoUrl || aggregatedExecResult.videoUrl;
                             aggregatedExecResult.screenshotUrl = batchExecResult.screenshotUrl || aggregatedExecResult.screenshotUrl;
                             aggregatedExecResult.accessibilityResults = batchExecResult.accessibilityResults || aggregatedExecResult.accessibilityResults;
                             aggregatedExecResult.securityResults = batchExecResult.securityResults || aggregatedExecResult.securityResults;
                             aggregatedExecResult.transcriptEvents = (aggregatedExecResult.transcriptEvents || []).concat(batchExecResult.transcriptEvents || []);
                         }
                         
                         executedCount += batches[b].length;
                         
                         emitLog('telemetry', \`EXECUTION_BATCH_COMPLETED=\${b+1}\`);
                     }
                     
                     if (executedCount !== allParsedScenarios.length) {
                         throw new Error("SCENARIO_EXECUTION_MISMATCH: executed count does not match parsed count.");
                     }
                     
                     planResult = { success: true, executionPlan: '[]', testCases: allTestCases, requested_count: allParsedScenarios.length };
                  } else {`;

if (!code.includes(strictScenarioBlockOld)) {
  console.error("Could not find STRICT_SCENARIO block!");
}
code = code.replace(strictScenarioBlockOld, strictScenarioBlockNew);


// 4. Remove the Phase 5 logic, and replace with a call to executeScriptWithRetry ONLY IF it's not STRICT_SCENARIO
const phase5OldStart = `
        // Phase 5: Execution
        let execResult: any;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            emit('agent_progress', { agent: 'ExecutionAgent', status: attempt > 1 ? \`retrying (Attempt \${attempt})\` : 'executing' });
            execResult = await execAgent.executeScript(
              executionId,
              scriptCode,
              browser || 'chromium',
              (type, msg) => {
                if (type === 'browser_log') logMsg(\`[Playwright] \${msg}\`);
                else emit(type, { message: msg });
              },
              {
                accessibility: job.data.features?.accessibility || false,
                security: job.data.features?.security || false,
                sharedPage: sharedPage
              },
              (frame) => {
                io.to(executionId).emit('live_frame', { executionId, frame });
              }
            );

            if (execResult && execResult.stepLogs) {
               finalStepLogs = execResult.stepLogs;
            }

            if (!execResult.success) {
              throw new Error(execResult.error || 'Execution failed');
            }
            break; // Success, exit retry loop
          } catch (e: any) {
            if (attempt === 2) throw e;
            
            const errMsg = e.message || '';
            if (errMsg.includes('Selector not found') || errMsg.includes('Execution failed after recovery attempts') || errMsg.includes('Assertion failed') || errMsg.includes('ActionTypeMismatchError') || errMsg.includes('WrongPageError')) {
              logMsg(\`[Error] Execution failed due to deterministic script/selector error: \${errMsg}. Invalidating script cache to force replan on next attempt.\`);
              if (job.data.isAutonomous) {
                 const crypto = await import('crypto');
                 const urlHash = crypto.createHash('md5').update(job.data.targetUrl).digest('hex');
                 const cacheKeySuffix = \`\${activeExecution?.suiteId || 'default'}:\${urlHash}\`;
                 await redisConnection.del(\`suite_script:\${cacheKeySuffix}\`);
                 await redisConnection.del(\`suite_fingerprint:\${cacheKeySuffix}\`);
                 await job.updateData({ ...job.data, scriptCode: undefined });
              }
              throw e;
            }

            logMsg(\`[Warning] Execution attempt \${attempt} failed: \${e.message}. Retrying execution phase locally...\`);
            
            // Cleanly rotate browser context
            const video = sharedPage.video();
            await sharedPage.close().catch(() => {});
            await sharedContext.close().catch(() => {});
            
            // Upload intermediate video if it exists so we don't lose it
            if (video) {
              try {
                const videoPath = await video.path();
                if (fsSync.existsSync(videoPath) && fsSync.statSync(videoPath).size > 0) {
                  const videoData = await fs.readFile(videoPath);
                  await supabase.storage.from('videos').upload(\`\${executionId}_attempt\${attempt}.mp4\`, videoData, { contentType: 'video/mp4', upsert: true });
                }
              } catch (vidErr) {}
            }

            // Re-create context and page for retry
            const videoDir = \`./temp/videos/\${executionId}\`;
            sharedContext = await sharedBrowser.newContext({
              recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) }
            });
            await sharedContext.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });
            sharedPage = await sharedContext.newPage();
            sharedPage.on('console', (msg: any) => logMsg(\`Console [\${msg.type()}]: \${msg.text()}\`));
            sharedPage.on('pageerror', (error: any) => logMsg(\`Page Error: \${error.message}\`));
          }
        }

        finalStepLogs = execResult.stepLogs || [];`;

const phase5NewStart = `
        // Phase 5: Execution
        let execResult: any = aggregatedExecResult;
        const currentMode = job.data.isAutonomous && job.data.customScenario ? 'STRICT_SCENARIO' : (mode || 'full_autonomous');
        if (currentMode !== 'STRICT_SCENARIO') {
             execResult = await executeScriptWithRetry(scriptCode);
        }
        
        // Ensure finalStepLogs doesn't get overridden if already populated by batch
        if (currentMode !== 'STRICT_SCENARIO') {
             finalStepLogs = execResult?.stepLogs || [];
        }`;

if (!code.includes(phase5OldStart)) {
    console.error("Could not find Phase 5 start!");
} else {
    code = code.replace(phase5OldStart, phase5NewStart);
}

fs.writeFileSync(filePath, code);
console.log("Refactored executionWorker.ts successfully!");
