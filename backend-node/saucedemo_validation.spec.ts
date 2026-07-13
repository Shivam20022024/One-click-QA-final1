import { test, expect, type Page } from '@playwright/test';

// Use serial mode to run tests sequentially and share state where needed
test.describe.configure({ mode: 'serial' });

// Global page instance to maintain state across scenarios that require it
let page: Page;

test.beforeAll(async ({ browser }) => {
  // Create a new context and page for the entire suite
  const context = await browser.newContext({
    recordVideo: { dir: 'videos/' }, // Record full execution video
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

test.afterEach(async ({ }, testInfo) => {
  // Capture screenshots for major steps, especially if they fail
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshotPath = `screenshots/${testInfo.title.replace(/\s+/g, '_')}_failure.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } else {
    const screenshotPath = `screenshots/${testInfo.title.replace(/\s+/g, '_')}_success.png`;
    await page.screenshot({ path: screenshotPath });
  }
});

test.describe('SauceDemo Validation Checklist', () => {
  const BASE_URL = 'https://www.saucedemo.com/';

  test('1. Homepage and login validation', async () => {
    await page.goto(BASE_URL);
    
    // Using semantic locators where possible, fallback to data-test attributes which are standard in SauceDemo
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.locator('[data-test="login-button"]')).toBeEnabled();
    await expect(page.locator('#login_credentials')).toBeVisible();
  });

  test('2. Invalid login testing', async () => {
    await page.getByPlaceholder('Username').fill('invalid_user');
    await page.getByPlaceholder('Password').fill('wrong_password');
    await page.locator('[data-test="login-button"]').click();

    // Verify proper error message appears
    const errorMessage = page.locator('[data-test="error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Username and password do not match');
    
    // Ensure user remains on login page
    expect(page.url()).toBe(BASE_URL);
  });

  test('3. Valid login testing', async () => {
    // Clear previous inputs
    await page.getByPlaceholder('Username').fill('');
    await page.getByPlaceholder('Password').fill('');
    
    await page.getByPlaceholder('Username').fill('standard_user');
    await page.getByPlaceholder('Password').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    // Verify inventory/products page loads
    await expect(page).toHaveURL(/.*inventory.html/);
    await expect(page.locator('.title')).toHaveText('Products');
    await expect(page.locator('.inventory_list')).toBeVisible();
  });

  test('4. Product validation', async () => {
    const products = page.locator('.inventory_item');
    
    // Verify multiple products are displayed
    expect(await products.count()).toBeGreaterThan(1);
    
    // Verify product names and prices are visible for the first item
    await expect(products.first().locator('.inventory_item_name')).toBeVisible();
    await expect(products.first().locator('.inventory_item_price')).toBeVisible();
    
    // Verify Add to Cart buttons are clickable
    const firstAddToCartButton = products.first().locator('button:has-text("Add to cart")');
    await expect(firstAddToCartButton).toBeEnabled();
  });

  test('5. Add to cart flow', async () => {
    // Add 2 different products to cart
    await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
    await page.locator('[data-test="add-to-cart-sauce-labs-bike-light"]').click();

    // Verify cart badge count updates correctly
    const cartBadge = page.locator('.shopping_cart_badge');
    await expect(cartBadge).toHaveText('2');

    // Open cart page
    await page.locator('.shopping_cart_link').click();
    await expect(page).toHaveURL(/.*cart.html/);

    // Verify selected products appear
    const cartItems = page.locator('.cart_item');
    expect(await cartItems.count()).toBe(2);
  });

  test('6. Remove product validation', async () => {
    // Remove one product from cart
    await page.locator('[data-test="remove-sauce-labs-backpack"]').click();

    // Verify cart updates correctly (count should drop to 1)
    const cartItems = page.locator('.cart_item');
    expect(await cartItems.count()).toBe(1);
    
    const cartBadge = page.locator('.shopping_cart_badge');
    await expect(cartBadge).toHaveText('1');
  });

  test('7. Checkout flow', async () => {
    // Click checkout
    await page.locator('[data-test="checkout"]').click();

    // Verify checkout form loads
    await expect(page).toHaveURL(/.*checkout-step-one.html/);

    // Fill dynamic test data
    await page.getByPlaceholder('First Name').fill('Test');
    await page.getByPlaceholder('Last Name').fill('User');
    await page.getByPlaceholder('Zip/Postal Code').fill('12345');

    // Continue checkout
    await page.locator('[data-test="continue"]').click();

    // Verify order summary is visible
    await expect(page).toHaveURL(/.*checkout-step-two.html/);
    await expect(page.locator('.summary_info')).toBeVisible();
    
    // Verify product totals are shown
    await expect(page.locator('.summary_subtotal_label')).toBeVisible();
    await expect(page.locator('.summary_total_label')).toBeVisible();
  });

  test('8. Order completion', async () => {
    // Complete checkout
    await page.locator('[data-test="finish"]').click();

    // Verify success confirmation page & message
    await expect(page).toHaveURL(/.*checkout-complete.html/);
    await expect(page.locator('.complete-header')).toHaveText('Thank you for your order!');
  });

  test('9. Navigation validation', async () => {
    // Using soft assertions here so one broken navigation doesn't completely halt the flow, 
    // stopping only on critical blockers.
    
    // Navigate Back to products
    await page.locator('[data-test="back-to-products"]').click();
    expect.soft(page.url()).toContain('inventory.html');

    // Navigate Cart
    await page.locator('.shopping_cart_link').click();
    expect.soft(page.url()).toContain('cart.html');

    // Navigate Checkout
    await page.locator('[data-test="checkout"]').click();
    expect.soft(page.url()).toContain('checkout-step-one.html');
    
    // Cancel to go back
    await page.locator('[data-test="cancel"]').click();
    expect.soft(page.url()).toContain('cart.html');
  });

  test('10. Menu validation', async () => {
    // Navigate back to products for the menu test
    await page.locator('[data-test="continue-shopping"]').click();
    
    // Open hamburger menu
    await page.getByRole('button', { name: 'Open Menu' }).click();

    // Verify menu options appear
    const menuWrap = page.locator('.bm-menu-wrap');
    await expect(menuWrap).toBeVisible();
    
    // Test About link if safe (we will just check if it has the correct href to avoid leaving the app)
    const aboutLink = page.locator('[data-test="about-sidebar-link"]');
    await expect(aboutLink).toHaveAttribute('href', 'https://saucelabs.com/');
  });

  test('11. Logout validation', async () => {
    // Test Logout
    await page.locator('[data-test="logout-sidebar-link"]').click();

    // Verify return to login page
    await expect(page).toHaveURL(BASE_URL);
    await expect(page.locator('[data-test="login-button"]')).toBeVisible();

    // Ensure inventory page is no longer accessible without login
    await page.goto(`${BASE_URL}inventory.html`);
    const errorMessage = page.locator('[data-test="error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('You can only access \'/inventory.html\' when you are logged in.');
  });

  test('12. Back navigation validation', async () => {
    // Use browser back button after logout
    await page.goBack();
    
    // Verify session security is maintained (should not see inventory)
    await expect(page.locator('[data-test="login-button"]')).toBeVisible();
    const inventoryList = page.locator('.inventory_list');
    await expect(inventoryList).not.toBeVisible();
  });

  test('13. UI validation', async () => {
    // Verify important buttons are clickable from the login page context
    await expect(page.locator('[data-test="login-button"]')).toBeEnabled();
    
    // Verify forms accept valid input
    await page.getByPlaceholder('Username').fill('test_input');
    await expect(page.getByPlaceholder('Username')).toHaveValue('test_input');
  });
});
