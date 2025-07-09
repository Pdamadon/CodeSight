const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, 'category_products');

(async () => {
  if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR);

  const categories = JSON.parse(fs.readFileSync('ballardblossom-categories.json', 'utf-8'));
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const page = await browser.newPage();

  for (const [i, cat] of categories.entries()) {
    console.log(`\n[${i + 1}/${categories.length}] Visiting category: ${cat.text} — ${cat.href}`);
    try {
      await page.goto(cat.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Wait for the product grid to appear
      try {
        await page.waitForSelector('#product-grid', { timeout: 15000 });
      } catch (e) {
        console.warn('⚠️  No #product-grid found after waiting. Skipping this category.');
        continue;
      }

      // Scroll to bottom to trigger lazy loading
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 400;
          const delay = 300;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            if (totalHeight >= scrollHeight - window.innerHeight) {
              clearInterval(timer);
              resolve();
            }
          }, delay);
        });
      });
      await page.waitForTimeout(1500); // Wait for lazy content

      // Extract products from the grid
      const products = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('#product-grid > li'));
        return items.map(item => {
          // Name/title
          let name = '';
          const nameEl = item.querySelector('.card-information__text, .full-unstyled-link, .product-title, h3, h2, h1');
          if (nameEl && nameEl.textContent.trim()) name = nameEl.textContent.trim();

          // Price
          let price = '';
          const priceEl = item.querySelector('.price-item, .product-price, .price, [class*="price"]');
          if (priceEl && priceEl.textContent.trim()) price = priceEl.textContent.trim();

          // Image
          let image = '';
          const imgEl = item.querySelector('img');
          if (imgEl) image = imgEl.src || imgEl.getAttribute('data-src') || '';

          // Product URL
          let url = '';
          const linkEl = item.querySelector('a');
          if (linkEl) url = linkEl.href;

          return { name, price, image, url };
        }).filter(p => p.name && p.url);
      });

      // Save products to a file named after the category
      const safeName = cat.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const outFile = path.join(PRODUCTS_DIR, `ballardblossom-${safeName}-products.json`);
      fs.writeFileSync(outFile, JSON.stringify(products, null, 2));
      console.log(`✅ Saved ${products.length} products to ${outFile}`);
    } catch (err) {
      console.error(`❌ Error fetching products for ${cat.text}:`, err.message);
    }
  }

  await browser.close();
})(); 