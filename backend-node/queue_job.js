"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const queue = new bullmq_1.Queue('execution-queue', {
    connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
    }
});
async function main() {
    const instruction = `1. Homepage and login validation
- Open the OrangeHRM website
... (and all other 16 scenarios) ...
Execution rules:
- STRICT_SCENARIO mode
- Execute ALL scenarios
- Do not merge scenarios
- Preserve exact 1:1 scenario mapping
- Capture screenshots for major steps
- Record full execution video
- Generate per-scenario pass/fail report
- If any required scenario is skipped -> FAIL`;
    let suite = await prisma.testSuite.findFirst();
    if (!suite) {
        let project = await prisma.project.findFirst();
        if (!project) {
            project = await prisma.project.create({ data: { name: 'Default Project' } });
        }
        suite = await prisma.testSuite.create({
            data: { name: 'Default Suite', projectId: project.id }
        });
    }
    const execution = await prisma.executionLog.create({
        data: {
            suiteId: suite.id,
            status: 'QUEUED',
        }
    });
    const job = await queue.add('run-test', {
        executionId: execution.id,
        testName: 'OrangeHRM Validation',
        targetUrl: 'https://opensource-demo.orangehrmlive.com/web/index.php/auth/login',
        instruction: instruction,
        browser: 'chromium'
    }, {
        jobId: execution.id,
        attempts: 1
    });
    console.log('Successfully queued OrangeHRM validation job!');
    console.log('Execution ID:', execution.id);
    console.log('Job ID:', job.id);
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
}
main().catch(console.error);
//# sourceMappingURL=queue_job.js.map