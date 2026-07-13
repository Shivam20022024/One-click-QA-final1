require('dotenv').config();
import { executionQueue } from './src/queue/executionWorker';
import prisma from './src/prismaClient';

async function main() {
  const instruction = `Test Name: E-Commerce Order Flow Automation

Scenario 1: Homepage Validation
1. Open Demo Web Shop
2. Verify homepage loads successfully
3. Verify logo is visible
4. Verify search box is visible
5. Verify shopping cart link is visible

Scenario 2: Product Search
1. Search for: Laptop
2. Click Search
3. Verify search results are displayed
4. Verify at least one product is visible

Scenario 3: Add Product To Cart
1. Open first product from search results
2. Click Add To Cart
3. Verify success notification appears
4. Verify shopping cart quantity increases

Scenario 4: Cart Validation
1. Open Shopping Cart
2. Verify product exists in cart
3. Verify quantity is greater than 0
4. Verify subtotal is displayed

Scenario 5: Checkout Validation
1. Click Checkout
2. Verify login or guest checkout page appears
3. If login is required: Verify authentication page is displayed

Scenario 6: Intentional Failure Validation
1. Verify order confirmation message is visible

Expected Result: This step should FAIL because no order has been placed.
Expected: Order confirmation message visible
Actual: User has not completed checkout
Failure Type: APPLICATION_VALIDATION_FAILURE
Capture: Screenshot, Browser logs, Network logs, Expected vs Actual result, Execution video, Jira bug creation`;

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
    targetUrl: 'https://demowebshop.tricentis.com/',
    features: {
      accessibility: false,
      security: false
    }
  });

  console.log(`Execution job added for Demo Web Shop! Execution ID: ${execution.id}`);
}

main().catch(console.error).finally(() => process.exit(0));
