const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// refactored as an exported function
async function runSnapshotter(form) {
  // Define the expert steps up to each state
  const steps = [
    {
      name: 'PRODUCT_PAGE',
      action: async ({ page }) => {
        await page.goto(form.productUrl, { waitUntil: 'load' });
      }
    },
    {
      name: 'VARIANT_SELECTED',
      action: async ({ page }) => {
        await page.evaluate((variantName) => {
          const option = Array.from(document.querySelectorAll('select option'))
            .find(o => o.textContent.includes(variantName));
          window._variantId = option.value;
        }, form.variantName);
      }
    },
    {
      name: 'ITEM_ADDED',
      action: async ({ page }) => {
        await page.evaluate(id => {
          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `id=${id}&quantity=1`,
          });
        }, window._variantId);
      }
    },
    // ... continue filling out all 14 steps ...
  ];

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  for (let i = 0; i < steps.length; i++) {
    const { name, action } = steps[i];
    console.log(`▶ Running step ${i}: ${name}`);
    await action({ page, form });

    // allow page to settle
    await page.waitForTimeout(1000);

    // ensure snapshots directory
    const dir = path.join(__dirname, 'snapshots');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    // save screenshot
    const screenshotPath = path.join(dir, `${i}_${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // save HTML
    const html = await page.content();
    const domPath = path.join(dir, `${i}_${name}.html`);
    fs.writeFileSync(domPath, html);

    console.log(`✅ Captured state ${name}:`, screenshotPath, domPath);
  }

  await browser.close();
  console.log('Snapshotting complete!');
}

module.exports = runSnapshotter;
js
Copy
Edit
// scrapers/terra-bella-scraper.js
// Your main scraper + automatic snapshotting

const { chromium } = require('playwright');
const runSnapshotter = require('./snapshotter');

// centralize your form parameters
const form = {
  productUrl: 'https://www.terrabellaflowers.com/products/citrus',
  variantName: 'Modest',
  zipCode: '98101',
  cardMessage: 'Happy Birthday!',
  deliveryDateLabel: 'Thu, 03 July, 2025',
  // (extend with email/firstName/etc. if you want to snapshot those later)
};

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('[1] Visiting product page...');
    await page.goto(form.productUrl);

    console.log('[2] Getting variant ID...');
    const variantId = await page.evaluate(() => {
      const option = Array.from(document.querySelectorAll('select option'))
        .find(o => o.textContent.includes('Modest'));
      return option?.value;
    });
    if (!variantId) throw new Error('Variant not found');

    console.log(`[3] Adding variant ${variantId} to cart...`);
    await page.evaluate(async id => {
      await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `id=${id}&quantity=1`,
      });
    }, variantId);

    // ... your existing steps through final checkout redirect ...

    console.log('[🚚] Arrived at final checkout page.');

    // now capture snapshots for each defined state
    console.log('▶ Snapshotting Terra Bella states...');
    await runSnapshotter(form);

  } catch (err) {
    console.error('❌ Error during scraping:', err);
  } finally {
    // keep browser open if you need to inspect,
    // or call browser.close() here to shut it down.
  }
})();