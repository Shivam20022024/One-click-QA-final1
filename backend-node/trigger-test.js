const axios = require('axios');

const customScenarioText = `
1. Homepage and login validation:
- Open the website.
- Verify login page loads successfully.
- Verify username field is visible.
- Verify password field is visible.
- Verify login button is clickable.
- Verify demo credentials section is visible.

2. Invalid login testing:
- Attempt login with invalid credentials.
- Verify proper error message appears.
- Ensure user remains on login page.

3. Valid login testing:
Use credentials:
Username: standard_user
Password: secret_sauce

- Login successfully.
- Verify inventory/products page loads.
- Verify product list is visible.

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
- Fill dynamic test data:
  First Name
  Last Name
  Postal Code
- Continue checkout.
- Verify order summary is visible.
- Verify product totals are shown.

8. Order completion:
- Complete checkout.
- Verify success confirmation page.
- Verify order completion message.

9. Navigation validation:
- Navigate:
  Products
  Cart
  Checkout
  Back to products
- Verify pages remain stable.

10. Menu validation:
- Open hamburger menu.
- Verify menu options appear.
- Test About link if safe.
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
- Stop only on critical blockers.
`;

async function triggerTests() {
  try {
    const response = await axios.post('http://localhost:8080/api/v1/autonomous/run', {
      targetUrl: 'https://www.saucedemo.com/',
      mode: 'strict_scenario',
      customScenario: customScenarioText,
      browsers: ['chromium'],
      depth: 2,
      features: {}
    });
    console.log("Tests triggered successfully!");
    console.log("Execution IDs:", response.data.executionIds);
    console.log("You can monitor the execution in the UI.");
  } catch (err) {
    console.error("Failed to trigger tests:", err.response ? err.response.data : err.message);
  }
}

triggerTests();
