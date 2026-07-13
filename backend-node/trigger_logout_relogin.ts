require('dotenv').config();
import { executionQueue } from './src/queue/executionWorker';
import prisma from './src/prismaClient';

async function main() {
  const instruction = `1. Initial Login Flow:
- Open the website.
- Login successfully using:
  Username: standard_user
  Password: secret_sauce

2. Add Item to Cart:
- Verify inventory page loads.
- Add "Sauce Labs Backpack" to the cart.
- Verify cart badge updates to 1.

3. Automatic Logout:
- Open the hamburger menu.
- Click Logout to automatically log out.
- Verify user is returned to the login page.

4. Relogin Flow:
- Fill the data in the login page again:
  Username: standard_user
  Password: secret_sauce
- Click login.
- Verify user successfully logs back in.
- Verify the cart still retains the added item.`;

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
    targetUrl: 'https://www.saucedemo.com',
    features: {
      accessibility: false,
      security: false
    }
  });

  console.log(`Execution job added for Logout-Relogin flow! Execution ID: ${execution.id}`);
}

main().catch(console.error).finally(() => process.exit(0));
