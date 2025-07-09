//terra-bella-scraper.js
const { chromium } = require('playwright');
const runSnapshotter = require('./snapshotter');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('[1] Visiting product page...');
    await page.goto('https://www.terrabellaflowers.com/products/citrus');

    console.log('[2] Getting variant ID...');
    const variantId = await page.evaluate(() => {
      const option = Array.from(document.querySelectorAll('select option')).find(o =>
        o.textContent.includes('Modest')
      );
      return option?.value;
    });

    if (!variantId) throw new Error('Variant not found');

    console.log(`[3] Adding variant ${variantId} to cart...`);
    await page.evaluate(async (id) => {
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `id=${id}&quantity=1`,
      });
    }, variantId);

    await page.waitForTimeout(3000);

    console.log('[4] Submitting card message via API...');
    await page.evaluate(async () => {
      await fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'attributes[What would you like your card message to read?]': 'Happy Birthday!',
        }),
      });
    });

    await page.waitForTimeout(2000);
    await page.goto('https://www.terrabellaflowers.com/cart');

    console.log('[5] Selecting Delivery...');
    const deliverySection = await page.$('.checkoutMethodContainer.delivery');
    if (deliverySection) {
      await deliverySection.click();
      await page.waitForTimeout(1000);
    }

    console.log('[6] Filling delivery zip...');
    await page.waitForSelector('#deliveryGeoSearchField', { timeout: 5000 });
    await page.fill('#deliveryGeoSearchField', '98101');
    await page.locator('[aria-label="Submit Button"]').click();
    await page.waitForTimeout(2000);

    console.log('[7] Opening calendar...');
    const datePickerTrigger = await page.locator('#Zapiet-InputCalendar__delivery').first();
    await datePickerTrigger.click();

    console.log('[8] Waiting for calendar...');
    await page.waitForSelector('.Zapiet-Calendar__Dates', { timeout: 5000 });

    console.log('[9] Selecting valid delivery date...');
    const dateSelector = 'button[aria-label="Thu, 03 July, 2025"][aria-disabled="false"]';
    await page.waitForSelector(dateSelector, { timeout: 5000, state: 'visible' });
    await page.locator(dateSelector).hover();
    await page.locator(dateSelector).click();

    console.log('[10] Filling card message input in DOM...');
    await page.fill('textarea[name="attributes[What would you like your card message to read?]"]', 'Happy Birthday!');

    console.log('[11] Dispatching JS-based click on Checkout button...');
    await page.evaluate(() => {
      const checkoutBtn = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent?.trim() === 'Checkout' && btn.className.includes('Cart__Checkout')
      );
      if (checkoutBtn) {
        checkoutBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        checkoutBtn.dispatchEvent(clickEvent);
        console.log('✅ Checkout click dispatched via JS');
      } else {
        console.log('❌ Checkout button not found.');
      }
    });

    console.log('[12] Waiting for popup/modal (if any)...');
    try {
      await page.waitForSelector('.modal, .popup, .dialog, .popup-message, #popup', {
        timeout: 8000,
        state: 'visible'
      });
      console.log('[✅] Popup appeared. Automation paused.');
    } catch {
      console.log('[⚠️] No popup detected. Proceed manually if needed.');
    }
    console.log('[13] Checking for upsell modal and continuing to checkout...');

    try {
      const continueBtn = page.locator('button', { hasText: 'Continue to checkout' });
      await continueBtn.waitFor({ timeout: 5000 });
      await continueBtn.click();
      console.log('[✅] Upsell modal dismissed. Proceeding to checkout...');
    } catch {
      console.log('[ℹ️] No upsell modal detected — continuing...');
    }

    // Optional: wait for navigation to /checkout
    await page.waitForURL('**/checkout', { timeout: 10000 });
    console.log('[🚚] Arrived at final checkout page.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('🔍 Leaving browser open for inspection...');
    return;
  }

  // Keep browser open for review
})();
