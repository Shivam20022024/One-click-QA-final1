"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const executionWorker_1 = require("./src/queue/executionWorker");
const prismaClient_1 = __importDefault(require("./src/prismaClient"));
async function main() {
    const browsers = ['chromium', 'firefox', 'webkit', 'edge'];
    let suite = await prismaClient_1.default.testSuite.findFirst();
    if (!suite) {
        let project = await prismaClient_1.default.project.findFirst();
        suite = await prismaClient_1.default.testSuite.create({ data: { name: 'Autonomous Run', projectId: project.id } });
    }
    const children = [];
    const executionIds = [];
    for (const browser of browsers) {
        const browserLower = browser.toLowerCase();
        const execution = await prismaClient_1.default.executionLog.create({
            data: { suiteId: suite.id, status: 'QUEUED', durationMs: 0, browser: browserLower }
        });
        children.push({
            name: 'autonomous-test',
            queueName: executionWorker_1.executionQueueName,
            data: {
                executionId: execution.id,
                testName: `Auto-QA [${browserLower}]`,
                targetUrl: 'https://the-internet.herokuapp.com/',
                customScenario: '1. Login validation\n- Open login page\n- Username: tomsmith\n- Password: SuperSecretPassword!\n- Login successfully\n- Verify secure area\n\n2. Logout validation\n- Logout\n- Verify login page',
                browser: browserLower,
                depth: 'Full Autonomous',
                features: { crossBrowser: true },
                mode: 'full_autonomous',
                isAutonomous: true
            },
            opts: { jobId: execution.id, attempts: 1 }
        });
        executionIds.push(execution.id);
    }
    const parentJob = await executionWorker_1.flowProducer.add({
        name: 'cross-browser-suite',
        queueName: executionWorker_1.executionQueueName,
        data: { targetUrl: 'https://the-internet.herokuapp.com/', browsers },
        children
    });
    console.log('Queued parent job:', parentJob.job.id, 'children:', executionIds);
}
main().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=test_autonomous.js.map