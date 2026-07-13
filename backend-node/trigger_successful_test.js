"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const executionWorker_1 = require("./src/queue/executionWorker");
const prismaClient_1 = __importDefault(require("./src/prismaClient"));
async function main() {
    const instruction = `1. Homepage and login validation:
- Open the website.
- Verify login page loads successfully.
- Verify username field is visible.
- Verify password field is visible.
- Verify login button is clickable.
- Verify demo credentials section is visible.`;
    let suite = await prismaClient_1.default.testSuite.findFirst();
    if (!suite) {
        let project = await prismaClient_1.default.project.findFirst();
        if (!project) {
            let user = await prismaClient_1.default.user.findFirst();
            if (!user) {
                user = await prismaClient_1.default.user.create({ data: { email: 'test@example.com', passwordHash: 'abc', role: 'USER' } });
            }
            project = await prismaClient_1.default.project.create({ data: { name: 'Default Project', userId: user.id } });
        }
        suite = await prismaClient_1.default.testSuite.create({
            data: { name: 'Default Suite', projectId: project.id }
        });
    }
    const execution = await prismaClient_1.default.executionLog.create({
        data: {
            suiteId: suite.id,
            status: 'QUEUED',
        }
    });
    const job = await executionWorker_1.executionQueue.add('run-test', {
        executionId: execution.id,
        testName: 'Homepage and login validation',
        targetUrl: 'https://www.saucedemo.com',
        instruction: instruction,
        browser: 'chromium',
        features: { autoJira: false }
    }, {
        jobId: execution.id,
        attempts: 1
    });
    console.log('Successfully queued successful validation job!');
    console.log('Execution ID:', execution.id);
    console.log('Job ID:', job.id);
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=trigger_successful_test.js.map