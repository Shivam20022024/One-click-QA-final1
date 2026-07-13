import { test, expect } from '@playwright/test';

test('E2E test for Sauce Demo', async ({ page }) => {
    // Go to the homepage
    await page.goto('https://www.saucedemo.com/');

    // Login with the username and password
    await page.fill('#user-name', 'standard_user');
    await page.fill('#password', 'secret_sauce');
    await page.click('#login-button');

    // Verify that the title "Products" is visible on the page
    await expect(page.locator('.title')).toHaveText('Products');

    // Add the "Sauce Labs Backpack" to the cart
    await page.click('text=Sauce Labs Backpack');
    await page.click('.btn_primary.btn_inventory');

    // Click on the shopping cart icon
    await page.click('.shopping_cart_link');

    // Verify the item is in the cart
    const cartItem = await page.locator('.cart_item').locator('.inventory_item_name');
    await expect(cartItem).toHaveText('Sauce Labs Backpack');
});