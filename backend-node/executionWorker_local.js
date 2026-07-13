"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initExecutionWorker = exports.executionQueue = exports.executionQueueName = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../lib/redis"));
const prismaClient_1 = __importDefault(require("../prismaClient"));
const playwright_1 = require("playwright");
const promises_1 = __importDefault(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const storage_1 = require("../utils/storage");
const RequirementsAgent_1 = require("../agents/RequirementsAgent");
const TestCaseAgent_1 = require("../agents/TestCaseAgent");
const TestDataAgent_1 = require("../agents/TestDataAgent");
const sanitizer_1 = require("../utils/sanitizer");
const ScriptGenerationAgent_1 = require("../agents/ScriptGenerationAgent");
const ExecutionAgent_1 = require("../agents/ExecutionAgent");
const ReportingAgent_1 = require("../agents/ReportingAgent");
const OrchestratorAgent_1 = require("../agents/OrchestratorAgent");
exports.executionQueueName = 'test-executions';
async function cleanupInterruptedJobs() {
    try {
        const interruptedJobs = await prismaClient_1.default.executionLog.updateMany({
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
    }
    catch (error) {
        console.error('[Worker Crash Safety] Failed to clean up interrupted jobs:', error);
    }
}
exports.executionQueue = new bullmq_1.Queue(exports.executionQueueName, {
    connection: redis_1.default,
});
const initExecutionWorker = (io) => {
    cleanupInterruptedJobs();
    const worker = new bullmq_1.Worker(exports.executionQueueName, async (job) => {
        console.log(`WORKER_PICKED_JOB: ${job.data.executionId}`);
        const { executionId, testName, instruction, targetUrl, browser, mode } = job.data;
        const emit = (type, payload) => {
            io.to(executionId).emit(type, payload);
        };
        const jobStartTime = Date.now();
        console.log(`EXECUTION_STARTED: ${job.data.executionId}`);
        emit('queued', { message: 'Job accepted by worker' });
        let logs = [];
        let finalStepLogs = [];
        const logMsg = (msg) => {
            logs.push(msg);
            emit('browser_log', { message: msg });
        };
        logMsg(`[Execution Claim] EXECUTION_CLAIM_ATTEMPT`);
        const claimResult = await prismaClient_1.default.executionLog.updateMany({
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
        const activeExecution = await prismaClient_1.default.executionLog.findUnique({ where: { id: executionId } });
        const reqAgent = new RequirementsAgent_1.RequirementsAgent(executionId);
        const tcAgent = new TestCaseAgent_1.TestCaseAgent(executionId);
        const dataAgent = new TestDataAgent_1.TestDataAgent();
        const scriptAgent = new ScriptGenerationAgent_1.ScriptGenerationAgent(executionId);
        const execAgent = new ExecutionAgent_1.ExecutionAgent();
        const reportAgent = new ReportingAgent_1.ReportingAgent();
        const orchestratorAgent = new OrchestratorAgent_1.OrchestratorAgent(executionId);
        let sharedBrowser = null;
        let sharedContext = null;
        let sharedPage = null;
        try {
            let isOrchestrator = false;
            let scriptCode = '';
            let preDiscovered = null;
            logMsg('Initializing shared browser for full pipeline video recording...');
            const browserName = browser || 'chromium';
            if (browserName === 'firefox') {
                sharedBrowser = await playwright_1.firefox.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
            }
            else if (browserName === 'webkit') {
                sharedBrowser = await playwright_1.webkit.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
            }
            else {
                sharedBrowser = await playwright_1.chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled', '--disable-web-security'] });
            }
            const path = await Promise.resolve().then(() => __importStar(require('path')));
            const videoDir = path.resolve(process.cwd(), 'temp', 'videos', executionId);
            const screenshotDir = path.resolve(process.cwd(), 'temp', 'screenshots');
            await promises_1.default.mkdir(videoDir, { recursive: true });
            await promises_1.default.mkdir(screenshotDir, { recursive: true });
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
            const contextId = sharedContext._guid || 'unknown-context';
            const pageId = sharedPage._guid || 'unknown-page';
            logMsg(`[Video] VIDEO_CONTEXT_CREATED: ${contextId}`);
            logMsg(`[Video] VIDEO_PAGE_CREATED: ${pageId}`);
            logMsg(`[Video] VIDEO_RECORDING_STARTED`);
            sharedPage.on('console', (msg) => logMsg(`Console [${msg.type()}]: ${msg.text()}`));
            sharedPage.on('pageerror', (error) => logMsg(`Page Error: ${error.message}`));
            if (job.data.steps) {
                logMsg('[PLAN SOURCE: explicit_override] Direct steps provided. Skipping AI generation phases...');
                scriptCode = typeof job.data.steps === 'string' ? job.data.steps : JSON.stringify(job.data.steps);
            }
            else if (job.data.scriptCode && !job.data.isAutonomous) {
                logMsg('[PLAN SOURCE: explicit_override] Retry detected: Bypassing AI Orchestration and using previously generated script...');
                scriptCode = (0, sanitizer_1.sanitizeExecutionPlan)(job.data.scriptCode, logMsg);
            }
            else if (job.data.isAutonomous) {
                let currentMode = mode || 'full_autonomous';
                if (job.data.customScenario) {
                    currentMode = 'STRICT_SCENARIO';
                }
                const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
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
                        const cachedPlan = await redis_1.default.get(sharedPlanCacheKey);
                        if (cachedPlan) {
                            logMsg('[PLAN SOURCE: cache_reuse] Reusing Autonomous script generated by sibling execution...');
                            scriptCode = (0, sanitizer_1.sanitizeExecutionPlan)(cachedPlan, logMsg);
                            isOrchestrator = false;
                            break;
                        }
                        lockAcquired = (await redis_1.default.set(orchestratorLockKey, "LOCKED", "EX", 300, "NX")) !== null;
                        if (!lockAcquired) {
                            logMsg('Waiting for sibling execution to finish Autonomous orchestration...');
                            await new Promise(r => setTimeout(r, 2000));
                            orchestrationWaitAttempts++;
                        }
                    }
                    if (!lockAcquired && isOrchestrator) {
                        logMsg('[Warning] Sibling orchestration timed out. Proceeding with independent generation.');
                    }
                }
                else {
                    // In STRICT_SCENARIO, we do not share or reuse sibling plans. 
                    // We run generation specifically for this user's strict scenario array.
                    isOrchestrator = true;
                }
                if (isOrchestrator) {
                    try {
                        emit('agent_progress', { agent: 'DiscoveryAgent', status: 'validating_cache' });
                        logMsg('Running DiscoveryAgent to generate DOM signature and capabilities for cache validation...');
                        const { DiscoveryAgent } = await Promise.resolve().then(() => __importStar(require('../agents/DiscoveryAgent')));
                        const discoveryAgent = new DiscoveryAgent(executionId);
                        const discoveryResult = await discoveryAgent.discoverFlows(job.data.targetUrl, 3, { sharedPage, discoveryPath: 'cache_validation' });
                        const capabilityMap = await discoveryAgent.detectCapabilities(discoveryResult.domSummary);
                        let fingerprintData = capabilityMap;
                        if (currentMode !== 'basic' && currentMode !== 'STRICT_SCENARIO') {
                            const { CapabilityAnalyzerAgent } = await Promise.resolve().then(() => __importStar(require('../agents/CapabilityAnalyzerAgent')));
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
                                    planResult = await orchestratorAgent.planStrictScenarioQA(job.data.targetUrl, logMsg, (agent, status) => emit('agent_progress', { agent, status }), { sharedPage, preDiscovered, customScenarioText: job.data.customScenario });
                                }
                                else {
                                    planResult = await orchestratorAgent.planAutonomousQA(job.data.targetUrl, logMsg, (agent, status) => emit('agent_progress', { agent, status }), { sharedPage, mode: currentMode, preDiscovered, customScenario: job.data.customScenario });
                                }
                                if (!planResult.success) {
                                    throw new Error("Orchestrator failed to plan execution: " + planResult.error);
                                }
                                scriptCode = (0, sanitizer_1.sanitizeExecutionPlan)(planResult.executionPlan || '[]', logMsg);
                                await job.updateData({ ...job.data, scriptCode, testCases: planResult.testCases, requested_count: planResult.requested_count });
                                if (currentMode !== 'STRICT_SCENARIO') {
                                    // Cache the script for sibling executions (expires in 10 mins)
                                    await redis_1.default.set(sharedPlanCacheKey, scriptCode, "EX", 600);
                                }
                                break;
                            }
                            catch (orchestratorErr) {
                                const errMsg = (orchestratorErr.message || '').toLowerCase();
                                const isDeterministic = errMsg.includes('validation error') ||
                                    errMsg.includes('schema error') ||
                                    errMsg.includes('script_count_mismatch') ||
                                    errMsg.includes('script count mismatch') ||
                                    errMsg.includes('malformed') ||
                                    errMsg.includes('business rule') ||
                                    errMsg.includes('strict scenario generation failed') ||
                                    errMsg.includes('parser error:');
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
                    }
                    finally {
                        if (lockAcquired) {
                            await redis_1.default.del(orchestratorLockKey);
                        }
                    }
                }
            }
            else {
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
                scriptCode = (0, sanitizer_1.sanitizeExecutionPlan)(rawScriptCode, logMsg);
            }
            // Phase 5: Execution
            let execResult;
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    emit('agent_progress', { agent: 'ExecutionAgent', status: attempt > 1 ? `retrying (Attempt ${attempt})` : 'executing' });
                    execResult = await execAgent.executeScript(executionId, scriptCode, browser || 'chromium', (type, msg) => {
                        if (type === 'browser_log')
                            logMsg(`[Playwright] ${msg}`);
                        else
                            emit(type, { message: msg });
                    }, {
                        accessibility: job.data.features?.accessibility || false,
                        security: job.data.features?.security || false,
                        sharedPage: sharedPage
                    }, (frame) => {
                        io.to(executionId).emit('live_frame', { executionId, frame });
                    });
                    if (execResult && execResult.stepLogs) {
                        finalStepLogs = execResult.stepLogs;
                    }
                    if (!execResult.success) {
                        throw new Error(execResult.error || 'Execution failed');
                    }
                    break; // Success, exit retry loop
                }
                catch (e) {
                    if (attempt === 2)
                        throw e;
                    const errMsg = e.message || '';
                    if (errMsg.includes('Selector not found') || errMsg.includes('Execution failed after recovery attempts') || errMsg.includes('Assertion failed') || errMsg.includes('ActionTypeMismatchError') || errMsg.includes('WrongPageError')) {
                        logMsg(`[Error] Execution failed due to deterministic script/selector error: ${errMsg}. Invalidating script cache to force replan on next attempt.`);
                        if (job.data.isAutonomous) {
                            const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
                            const urlHash = crypto.createHash('md5').update(job.data.targetUrl).digest('hex');
                            const cacheKeySuffix = `${activeExecution?.suiteId || 'default'}:${urlHash}`;
                            await redis_1.default.del(`suite_script:${cacheKeySuffix}`);
                            await redis_1.default.del(`suite_fingerprint:${cacheKeySuffix}`);
                            await job.updateData({ ...job.data, scriptCode: undefined });
                        }
                        throw e;
                    }
                    logMsg(`[Warning] Execution attempt ${attempt} failed: ${e.message}. Retrying execution phase locally...`);
                    // Cleanly rotate browser context
                    const video = sharedPage.video();
                    await sharedPage.close().catch(() => { });
                    await sharedContext.close().catch(() => { });
                    // Upload intermediate video if it exists so we don't lose it
                    if (video) {
                        try {
                            const videoPath = await video.path();
                            if (fsSync.existsSync(videoPath) && fsSync.statSync(videoPath).size > 0) {
                                const videoData = await promises_1.default.readFile(videoPath);
                                await storage_1.supabase.storage.from('videos').upload(`${executionId}_attempt${attempt}.mp4`, videoData, { contentType: 'video/mp4', upsert: true });
                            }
                        }
                        catch (vidErr) { }
                    }
                    // Re-create context and page for retry
                    const videoDir = `./temp/videos/${executionId}`;
                    sharedContext = await sharedBrowser.newContext({
                        recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
                        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) }
                    });
                    await sharedContext.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    });
                    sharedPage = await sharedContext.newPage();
                    sharedPage.on('console', (msg) => logMsg(`Console [${msg.type()}]: ${msg.text()}`));
                    sharedPage.on('pageerror', (error) => logMsg(`Page Error: ${error.message}`));
                }
            }
            finalStepLogs = execResult.stepLogs || [];
            // Finalize Video
            const video = sharedPage.video();
            let finalVideoUrl = execResult.videoUrl;
            await sharedPage.close().catch(() => { });
            await sharedContext.close().catch(() => { });
            await sharedBrowser.close().catch(() => { });
            if (video) {
                try {
                    const videoPath = await video.path();
                    if (fsSync.existsSync(videoPath)) {
                        const stats = fsSync.statSync(videoPath);
                        if (stats.size > 0) {
                            const videoData = await promises_1.default.readFile(videoPath);
                            const { data, error } = await storage_1.supabase.storage
                                .from('videos')
                                .upload(`${executionId}.mp4`, videoData, { contentType: 'video/mp4', upsert: true });
                            if (!error && data) {
                                const { data: publicData } = storage_1.supabase.storage.from('videos').getPublicUrl(data.path);
                                finalVideoUrl = publicData.publicUrl;
                            }
                        }
                    }
                }
                catch (e) {
                    console.error("Video processing failed in worker", e);
                }
            }
            // Save artifacts to DB
            if (finalVideoUrl) {
                await prismaClient_1.default.video.create({
                    data: { executionLogId: executionId, url: finalVideoUrl, storagePath: `videos/${executionId}.webm` }
                });
            }
            if (execResult.screenshotUrl) {
                await prismaClient_1.default.screenshot.create({
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
                    if (status === 'PASS') {
                        passed_count++;
                        executed_count++;
                    }
                    else if (status === 'FAIL') {
                        failed_count++;
                        executed_count++;
                    }
                    else if (status === 'IN_PROGRESS') {
                        failed_count++;
                        executed_count++;
                    } // Did not finish
                    else if (status === 'SKIPPED' || status === 'NOT_STARTED') {
                        skipped_count++;
                    }
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
            await reportAgent.generateReport(executionId, {
                testName,
                status: finalExecutionStatus,
                error: null,
                duration: durationMs / 1000,
                logs: logs.join('\n'),
                testMetadata: testMetadataOutput
            });
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
            const callsStr = await redis_1.default.get(callCountKey);
            const tokensStr = await redis_1.default.get(totalTokensKey);
            const llmCalls = callsStr ? parseInt(callsStr, 10) : 0;
            const totalTokens = tokensStr ? parseInt(tokensStr, 10) : 0;
            const estimatedCost = (totalTokens / 1000000) * 5.0; // Assuming $5 per 1M tokens as an average
            logMsg(`[Cost Summary] LLM_CALL_COUNT=${llmCalls}, TOTAL_TOKENS=${totalTokens}, ESTIMATED_COST=$${estimatedCost.toFixed(4)}`);
            await prismaClient_1.default.executionLog.update({
                where: { id: executionId },
                data: {
                    status: finalExecutionStatus,
                    completedAt: new Date(),
                    durationMs,
                    logs: JSON.stringify(logs),
                    stepLogs: JSON.stringify(finalStepLogs)
                }
            });
            // We will emit 'execution_completed' in the finally block after video upload
        }
        catch (err) {
            logMsg(`[Error] ${err.message}`);
            const durationMs = Date.now() - jobStartTime;
            const nextStatus = (err.message.includes('BLOCKED_BY_ANTIBOT') || err.message.includes('BlockedByAntiBotError')) ? 'BLOCKED' : 'FAILED';
            let finalMetadata = job.data.testCases ? JSON.stringify(job.data.testCases) : 'N/A';
            if (nextStatus === 'BLOCKED') {
                let classification = { vendor: "unknown", type: "unknown" };
                try {
                    const match = err.message.match(/BlockedByAntiBotError:\s*(\{.*?\})/);
                    if (match && match[1]) {
                        classification = JSON.parse(match[1]);
                    }
                }
                catch (e) { }
                finalMetadata += `\n\nExecution mode: stealth\nProtection detected: ${classification.vendor} - ${classification.type}`;
            }
            // Report on failure
            try {
                await reportAgent.generateReport(executionId, {
                    testName,
                    status: nextStatus,
                    error: err.message,
                    duration: durationMs / 1000,
                    logs: logs.join('\n'),
                    testMetadata: finalMetadata
                });
            }
            catch (reportErr) {
                logMsg(`[Error] Failed to generate failure report: ${reportErr}`);
            }
            await prismaClient_1.default.executionLog.update({
                where: { id: executionId },
                data: { status: nextStatus, completedAt: new Date(), durationMs, logs: JSON.stringify(logs), stepLogs: JSON.stringify(finalStepLogs) }
            });
            // We will emit 'execution_completed' in the finally block after video upload
            // Job completes without throwing. Stage-local retries handled errors.
        }
        finally {
            // Lock remains in Redis for 5 minutes to prevent ghost retries
            logMsg('[Video] VIDEO_FINALIZATION_STARTED');
            if (sharedPage) {
                try {
                    const video = sharedPage.video();
                    // Wait for final frames to buffer
                    await sharedPage.waitForTimeout(2000).catch(() => { });
                    await sharedPage.close().catch(() => { });
                    logMsg('[Video] VIDEO_PAGE_CLOSE_SUCCESS');
                    if (sharedContext) {
                        await sharedContext.close().catch(() => { });
                        logMsg('[Video] VIDEO_CONTEXT_CLOSE_SUCCESS');
                    }
                    logMsg('[Video] VIDEO_RECORDING_STOPPED');
                    let videoPath = '';
                    if (video) {
                        videoPath = await video.path().catch(() => '');
                        if (videoPath)
                            logMsg('[Video] VIDEO_PATH_RESOLVED');
                    }
                    if (sharedBrowser)
                        await sharedBrowser.close().catch(() => { });
                    if (videoPath && fsSync.existsSync(videoPath)) {
                        let isReadable = false;
                        try {
                            fsSync.accessSync(videoPath, fsSync.constants.R_OK);
                            isReadable = true;
                        }
                        catch (e) { }
                        const stats = fsSync.statSync(videoPath);
                        if (stats.size > 0 && isReadable) {
                            logMsg('[Video] VIDEO_FILE_VALIDATED');
                            logMsg('[Video] VIDEO_SAVED locally. Uploading...');
                            const videoData = await promises_1.default.readFile(videoPath);
                            const { data, error } = await storage_1.supabase.storage
                                .from('videos')
                                .upload(`${executionId}.mp4`, videoData, { contentType: 'video/mp4', upsert: true });
                            if (!error && data) {
                                const { data: publicData } = storage_1.supabase.storage.from('videos').getPublicUrl(data.path);
                                await prismaClient_1.default.video.create({
                                    data: { executionLogId: executionId, url: publicData.publicUrl, storagePath: `videos/${executionId}.webm` }
                                });
                                logMsg('[Video] VIDEO_UPLOAD_COMPLETE');
                            }
                            else {
                                logMsg(`[Video] ERROR VIDEO_CORRUPT: Upload failed ${error?.message}`);
                            }
                        }
                        else {
                            logMsg(`[Video] ERROR VIDEO_CORRUPT: file empty or unreadable`);
                        }
                    }
                    else {
                        logMsg('[Video] ERROR VIDEO_CORRUPT: no file');
                    }
                }
                catch (e) {
                    console.error("Video processing failed during error recovery", e);
                    logMsg(`[Video] ERROR VIDEO_CORRUPT: exception ${e.message}`);
                }
            }
            // Fetch the very latest status from DB before emitting completed
            const finalDbState = await prismaClient_1.default.executionLog.findUnique({ where: { id: executionId } });
            if (finalDbState) {
                emit('execution_completed', {
                    executionId,
                    status: finalDbState.status,
                    durationMs: finalDbState.durationMs
                    // Note: frontend only uses status and durationMs
                });
            }
        }
    }, {
        connection: redis_1.default,
        concurrency: 2,
    });
    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed successfully`);
    });
    worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed with error:`, err.message);
    });
    return worker;
};
exports.initExecutionWorker = initExecutionWorker;
//# sourceMappingURL=executionWorker_local.js.map