require('dotenv').config();
import { executionQueue } from './src/queue/executionWorker';
import prisma from './src/prismaClient';

async function main() {
  const instruction = `Test case 1: Positive LogIn test
Open page
Type username student into Username field
Type password Password123 into Password field
Push Submit button
Verify new page URL contains practicetestautomation.com/logged-in-successfully/
Verify new page contains expected text ('Congratulations' or 'successfully logged in')
Verify button Log out is displayed on the new page
Test case 2: Negative username test
Open page
Type username incorrectUser into Username field
Type password Password123 into Password field
Push Submit button
Verify error message is displayed
Verify error message text is Your username is invalid!
Test case 3: Negative password test
Open page
Type username student into Username field
Type password incorrectPassword into Password field
Push Submit button
Verify error message is displayed
Verify error message text is Your password is invalid!`;

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

  await executionQueue.add('execute_test', {
    instruction,
    executionId: execution.id,
    targetUrl: 'https://practicetestautomation.com/practice-test-login/',
    features: {
      accessibility: false,
      security: false
    }
  });

  console.log(`Execution job added for Practice Test Automation! Execution ID: ${execution.id}`);
  
  // Checking validation checklist items (the agent itself handles them, we're just triggering it here)
  console.log('VALIDATION CHECKLIST STATUS (Trigger-side):');
  console.log('- Target URL accessible: Pending agent execution');
  console.log('- Browser engine started: Pending agent execution');
  console.log('- Video context created: Pending agent execution');
  console.log('- Video recording started: Pending agent execution');
  console.log('- DiscoveryAgent initiated: Execution queued in Redis, worker will initiate');
}

main().catch(console.error).finally(() => process.exit(0));
