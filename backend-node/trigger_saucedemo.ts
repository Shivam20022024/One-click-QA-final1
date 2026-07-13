require('dotenv').config();
import { executionQueue } from './src/queue/executionWorker';
import prisma from './src/prismaClient';

async function main() {
  const instruction = `1. Homepage and login validation:
- Open https://www.saucedemo.com/
- Verify login page loads successfully.
- Verify username field is visible.
- Verify password field is visible.
- Verify login button is clickable.

2. Invalid login testing:
- Attempt login with invalid credentials.
- Verify proper error message appears.
- Ensure user remains on login page.

3. Valid login testing:
- Username: standard_user
- Password: secret_sauce
- Login successfully.
- Verify inventory/products page loads.

4. Product validation:
- Verify multiple products are displayed.
- Verify product names are visible.
- Verify product prices are visible.
- Verify Add to Cart buttons are clickable.

5. Add to cart flow:
- Add 2 different products to cart.
- Verify cart badge count updates correctly.
- Open cart page.
- Verify selected products appear.

6. Remove product validation:
- Remove one product from cart.
- Verify cart updates correctly.

7. Checkout flow:
- Click checkout.
- Verify checkout form loads.
- Fill firstName, lastName, postalCode with dynamic test data.
- Continue checkout.
- Verify order summary is visible.
- Verify product totals are shown.

8. Order completion:
- Complete checkout.
- Verify success confirmation page.
- Verify order completion message.

9. Navigation validation:
- Navigate: Products, Cart, Checkout, Back to products.
- Verify pages remain stable.

10. Menu validation:
- Open hamburger menu.
- Verify menu options appear.
- Test Logout.

11. Logout validation:
- Logout successfully.
- Verify return to login page.
- Ensure inventory page is no longer accessible without login.

12. Back navigation validation:
- Use browser back button after logout.
- Verify session security is maintained.

13. UI validation:
- Verify important buttons are clickable.
- Verify no broken navigation.
- Verify forms accept valid input.

Execution rules:
- Use semantic selectors (not brittle hardcoded selectors).
- Capture screenshots for major steps.
- Record full execution video.
- Generate pass/fail report per scenario.
- Stop only on critical blockers.`;

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

  console.log(`Execution job added for SauceDemo! Execution ID: ${execution.id}`);
}

main().catch(console.error).finally(() => process.exit(0));
