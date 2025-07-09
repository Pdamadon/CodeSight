//CartBuilder.js
const { chromium } = require('playwright');

async function buildCheckoutCart({
  productUrl,
  variantName,
  zipCode,
  cardMessage,
  deliveryDateLabel,
  email,
  firstName,
  lastName,
  address1,
  address2,
  city,
  province,
  zip,
  country,
  phone,
}) {
  console.log('📬 Starting build:', {
    productUrl, variantName, zipCode, cardMessage, deliveryDateLabel,
    email, firstName, lastName, address1, address2, city, province, zip, country, phone,
  });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(productUrl, { waitUntil: 'load', timeout: 20000 });

    const variantId = await page.evaluate((variantName) => {
      const option = Array.from(document.querySelectorAll('select option')).find(o =>
        o.textContent.includes(variantName)
      );
      return option?.value;
    }, variantName);

    if (!variantId) throw new Error('❌ Variant not found');
    console.log(`✅ Variant ID resolved: ${variantId}`);

    await page.evaluate((id) => {
      return fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `id=${id}&quantity=1`,
      });
    }, variantId);
    console.log('🛒 Item added to cart via fetch');

    await page.waitForTimeout(2000);
    await page.goto('https://www.terrabellaflowers.com/cart', { waitUntil: 'load' });

    const delivery = await page.$('.checkoutMethodContainer.delivery');
    if (delivery) await delivery.click();

    await page.fill('#deliveryGeoSearchField', zipCode);
    await page.locator('[aria-label="Submit Button"]').click();
    await page.waitForTimeout(1500);

    const trigger = await page.locator('#Zapiet-InputCalendar__delivery').first();
    await trigger.click();
    const dateSelector = `button[aria-label="${deliveryDateLabel}"][aria-disabled="false"]`;
    await page.waitForSelector(dateSelector, { timeout: 5000 });
    await page.locator(dateSelector).click();

    await page.evaluate((msg) => {
      return fetch('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'attributes[What would you like your card message to read?]': msg,
        }),
      });
    }, cardMessage);

    // Primary checkout click
    console.log('[13] Trying primary checkout button...');
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent?.trim() === 'Checkout' && b.className.includes('Cart__Checkout')
      );
      if (btn) {
        btn.scrollIntoView();
        btn.click();
        return true;
      }
      return false;
    });
    if (clicked) {
      console.log('✅ Clicked primary Checkout button');
    } else {
      console.warn('⚠️ Could not find primary Checkout button');
    }

    console.log('[14] Checking for upsell modal...');
    await page.waitForTimeout(3000);

    const modalContinue = page.locator('button.tdf_cta_btn', { hasText: 'Continue to checkout' });
    try {
      await modalContinue.waitFor({ timeout: 5000 });
      await modalContinue.click();
      console.log('✅ Clicked "Continue to checkout" in modal');
    } catch {
      console.log('ℹ️ No upsell modal found');
    }

    console.log('[15] Waiting for /checkout...');
    await page.waitForNavigation({ timeout: 20000, waitUntil: 'load' });
    const checkoutUrl = page.url();
    console.log(`🧾 Final URL after navigation: ${checkoutUrl}`);
    console.log(`🧾 Captured checkout URL: ${checkoutUrl}`);

    if (checkoutUrl.includes('shopify.com') || checkoutUrl.includes('/checkouts/')) {
      console.log('🛠 Detected Shopify checkout, attempting autofill...');
      try {
        await page.fill('input[name="email"]', email);
        console.log('✅ Filled Email');
        await page.fill('input[name="firstName"]', firstName);
        console.log('✅ Filled First Name');
        await page.fill('input[name="lastName"]', lastName);
        console.log('✅ Filled Last Name');
        await page.fill('input[name="address1"]', address1);
        console.log('✅ Filled Address 1');
        await page.fill('input[name="address2"]', address2 || '');
        console.log('✅ Filled Address 2');
        await page.fill('input[name="city"]', city);
        console.log('✅ Filled City');
        await page.fill('input[name="phone"]', phone);
        console.log('✅ Filled Phone');
      } catch (e) {
        console.warn(`⚠️ Shopify form autofill failed: ${e.message}`);
      }
    }
    return { checkoutUrl };
  } catch (err) {
    console.error('❌ Cart creation failed:', err.message);
    return { error: err.message };
  } finally {
    // Leave browser open for inspection
    // await browser.close();
  }
}

module.exports = buildCheckoutCart;