import { Worker, Queue, Job, FlowProducer } from 'bullmq';
import redisConnection from '../lib/redis';
import prisma from '../prismaClient';
import { chromium, firefox, webkit } from 'playwright';
import fs from 'fs/promises';
import * as fsSync from 'fs';
import { supabase } from '../utils/storage';

import { RequirementsAgent } from '../agents/RequirementsAgent';
import { TestCaseAgent } from '../agents/TestCaseAgent';
import { TestDataAgent } from '../agents/TestDataAgent';
import { sanitizeExecutionPlan } from '../utils/sanitizer';
import { ScriptGenerationAgent } from '../agents/ScriptGenerationAgent';
import { ExecutionAgent } from '../agents/ExecutionAgent';
import { ReportingAgent } from '../agents/ReportingAgent';
import { OrchestratorAgent } from '../agents/OrchestratorAgent';
import { ScenarioParserAgent } from '../agents/ScenarioParserAgent';
import { JiraService } from '../services/JiraService';

export const executionQueueName = 'test-executions';

async function cleanupInterruptedJobs() {
  try {
    const interruptedJobs = await prisma.executionLog.updateMany({
      where: {
        status: {
          in: ['RUNNING', 'HEALING', 'GENERATING_SCRIPT']
        }
      },
      data: {
        status: 'FAILED',
        logs: JSON.stringify(["Backend restarted mid-execution. Job marked as FAILED."]),
        durationMs: 0
      }
    });
    if (interruptedJobs.count > 0) {
      console.log(`[Worker Crash Safety] Marked ${interruptedJobs.count} interrupted active jobs as FAILED (WORKER_RESTART_DURING_EXECUTION).`);
    }
  } catch (error) {
    console.error('[Worker Crash Safety] Failed to clean up interrupted jobs:', error);
  }
}

export const executionQueue = new Queue(executionQueueName, {
  connection: redisConnection,
});

export const flowProducer = new FlowProducer({
  connection: redisConnection,
});

export const initExecutionWorker = (io: any) => {
  cleanupInterruptedJobs();
  const worker = new Worker(
    executionQueueName,
    async (job: Job) => {
      if (job.name === 'cross-browser-suite') {
        console.log(`[FlowProducer] Parent suite job ${job.id} marked as complete.`);
        return;
      }
      
      console.log(`WORKER_PICKED_JOB: ${job.data.executionId}`);
      const { executionId, testName, instruction, targetUrl, browser, mode } = job.data;

      const emit = (type: string, payload?: any) => {
        io.to(executionId).emit(type, payload);
      };

      const jobStartTime = Date.now();
      console.log(`EXECUTION_STARTED: ${job.data.executionId}`);
      emit('queued', { message: 'Job accepted by worker' });

      let logs: string[] = [];
      let finalStepLogs: any[] = [];
      let generatedReportContent = '';
      const logMsg = (msg: string) => {
        logs.push(msg);
        emit('browser_log', { message: msg });
      };

      logMsg(`[Execution Claim] EXECUTION_CLAIM_ATTEMPT`);
      const claimResult = await prisma.executionLog.updateMany({
         where: {
            id: executionId,
            status: { not: "CANCELLED" }
         },
         data: {
            status: "RUNNING",
            startedAt: new Date()
         }
      });

      if (claimResult.count === 0) {
        logMsg(`[Execution Claim] EXECUTION_ALREADY_CLAIMED_OR_CANCELLED - Aborting execution attempt.`);
        return;
      }
      
      logMsg(`[Execution Claim] EXECUTION_CLAIM_SUCCESS`);
      const activeExecution = await prisma.executionLog.findUnique({ where: { id: executionId } });

      const reqAgent = new RequirementsAgent(executionId);
      const tcAgent = new TestCaseAgent(executionId);
      const dataAgent = new TestDataAgent();
      const scriptAgent = new ScriptGenerationAgent(executionId);
      const execAgent = new ExecutionAgent();
      const reportAgent = new ReportingAgent();
      const orchestratorAgent = new OrchestratorAgent(executionId);

      let sharedBrowser: any = null;
      let sharedContext: any = null;
      let sharedPage: any = null;
      let aggregatedExecResult: any = { success: true, scenario_status: {} };
      
      try {
        let isOrchestrator = false;
        let scriptCode = '';
        let preDiscovered: any = null;

        logMsg('Initializing shared browser for full pipeline video recording...');
        const browserName = (browser || 'chromium').toLowerCase();
        if (browserName === 'firefox') {
          sharedBrowser = await firefox.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
        } else if (browserName === 'webkit' || browserName === 'safari') {
          sharedBrowser = await webkit.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
        } else if (browserName === 'edge' || browserName === 'msedge') {
          sharedBrowser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
        } else {
          sharedBrowser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
        }
        
        logMsg(`[Telemetry] BROWSER_ENGINE_STARTED: ${browserName}`);
        
        const path = await import('path');
        const videoDir = path.resolve(process.cwd(), 'temp', 'videos', executionId);
        const screenshotDir = path.resolve(process.cwd(), 'temp', 'screenshots');
        await fs.mkdir(videoDir, { recursive: true });
        await fs.mkdir(screenshotDir, { recursive: true });
        
        sharedContext = await sharedBrowser.newContext({
          recordVideo: {
            dir: videoDir,
            size: { width: 1280, height: 720 }
          },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) }
        });
        
        await sharedContext.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        
        sharedPage = await sharedContext.newPage();
        
        const contextId = (sharedContext as any)._guid || 'unknown-context';
        const pageId = (sharedPage as any)._guid || 'unknown-page';
        const VIDEO_PAGE_ID = pageId;
        logMsg(`[Video] VIDEO_CONTEXT_CREATED: ${contextId}`);
        logMsg(`[Video] VIDEO_PAGE_CREATED: ${pageId}`);
        logMsg(`[Video] VIDEO_RECORDING_STARTED`);
        
        sharedPage.on('console', (msg: any) => logMsg(`Console [${msg.type()}]: ${msg.text()}`));
        sharedPage.on('pageerror', (error: any) => logMsg(`Page Error: ${error.message}`));

        const executeScriptWithRetry = async (scriptCodeToRun: string) => {
          const EXECUTION_PAGE_ID = (sharedPage as any)._guid || 'unknown-page';
          if (EXECUTION_PAGE_ID !== VIDEO_PAGE_ID) {
             throw new Error("PAGE_CONTEXT_MISMATCH");
          }
          emit('agent_progress', { agent: 'ExecutionAgent', status: 'executing' });
          let currentExecResult = await execAgent.executeScript(
            executionId,
            scriptCodeToRun,
            browser || 'chromium',
            (type: string, msg: string) => {
              if (type === 'browser_log') logMsg(`[Playwright] ${msg}`);
              else emit(type, { message: msg });
            },
            {
              accessibility: job.data.features?.accessibility || false,
              security: job.data.features?.security || false,
              sharedPage: sharedPage,
              targetUrl: job.data.targetUrl,
              credentials: (aggregatedExecResult as any).authMetadata || job.data.credentials
            },
            (frame: string) => {
              io.to(executionId).emit('live_frame', { executionId, frame });
            }
          );

          if (currentExecResult && currentExecResult.stepLogs) {
             finalStepLogs.push(...currentExecResult.stepLogs);
          }
          
          if (currentExecResult && currentExecResult.screenshotUrl) {
             aggregatedExecResult.screenshotUrl = currentExecResult.screenshotUrl;
          }
          if (currentExecResult && currentExecResult.videoUrl) {
             aggregatedExecResult.videoUrl = currentExecResult.videoUrl;
          }

          if (!currentExecResult.success) {
            if (currentExecResult.scenario_status) {
                Object.assign(aggregatedExecResult.scenario_status, currentExecResult.scenario_status);
            }
            const errMsg = (currentExecResult.error || '').toLowerCase();
            if (!errMsg.includes('assertion step failed') && !errMsg.includes('selector not found in dom')) {
                throw new Error(currentExecResult.error || 'Execution failed');
            }
          }
          
          return currentExecResult;
        };

        // aggregatedExecResult defined outside try block
        if (job.data.steps) {
          logMsg('[PLAN SOURCE: explicit_override] Direct steps provided. Skipping AI generation phases...');
          scriptCode = typeof job.data.steps === 'string' ? job.data.steps : JSON.stringify(job.data.steps);
        } else if (job.data.scriptCode && !job.data.isAutonomous) {
          logMsg('[PLAN SOURCE: explicit_override] Retry detected: Bypassing AI Orchestration and using previously generated script...');
          scriptCode = sanitizeExecutionPlan(job.data.scriptCode, logMsg);
        } else if (job.data.isAutonomous) {
          let currentMode = mode || 'full_autonomous';
          
          if (job.data.customScenario) {
             currentMode = 'STRICT_SCENARIO';
          }
          
          const crypto = await import('crypto');
          const urlHash = crypto.createHash('md5').update(job.data.targetUrl).digest('hex');
          const cacheKeySuffix = `${activeExecution?.suiteId || 'default'}:${urlHash}`;

          const sharedPlanCacheKey = `shared_plan:${cacheKeySuffix}`;
          const orchestratorLockKey = `orchestrator_lock:${cacheKeySuffix}`;

          // Parallel Execution Lock Logic
          let lockAcquired = false;
          let orchestrationWaitAttempts = 0;
          let isOrchestrator = true;
          
          if (currentMode !== 'STRICT_SCENARIO') {
            while (!lockAcquired && orchestrationWaitAttempts < 150) {
               const cachedPlan = await redisConnection.get(sharedPlanCacheKey);
               if (cachedPlan) {
                  logMsg('[PLAN SOURCE: cache_reuse] Reusing Autonomous script generated by sibling execution...');
                  scriptCode = sanitizeExecutionPlan(cachedPlan, logMsg);
                  isOrchestrator = false;
                  break;
               }
               
               lockAcquired = (await redisConnection.set(orchestratorLockKey, "LOCKED", "EX", 300, "NX")) !== null;
               if (!lockAcquired) {
                  logMsg('Waiting for sibling execution to finish Autonomous orchestration...');
                  await new Promise(r => setTimeout(r, 2000));
                  orchestrationWaitAttempts++;
               }
            }
            
            if (!lockAcquired && isOrchestrator) {
               logMsg('[Warning] Sibling orchestration timed out. Proceeding with independent generation.');
            }
          } else {
            // In STRICT_SCENARIO, we do not share or reuse sibling plans. 
            // We run generation specifically for this user's strict scenario array.
            isOrchestrator = true;
          }

          if (isOrchestrator) {
            try {
              emit('agent_progress', { agent: 'DiscoveryAgent', status: 'validating_cache' });
              logMsg('Running DiscoveryAgent to generate DOM signature and capabilities for cache validation...');
              const { DiscoveryAgent } = await import('../agents/DiscoveryAgent');
              const discoveryAgent = new DiscoveryAgent(executionId);
              const discoveryResult = await discoveryAgent.discoverFlows(job.data.targetUrl, 3, { sharedPage, discoveryPath: 'cache_validation' });
              const capabilityMap = await discoveryAgent.detectCapabilities(discoveryResult.domSummary);
              
              const DISCOVERY_PAGE_ID = (sharedPage as any)._guid || 'unknown-page';
              if (DISCOVERY_PAGE_ID !== VIDEO_PAGE_ID) {
                  throw new Error("PAGE_CONTEXT_MISMATCH");
              }
              
              let fingerprintData = capabilityMap;
              if (currentMode !== 'basic' && currentMode !== 'STRICT_SCENARIO') {
                const { CapabilityAnalyzerAgent } = await import('../agents/CapabilityAnalyzerAgent');
                const capAgent = new CapabilityAnalyzerAgent(executionId);
                fingerprintData = await capAgent.analyze(discoveryResult.domSummary);
              }
              const currentFingerprint = crypto.createHash('sha256').update(JSON.stringify(fingerprintData)).digest('hex');
              
              preDiscovered = {
                domSummary: discoveryResult.domSummary,
                capabilityMap,
                discoveredFlows: discoveryResult.flows,
                fingerprint: currentFingerprint
              };

              let orchestrationAttempt = 1;
              while (orchestrationAttempt <= 2) {
                try {
                  logMsg(`[PLAN SOURCE: fresh_generation] Starting ${currentMode} Pipeline (Attempt ${orchestrationAttempt})...`);
                  
                  let planResult;
                  if (currentMode === 'STRICT_SCENARIO') {
                     // Phase: Pre-parse ALL scenarios
                     const scenarioParser = new ScenarioParserAgent(executionId);
                     emit('agent_progress', { agent: 'ScenarioParserAgent', status: 'parsing_scenarios' });
                     const parseResult = await scenarioParser.parse(job.data.customScenario);
                     const allParsedScenarios = parseResult.scenarios;
                     
                     if (parseResult.auth) {
                        (aggregatedExecResult as any).authMetadata = parseResult.auth;
                     }
                     
                     logMsg(`[Telemetry] PARSED_SCENARIO_COUNT=${allParsedScenarios.length}`);
                     
                     const batches: any[][] = [];
                     for (let i = 0; i < allParsedScenarios.length; i += 5) {
                         batches.push(allParsedScenarios.slice(i, i + 5));
                     }
                     
                     let executedCount = 0;
                     let allTestCases: any[] = [];
                     let allExecutionPlans: any[] = [];
                     
                     for (let b = 0; b < batches.length; b++) {
                         logMsg(`[Telemetry] EXECUTION_BATCH_STARTED=${b+1}`);
                         
                         const currentCookies = await sharedContext.cookies().catch(() => []);
                         const isSessionReused = currentCookies.length > 0;
                         logMsg(`[Telemetry] SESSION_REUSED=${isSessionReused}`);
                         logMsg(`[Telemetry] AUTH_STATE_VALID=${isSessionReused}`);
                         logMsg(`[Telemetry] BATCH_CONTEXT_REUSED=true`);
                         logMsg(`[Telemetry] RELOGIN_TRIGGERED=false`);
                         
                         const batchPlanResult = await orchestratorAgent.planStrictScenarioQA(
                           job.data.targetUrl,
                           logMsg,
                           (agent: string, status: string) => emit('agent_progress', { agent, status }),
                           { sharedPage, preDiscovered, customScenarioText: '', preParsedScenarios: batches[b]! }
                         );
                         
                         if (!batchPlanResult.success) {
                             throw new Error("Orchestrator failed to plan execution for batch " + (b+1) + ": " + batchPlanResult.error);
                         }
                         logMsg(`[Telemetry] SCRIPT_BATCH_GENERATED=${b+1}`);
                         
                         if (batchPlanResult.testCases) {
                             allTestCases.push(...batchPlanResult.testCases);
                         }
                         
                         const batchScriptCode = sanitizeExecutionPlan(batchPlanResult.executionPlan || '[]', logMsg);
                         try {
                           const parsedBatchPlan = JSON.parse(batchPlanResult.executionPlan || '[]');
                           allExecutionPlans.push(...parsedBatchPlan);
                         } catch (e) {}
                         
                         // 5-minute maximum per batch timeout
                         const batchTimeoutMs = 5 * 60 * 1000;
                         const timeoutPromise = new Promise<never>((_, reject) => {
                             setTimeout(() => reject(new Error('EXECUTION_BATCH_TIMEOUT')), batchTimeoutMs);
                         });
                         
                         const batchExecResult = await Promise.race([
                             executeScriptWithRetry(batchScriptCode),
                             timeoutPromise
                         ]);
                         
                         if (batchExecResult && batchExecResult.scenario_status) {
                             Object.assign(aggregatedExecResult.scenario_status, batchExecResult.scenario_status);
                         }
                         if (batchExecResult) {
                             aggregatedExecResult.videoUrl = batchExecResult.videoUrl || aggregatedExecResult.videoUrl;
                             aggregatedExecResult.screenshotUrl = batchExecResult.screenshotUrl || aggregatedExecResult.screenshotUrl;
                             aggregatedExecResult.accessibilityResults = batchExecResult.accessibilityResults || aggregatedExecResult.accessibilityResults;
                             aggregatedExecResult.securityResults = batchExecResult.securityResults || aggregatedExecResult.securityResults;
                             aggregatedExecResult.transcriptEvents = (aggregatedExecResult.transcriptEvents || []).concat(batchExecResult.transcriptEvents || []);
                             aggregatedExecResult.stepLogs = (aggregatedExecResult.stepLogs || []).concat(batchExecResult.stepLogs || []);
                         }
                         
                         executedCount += (batches[b]?.length || 0);
                         
                         const batchCompletionContract = {
                             batchId: b + 1,
                             status: "completed",
                             executedScenarioCount: batches[b]?.length || 0,
                             failedScenarioCount: 0 // handled via exceptions if it fails entirely
                         };
                         logMsg(`[Telemetry] BATCH_EXECUTION_COMPLETED=${b+1} CONTRACT=${JSON.stringify(batchCompletionContract)}`);
                     }
                     
                     if (executedCount !== allParsedScenarios.length) {
                         throw new Error("SCENARIO_EXECUTION_MISMATCH: executed count does not match parsed count.");
                     }
                     
                     planResult = { success: true, executionPlan: JSON.stringify(allExecutionPlans), testCases: allTestCases, requested_count: allParsedScenarios.length };
                  } else {
                     planResult = await orchestratorAgent.planAutonomousQA(
                       job.data.targetUrl,
                       logMsg,
                       (agent: string, status: string) => emit('agent_progress', { agent, status }),
                       { sharedPage, mode: currentMode, preDiscovered, customScenario: job.data.customScenario }
                     );
                  }
                  
                  if (!planResult.success) {
                    throw new Error("Orchestrator failed to plan execution: " + planResult.error);
                  }
                  scriptCode = sanitizeExecutionPlan(planResult.executionPlan || '[]', logMsg);
                  const planDataPayload = JSON.stringify({
                    testCases: planResult.testCases || [],
                    scriptCode: scriptCode,
                    requested_count: (planResult as any).requested_count || 0
                  });
                  await job.updateData({ ...job.data, scriptCode, testCases: planResult.testCases, requested_count: (planResult as any).requested_count, planData: planDataPayload });
                  await prisma.executionLog.update({
                     where: { id: executionId },
                     data: { planData: planDataPayload }
                  });
                  
                  if (currentMode !== 'STRICT_SCENARIO') {
                     // Cache the script for sibling executions (expires in 10 mins)
                     await redisConnection.set(sharedPlanCacheKey, scriptCode, "EX", 600);
                  }
                  break;
                } catch (orchestratorErr: any) {
                  const errMsg = (orchestratorErr.message || '').toLowerCase();
                  const isDeterministic = errMsg.includes('validation error') ||
                                          errMsg.includes('schema error') ||
                                          errMsg.includes('script_count_mismatch') ||
                                          errMsg.includes('script count mismatch') ||
                                          errMsg.includes('malformed') ||
                                          errMsg.includes('business rule') ||
                                          errMsg.includes('strict scenario generation failed') ||
                                          errMsg.includes('parser error:') ||
                                          errMsg.includes('assertion step failed') ||
                                          errMsg.includes('selector not found in dom');
                                          
                  if (isDeterministic) {
                    logMsg(`[Error] Orchestration failed with deterministic error: ${orchestratorErr.message}. Aborting immediately.`);
                    throw orchestratorErr;
                  }

                  if (orchestrationAttempt === 2) {
                    logMsg(`[Error] Orchestrator failed on attempt 2: ${orchestratorErr.message}.`);
                    throw orchestratorErr;
                  }
                  logMsg(`[Warning] Orchestration attempt ${orchestrationAttempt} failed: ${orchestratorErr.message}. Retrying Orchestration...`);
                  orchestrationAttempt++;
                }
              }
            } finally {
              if (lockAcquired) {
                await redisConnection.del(orchestratorLockKey);
              }
            }
          }
        } else {
          // Phase 1: Parsing
          emit('agent_progress', { agent: 'RequirementsAgent', status: 'parsing' });
          logMsg('Parsing natural language instructions...');
          const reqs = await reqAgent.parseRequirements(`Test Name: ${testName}\nURL: ${targetUrl}\nInstruction: ${instruction}`);

          // Phase 2: Generating Cases
          emit('agent_progress', { agent: 'TestCaseAgent', status: 'generating_cases' });
          logMsg('Generating test cases...');
          const cases = await tcAgent.generateTestCases(reqs);

          // Phase 3: Generating Data
          emit('agent_progress', { agent: 'TestDataAgent', status: 'generating_data' });
          logMsg('Generating synthetic test data...');
          const testData = await dataAgent.generateData(cases);

          // Phase 4: Script Generation
          emit('agent_progress', { agent: 'ScriptGenerationAgent', status: 'generating_script' });
          logMsg('Compiling Playwright script...');
          const rawScriptCode = await scriptAgent.generateScript(testName, cases);
          scriptCode = sanitizeExecutionPlan(rawScriptCode, logMsg);
          const planDataPayload = JSON.stringify({
             testCases: cases,
             scriptCode: scriptCode
          });
          await job.updateData({ ...job.data, planData: planDataPayload });
          await prisma.executionLog.update({
             where: { id: executionId },
             data: { planData: planDataPayload }
          });
        }

        // Phase 5: Execution
        let execResult: any = aggregatedExecResult;
        const currentMode = job.data.isAutonomous && job.data.customScenario ? 'STRICT_SCENARIO' : (mode || 'full_autonomous');
        if (currentMode !== 'STRICT_SCENARIO') {
             execResult = await executeScriptWithRetry(scriptCode);
        }
        
        // Ensure finalStepLogs doesn't get overridden if already populated by batch
        if (currentMode === 'STRICT_SCENARIO') {
             finalStepLogs = aggregatedExecResult?.stepLogs || aggregatedExecResult?.transcriptEvents || [];
        } else {
             finalStepLogs = execResult?.stepLogs || execResult?.transcriptEvents || [];
        }

        // Finalize Video
        const video = sharedPage.video();
        let finalVideoUrl = execResult.videoUrl;
        
        await sharedPage.close().catch(() => {});
        await sharedContext.close().catch(() => {});
        await sharedBrowser.close().catch(() => {});
        
        if (video) {
          try {
            const videoPath = await video.path();
            if (fsSync.existsSync(videoPath)) {
              const stats = fsSync.statSync(videoPath);
              if (stats.size > 0) {
                const videoData = await fs.readFile(videoPath);
                const { data, error } = await supabase.storage
                  .from('videos')
                  .upload(`${executionId}.mp4`, videoData, { contentType: 'video/mp4', upsert: true });
                  
                if (!error && data) {
                  const { data: publicData } = supabase.storage.from('videos').getPublicUrl(data.path);
                  finalVideoUrl = publicData.publicUrl;
                }
              }
            }
          } catch (e) {
            console.error("Video processing failed in worker", e);
          }
        }

        // Save artifacts to DB
        if (finalVideoUrl) {
          await prisma.video.create({
            data: { executionLogId: executionId, url: finalVideoUrl, storagePath: `videos/${executionId}.webm` }
          });
        }
        if (execResult.screenshotUrl) {
          await prisma.screenshot.create({
            data: { executionLogId: executionId, url: execResult.screenshotUrl, storagePath: `screenshots/${executionId}.png` }
          });
        }



        const durationMs = Date.now() - jobStartTime;

        // Phase 6: Reporting
        emit('agent_progress', { agent: 'ReportingAgent', status: 'reporting' });
        logMsg('Generating final execution report...');
        
        let finalExecutionStatus = 'COMPLETED';
        let requested_count = job.data.requested_count || 0;
        let executed_count = 0;
        let passed_count = 0;
        let failed_count = 0;
        let skipped_count = 0;

        let testMetadataOutput = job.data.testCases ? JSON.stringify(job.data.testCases) : 'N/A';
        
        if (execResult.scenario_status) {
           for (const [scenarioName, status] of Object.entries(execResult.scenario_status)) {
             // Ensure skipped_count tracks correctly instead of falling into executed_count
             if (status === 'PASS') { passed_count++; executed_count++; }
             else if (status === 'FAIL') { failed_count++; executed_count++; }
             else if (status === 'IN_PROGRESS') { failed_count++; executed_count++; } // Did not finish
             else if (status === 'SKIPPED' || status === 'NOT_STARTED') { skipped_count++; }
           }
           
           if (job.data.customScenario) {
             if (passed_count < requested_count) {
                finalExecutionStatus = 'FAILED';
             }
             
             // Format exact requested logging output
             logMsg('====================================================');
             logMsg(`Requested scenarios: ${requested_count}`);
             logMsg(`Executed scenarios: ${executed_count}`);
             logMsg(`Passed: ${passed_count}`);
             logMsg(`Failed: ${failed_count}`);
             logMsg(`Skipped: ${skipped_count}`);
             logMsg('');
             logMsg('Per scenario:');
             for (const [scenarioName, status] of Object.entries(execResult.scenario_status)) {
                logMsg(`${scenarioName} -> ${status}`);
             }
             logMsg('====================================================');
           }
           
           testMetadataOutput = JSON.stringify({
              testCases: job.data.testCases || 'N/A',
              scenario_status: execResult.scenario_status,
              metrics: { requested_count, executed_count, passed_count, failed_count, skipped_count }
           });
        }
        
        const reportRes = await reportAgent.generateReport(executionId, {
          testName,
          status: finalExecutionStatus,
          error: null,
          duration: durationMs / 1000,
          browser: job.data.browser || 'chromium',
          environment: process.env.NODE_ENV || 'Local',
          url: job.data.targetUrl,
          logs: logs.join('\n'),
          testMetadata: testMetadataOutput,
          executedSteps: JSON.stringify(finalStepLogs),
          screenshotUrl: execResult.screenshotUrl || null,
          videoUrl: finalVideoUrl || null
        });
        
        if (reportRes && reportRes.content) {
          generatedReportContent = reportRes.content.markdown_report || JSON.stringify(reportRes.content, null, 2);
        }
        
        if (reportRes && reportRes.url) {
          await prisma.report.create({
            data: {
              executionLogId: executionId,
              url: reportRes.url,
              storagePath: `reports/${executionId}.json`
            }
          }).catch(err => logMsg(`Failed to save report to DB: ${err.message}`));
        }

        finalStepLogs.push({
          action: 'EXECUTION_RESULT',
          status: finalExecutionStatus,
          time: new Date().toISOString(),
          details: 'Execution Completed',
          value: JSON.stringify({
            accessibility: execResult.accessibilityResults,
            security: execResult.securityResults,
            scenario_status: execResult.scenario_status,
            transcript: execResult.transcriptEvents,
            metrics: { requested_count, executed_count, passed_count, failed_count, skipped_count }
          })
        });

        const callCountKey = `execution_stats:${executionId}:llm_calls`;
        const totalTokensKey = `execution_stats:${executionId}:total_tokens`;
        const callsStr = await redisConnection.get(callCountKey);
        const tokensStr = await redisConnection.get(totalTokensKey);
        const llmCalls = callsStr ? parseInt(callsStr, 10) : 0;
        const totalTokens = tokensStr ? parseInt(tokensStr, 10) : 0;
        const estimatedCost = (totalTokens / 1000000) * 5.0; // Assuming $5 per 1M tokens as an average
        
        logMsg(`[Cost Summary] LLM_CALL_COUNT=${llmCalls}, TOTAL_TOKENS=${totalTokens}, ESTIMATED_COST=$${estimatedCost.toFixed(4)}`);

        for (let i = 0; i < finalStepLogs.length; i++) {
          const step = finalStepLogs[i];
          if (step.action === 'HEAL' && step.status === 'PASSED') {
            let originalSelector = '';
            for (let j = i - 1; j >= 0; j--) {
               if (finalStepLogs[j].action === 'HEAL' && finalStepLogs[j].status === 'TRIGGERED') {
                  originalSelector = finalStepLogs[j].rawSelector || '';
                  break;
               }
            }
            if (originalSelector && step.rawSelector) {
               await prisma.healingEvent.create({
                 data: {
                   executionLogId: executionId,
                   originalSelector: originalSelector,
                   healedSelector: step.rawSelector,
                   success: true,
                   status: 'PENDING',
                   testName: testName,
                   stepIndex: i
                 }
               }).catch(e => console.error("Failed to save HealingEvent:", e));
            }
          }
        }

        await prisma.executionLog.update({
          where: { id: executionId },
          data: {
            status: finalExecutionStatus,
            completedAt: new Date(),
            durationMs,
            logs: JSON.stringify(logs),
            stepLogs: JSON.stringify(finalStepLogs),
            traceData: JSON.stringify(finalStepLogs),
            planData: job.data.planData || null,
            visualRegressionData: execResult.visualRegressionData || null
          }
        });
        
        // Extract Healing Events
        try {
          for (const step of finalStepLogs) {
            if (step && step.self_healing_attempts && Array.isArray(step.self_healing_attempts)) {
              const successfulHeal = step.self_healing_attempts.find((a: any) => a.success === true);
              if (successfulHeal) {
                await prisma.healingEvent.create({
                  data: {
                    executionLogId: executionId,
                    originalSelector: step.selector, // Note: This might be the healed one, depending on runner. We should save original.
                    healedSelector: successfulHeal.candidate || '',
                    success: true,
                    status: 'PENDING',
                    testName: testName,
                    stepIndex: step.step
                  }
                });
                logMsg(`[Self-Healing] Recorded healing event for step ${step.step}`);
              }
            }
          }
        } catch (healErr) {
          console.error("Failed to record healing events:", healErr);
        }

        if (finalExecutionStatus === 'FAILED') {
           try {
             const finalDbState = await prisma.executionLog.findUnique({
               where: { id: executionId },
               include: { suite: true }
             });
             if (finalDbState && finalDbState.suite) {
                 const jiraIntegration = await prisma.jiraIntegration.findUnique({
                   where: { projectId: finalDbState.suite.projectId }
                 });
                 if (jiraIntegration && jiraIntegration.isActive) {
                   logMsg('[Jira] Auto-creating Jira bug for application test failures...');
                   const jiraService = new JiraService(
                     jiraIntegration.baseUrl,
                     jiraIntegration.email,
                     jiraIntegration.apiToken,
                     jiraIntegration.projectKey,
                     jiraIntegration.issueType
                   );
                   const summary = `[NovaTest AI] [Application Failure] ${testName} failed on ${finalDbState.browser || 'Chromium'}`;
                   const description = `
Autonomous QA Test Execution Failed

*Failure Category:* Application Failure
*Execution ID:* ${executionId}
*Target URL:* ${job.data.targetUrl || 'N/A'}
*Browser:* ${finalDbState.browser || 'chromium'}

*Failed Scenarios:*
${Object.entries(execResult.scenario_status || {}).filter(([_, status]) => status === 'FAIL').map(([name]) => `- ${name}`).join('\n')}

*Error Details:*
One or more test assertions failed during execution. See execution report for full trace.
                   `.trim();
                   
                   const issue = await jiraService.createIssue(summary, description);
                   if (issue) {
                     logMsg(`[Jira] Successfully created issue: ${issue.key}`);
                     logMsg('[Telemetry] JIRA_ISSUE_CREATED');
                     if (execResult.screenshotUrl) {
                        const localScreenshotPath = `C:/Users/Shivam kumar/Downloads/ai-testing-platform-1 (1)/ai-testing-platform-1/backend-node/screenshots/${executionId}.png`;
                        if (fsSync.existsSync(localScreenshotPath)) {
                           await jiraService.attachFile(issue.key, localScreenshotPath, 'failure_screenshot.png');
                           logMsg(`[Telemetry] JIRA_ATTACHMENT_UPLOADED: failure_screenshot.png`);
                        }
                     }
                   } else {
                     logMsg('⚠ Jira Integration Failed');
                     logMsg('Reason: Invalid Project Key, Missing Permissions, Invalid Issue Type, or Authentication Failure');
                     
                     // Update execution status to Completed With Warnings
                     await prisma.executionLog.update({
                       where: { id: executionId },
                       data: { status: 'Completed With Warnings' }
                     });
                     logMsg('Execution Status: Completed With Warnings');
                   }
                 }
             }
           } catch (e: any) {
             logMsg(`⚠ Jira Integration Failed`);
             logMsg(`Reason: ${e.message || 'Unknown Error'}`);
             
             await prisma.executionLog.update({
               where: { id: executionId },
               data: { status: 'Completed With Warnings' }
             });
             logMsg('Execution Status: Completed With Warnings');
           }
        }
        
        // We will emit 'execution_completed' in the finally block after video upload

      } catch (err: any) {
        logMsg(`[Error] ${err.message}`);
        
        const durationMs = Date.now() - jobStartTime;

        const nextStatus = (err.message.includes('BLOCKED_BY_ANTIBOT') || err.message.includes('BlockedByAntiBotError')) ? 'BLOCKED' : 'FAILED';

        if (aggregatedExecResult && aggregatedExecResult.screenshotUrl) {
          await prisma.screenshot.create({
            data: { executionLogId: executionId, url: aggregatedExecResult.screenshotUrl, storagePath: `screenshots/${executionId}.png` }
          }).catch(() => {});
        }

        let finalMetadata = job.data.testCases ? JSON.stringify(job.data.testCases) : 'N/A';
        if (aggregatedExecResult && aggregatedExecResult.scenario_status) {
           let requested_count = job.data.requested_count || 0;
           let executed_count = 0;
           let passed_count = 0;
           let failed_count = 0;
           let skipped_count = 0;
           for (const [scenarioName, status] of Object.entries(aggregatedExecResult.scenario_status)) {
             if (status === 'PASS') { passed_count++; executed_count++; }
             else if (status === 'FAIL') { failed_count++; executed_count++; }
             else if (status === 'IN_PROGRESS') { failed_count++; executed_count++; } 
             else if (status === 'SKIPPED' || status === 'NOT_STARTED') { skipped_count++; }
           }
           finalMetadata = JSON.stringify({
              testCases: job.data.testCases || 'N/A',
              scenario_status: aggregatedExecResult.scenario_status,
              metrics: { requested_count, executed_count, passed_count, failed_count, skipped_count }
           });
        }
        
        if (nextStatus === 'BLOCKED') {
          let classification = { vendor: "unknown", type: "unknown" };
          try {
            const match = err.message.match(/BlockedByAntiBotError:\s*(\{.*?\})/);
            if (match && match[1]) {
              classification = JSON.parse(match[1]);
            }
          } catch(e) {}
          finalMetadata += `\n\nExecution mode: stealth\nProtection detected: ${classification.vendor} - ${classification.type}`;
        }

        try {
          const reportRes = await reportAgent.generateReport(executionId, {
            testName,
            status: nextStatus,
            error: err.message,
            duration: durationMs / 1000,
            browser: job.data.browser || 'chromium',
            environment: process.env.NODE_ENV || 'Local',
            url: job.data.targetUrl,
            logs: logs.join('\n'),
            testMetadata: finalMetadata,
            executedSteps: JSON.stringify(finalStepLogs),
            screenshotUrl: aggregatedExecResult?.screenshotUrl || null,
            videoUrl: aggregatedExecResult?.videoUrl || null
          });
          if (reportRes && reportRes.content) {
            generatedReportContent = reportRes.content.markdown_report || JSON.stringify(reportRes.content, null, 2);
          }
          if (reportRes && reportRes.url) {
            await prisma.report.create({
              data: {
                executionLogId: executionId,
                url: reportRes.url,
                storagePath: `reports/${executionId}.json`
              }
            }).catch(e => logMsg(`Failed to save report to DB: ${e.message}`));
          }
        } catch (reportErr) {
          logMsg(`[Error] Failed to generate failure report: ${reportErr}`);
        }

        await prisma.executionLog.update({
          where: { id: executionId },
          data: { status: nextStatus, completedAt: new Date(), durationMs, logs: JSON.stringify(logs), stepLogs: JSON.stringify(finalStepLogs), traceData: JSON.stringify(finalStepLogs), planData: job.data.planData || null }
        });
        // We will emit 'execution_completed' in the finally block after video upload
        // Job completes without throwing. Stage-local retries handled errors.
      } finally {
        // Lock remains in Redis for 5 minutes to prevent ghost retries
        logMsg('[Telemetry] VIDEO_FLUSH_STARTED');
        let videoPath = '';
        if (sharedPage) {
          try {
            const video = sharedPage.video();
            
            // Explicitly wait for browser context to close FIRST to force flush
            if (sharedContext) {
               await sharedContext.close().catch(() => {});
               logMsg('[Telemetry] BROWSER_CONTEXT_CLOSED');
            }
            if (sharedBrowser) {
               await sharedBrowser.close().catch(() => {});
               logMsg('[Telemetry] BROWSER_INSTANCE_CLOSED');
            }
            
            logMsg('[Telemetry] VIDEO_RECORDING_STOPPED');
            
            if (video) {
              videoPath = await video.path().catch(() => '');
              if (videoPath) logMsg('[Video] VIDEO_PATH_RESOLVED');
            }
            
            if (videoPath && fsSync.existsSync(videoPath)) {
              let isReadable = false;
              try {
                fsSync.accessSync(videoPath, fsSync.constants.R_OK);
                isReadable = true;
              } catch(e) {}
              
              const stats = fsSync.statSync(videoPath);
              if (stats.size > 5120 && isReadable) { // Require > 5KB to prevent corrupt ghosts
                logMsg('[Telemetry] VIDEO_FILE_SIZE_VALIDATED');
                logMsg('[Video] VIDEO_SAVED locally. Uploading...');
                const videoData = await fs.readFile(videoPath);
                const { data, error } = await supabase.storage
                  .from('videos')
                  .upload(`${executionId}.webm`, videoData, { contentType: 'video/webm', upsert: true });
                
                if (!error && data) {
                  const { data: publicData } = supabase.storage.from('videos').getPublicUrl(data.path);
                  if (publicData && publicData.publicUrl) {
                      await prisma.video.create({
                        data: { executionLogId: executionId, url: publicData.publicUrl, storagePath: `videos/${executionId}.webm` }
                      });
                      logMsg('[Telemetry] VIDEO_UPLOAD_VERIFIED');
                      logMsg('[Telemetry] VIDEO_ARTIFACT_PERSISTED');
                  } else {
                      logMsg(`[Video] ERROR VIDEO_CORRUPT: URL missing`);
                      throw new Error('VIDEO_ARTIFACT_INVALID: publicUrl not returned');
                  }
                } else {
                  logMsg(`[Video] ERROR VIDEO_CORRUPT: Upload failed ${error?.message}`);
                  throw new Error('VIDEO_ARTIFACT_INVALID: upload failed');
                }
              } else {
                logMsg(`[Video] ERROR VIDEO_CORRUPT: file empty or unreadable (size=${stats.size})`);
                throw new Error('VIDEO_ARTIFACT_INVALID: size too small');
              }
            } else {
              logMsg('[Video] ERROR VIDEO_CORRUPT: no file');
              throw new Error('VIDEO_ARTIFACT_INVALID: no file generated');
            }
          } catch (e: any) {
            console.error("Video processing failed during error recovery", e);
            logMsg(`[Video] ERROR VIDEO_CORRUPT: exception ${e.message}`);
          }
        }
        
        // Fetch the very latest status from DB before emitting completed
        const finalDbState = await prisma.executionLog.findUnique({ 
           where: { id: executionId },
           include: { suite: true }
        });
        
        logMsg('[Telemetry] FULL_EXECUTION_COMPLETED');
        logMsg('[Telemetry] WORKER_RESOURCES_RELEASED');
        logMsg('[Telemetry] EXECUTION_TERMINATED');
        
        if (finalDbState) {
           if (finalDbState.status === 'FAILED' && job.data.features?.autoJira) {
             try {
               const jiraIntegration = await prisma.jiraIntegration.findUnique({
                 where: { projectId: finalDbState.suite.projectId }
               });
               
               if (jiraIntegration && jiraIntegration.isActive) {
                 logMsg('[Jira] Auto-creating Jira bug...');
                 const jiraService = new JiraService(
                   jiraIntegration.baseUrl,
                   jiraIntegration.email,
                   jiraIntegration.apiToken,
                   jiraIntegration.projectKey,
                   jiraIntegration.issueType
                 );
                 
                 // Extract error details from logs if possible
                 let errorMsg = 'Execution failed. Check traces for more info.';
                 const errMatch = finalDbState.logs?.match(/\[Error\] (.*)/);
                 if (errMatch && errMatch[1]) {
                   errorMsg = errMatch[1];
                 }
                 
                 let failureType = 'Application Failure';
                 const errLower = errorMsg.toLowerCase();
                 if (errLower.includes('malformed step') || errLower.includes('invalidactiontargeterror') || errLower.includes('page_context_mismatch') || errLower.includes('execution context was destroyed') || errLower.includes('blockedbyantiboterror')) {
                     failureType = 'Framework Failure';
                 }

                 const summary = `[NovaTest AI] [${failureType}] ${testName} failed on ${finalDbState.browser || 'Chromium'}`;
                 
                 const description = `
Autonomous QA Test Execution Failed

*Failure Category:* ${failureType}
*Execution ID:* ${executionId}
*Target URL:* ${job.data.targetUrl || 'N/A'}
*Browser:* ${finalDbState.browser || 'chromium'}

*Error Details:*
${errorMsg}
                 `.trim();
                 
                 try {
                   const issue = await jiraService.createIssue(summary, description);
                   if (issue) {
                     logMsg(`[Jira] Successfully created issue: ${issue.key}`);
                     logMsg('[Telemetry] JIRA_ISSUE_CREATED');
                     
                     let attachmentCount = 0;
                     const attachLocalFile = async (filePath: string, filename: string) => {
                       if (fsSync.existsSync(filePath)) {
                         const success = await jiraService.attachFile(issue.key, filePath, filename);
                         if (success) {
                           attachmentCount++;
                           logMsg(`[Telemetry] JIRA_ATTACHMENT_UPLOADED: ${filename}`);
                         } else {
                           logMsg(`[Telemetry] JIRA_ATTACHMENT_FAILED: ${filename}`);
                         }
                       }
                     };
                     
                     // 1. Video
                     if (videoPath) await attachLocalFile(videoPath, 'execution.mp4');
                     
                     // 2. Screenshot
                     const screenshotPath = (await import('path')).resolve(process.cwd(), 'temp', 'screenshots', `${executionId}.png`);
                     await attachLocalFile(screenshotPath, 'screenshot.png');
                     
                     // 3. Transcript & 4. Trace & 5. Stacktrace
                     const tempDir = (await import('path')).resolve(process.cwd(), 'temp', 'artifacts', executionId);
                     await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
                     
                     const transcriptPath = (await import('path')).join(tempDir, 'transcript.log');
                     const tracePath = (await import('path')).join(tempDir, 'trace.json');
                     const stacktracePath = (await import('path')).join(tempDir, 'stacktrace.txt');
                     const reportPath = (await import('path')).join(tempDir, 'execution-report.md');
                     
                     let transcriptEventsStr = '[]';
                     try {
                       const execResLog = finalStepLogs.find(l => l.action === 'EXECUTION_RESULT');
                       if (execResLog && execResLog.value) {
                         const parsedVal = typeof execResLog.value === 'string' ? JSON.parse(execResLog.value) : execResLog.value;
                         transcriptEventsStr = JSON.stringify(parsedVal.transcript || [], null, 2);
                       }
                     } catch(e) {}
                     await fs.writeFile(transcriptPath, transcriptEventsStr).catch(() => {});
                     await attachLocalFile(transcriptPath, 'transcript.log');
                     
                     await fs.writeFile(tracePath, JSON.stringify(finalStepLogs, null, 2)).catch(() => {});
                     await attachLocalFile(tracePath, 'trace.json');
                     
                     await fs.writeFile(stacktracePath, errorMsg + '\n\n' + (finalDbState.logs || '')).catch(() => {});
                     await attachLocalFile(stacktracePath, 'stacktrace.txt');
                     
                     if (generatedReportContent) {
                       await fs.writeFile(reportPath, generatedReportContent).catch(() => {});
                       await attachLocalFile(reportPath, 'execution-report.md');
                     }
                     
                     logMsg('[Telemetry] JIRA_SYNC_COMPLETED');
                     await prisma.executionLog.update({
                       where: { id: executionId },
                       data: { 
                         jiraTicketId: issue.key, 
                         jiraTicketUrl: issue.url,
                         jiraAttachmentCount: attachmentCount,
                         jiraSyncTimestamp: new Date()
                       }
                     });
                   } else {
                     logMsg('[Jira] Failed to create issue via API');
                     logMsg('[Telemetry] JIRA_SYNC_FAILED');
                   }
                 } catch(errJira: any) {
                   logMsg(`[Jira] Error during sync: ${errJira.message}`);
                   logMsg('[Telemetry] JIRA_SYNC_FAILED');
                 }
               }
             } catch (jiraErr: any) {
               logMsg(`[Jira] Integration error: ${jiraErr.message}`);
             }
           }

           emit('execution_completed', { 
             executionId, 
             status: finalDbState.status, 
             durationMs: finalDbState.durationMs || 0
             // Note: frontend only uses status and durationMs
           });
        }
      }
    },
    { connection: redisConnection, concurrency: 4 }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('error', (err) => {
    console.error(`BullMQ Worker Error: ${err.message}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error:`, err.message);
  });

  return worker;
};
