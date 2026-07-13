import 'dotenv/config';
import { executionQueue } from './src/queue/executionWorker';
import prisma from './src/prismaClient';

async function main() {
  const instruction = `1. Homepage and login validation:
- Open the website.
- Verify login page loads successfully.
- Verify username field is visible.
- Verify password field is visible.
- Verify login button is clickable.
- Verify demo credentials section is visible.`;

  let suite = await prisma.testSuite.findFirst();
  if (!suite) {
    let project = await prisma.project.findFirst();
    if (!project) {
        let user = await prisma.user.findFirst();
        if (!user) {
            user = await prisma.user.create({ data: { email: 'test@example.com', passwordHash: 'abc', role: 'USER' } });
        }
        project = await prisma.project.create({ data: { name: 'Default Project', userId: user.id } });
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

  const job = await executionQueue.add('run-test', {
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
