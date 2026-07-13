import 'dotenv/config';
import { executionQueue } from './src/queue/executionWorker';
import prisma from './src/prismaClient';

async function main() {
  const instruction = `1. Login validation

* Open https://www.saucedemo.com
* Username: standard_user
* Password: secret_sauce
* Click Login
* Verify inventory page loads

2. Intentional failure validation

* Verify element "giant pink dinosaur" exists`;

  let suite = await prisma.testSuite.findFirst();
  if (!suite) {
    let project = await prisma.project.findFirst();
    if (!project) {
        // Find a user or create one
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
    testName: 'Intentional failure validation',
    targetUrl: 'https://www.saucedemo.com',
    instruction: instruction,
    browser: 'chromium',
    features: { autoJira: true }
  }, {
    jobId: execution.id,
    attempts: 1
  });

  console.log('Successfully queued intentional failure job!');
  console.log('Execution ID:', execution.id);
  console.log('Job ID:', job.id);
  process.exit(0);
}

main().catch(console.error);
