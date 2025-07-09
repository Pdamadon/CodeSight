const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const categories = JSON.parse(fs.readFileSync('terra-bella-floral-categories.json', 'utf-8'));
  console.log('🚀 Starting headless scraper test...');
  const startTime = Date.now();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const [i, cat] of categories.entries()) {
    console.log(`\n[${i + 1}/${categories.length}] Visiting category: ${cat.text} — ${cat.href}`);
    try {
      await page.goto(cat.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const products = await page.evaluate(() => {
        const selectors = [
          '.ProductItem',
          '.product-item',
          '.product-card',
          '.product',
          '[data-product-id]'
        ];
        let productCards = [];
        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            productCards = Array.from(found);
            break;
          }
        }
        return productCards.map(card => {
          // Name/title
          let name = '';
          const nameSelectors = ['.ProductItem__Title', '.product-title', '.product-name', 'h1', 'h2', 'h3'];
          for (const sel of nameSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim()) {
              name = el.textContent.trim();
              break;
            }
          }
          // Price
          let price = '';
          const priceSelectors = ['.ProductItem__Price', '.price', '.product-price', '[class*="price"]'];
          for (const sel of priceSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim()) {
              price = el.textContent.trim();
              break;
            }
          }
          // Image
          let image = '';
          const imgEl = card.querySelector('img');
          if (imgEl) {
            image = imgEl.src || imgEl.getAttribute('data-src') || '';
          }
          // Product URL
          let url = '';
          const linkEl = card.querySelector('a');
          if (linkEl) {
            url = linkEl.href;
          }
          return { name, price, image, url };
        }).filter(p => p.name && p.url);
      });

      // Save products to a file named after the category
      const safeName = cat.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const outFile = `terra-bella-${safeName}-products.json`;
      fs.writeFileSync(outFile, JSON.stringify(products, null, 2));
      console.log(`✅ Saved ${products.length} products to ${outFile}`);
    } catch (err) {
      console.error(`❌ Error fetching products for ${cat.text}:`, err.message);
    }
  }

  await browser.close();
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  console.log(`\n🏁 Headless scraper test completed in ${totalTime.toFixed(2)} seconds`);
})(); 