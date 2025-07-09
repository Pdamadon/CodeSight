const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const products = JSON.parse(fs.readFileSync('terra-bella-bath-wellness-products.json', 'utf-8'));
  console.log('🚀 Starting headless product details scraper test...');
  const startTime = Date.now();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const detailedProducts = [];

  for (const [i, product] of products.entries()) {
    console.log(`\n[${i + 1}/${products.length}] Visiting: ${product.name} — ${product.url}`);
    try {
      await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const details = await page.evaluate(() => {
        // Title
        const name = document.querySelector('h1, .product-title, .ProductMeta__Title')?.textContent?.trim() || '';
        // Price
        const price = document.querySelector('.price, .product-price, .ProductMeta__Price')?.textContent?.trim() || '';
        // Description
        const description = document.querySelector('.product-description, .ProductMeta__Description, .rte, .description')?.textContent?.trim() || '';
        // Images
        const images = Array.from(document.querySelectorAll('.product__media img, .Product__Slideshow img, .product-gallery img, .product-single__photo, .product-image img, img'))
          .map(img => img.src)
          .filter((src, idx, arr) => src && arr.indexOf(src) === idx);
        // Variants
        const variants = [];
        document.querySelectorAll('select option, .variant-option').forEach(option => {
          if (option.value && option.textContent.trim()) {
            variants.push({
              id: option.value,
              name: option.textContent.trim()
            });
          }
        });
        return { name, price, description, images, variants, url: window.location.href };
      });

      // Merge with original product info
      detailedProducts.push({ ...product, ...details });
    } catch (err) {
      console.error(`❌ Error fetching details for ${product.url}:`, err.message);
    }
  }

  fs.writeFileSync('terra-bella-bath-wellness-products-detailed.json', JSON.stringify(detailedProducts, null, 2));
  console.log('\n✅ Saved detailed product info to terra-bella-bath-wellness-products-detailed.json');

  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  const avgTimePerProduct = totalTime / products.length;
  console.log(`\n🏁 Product details scraper completed in ${totalTime.toFixed(2)} seconds`);
  console.log(`📊 Average time per product: ${avgTimePerProduct.toFixed(2)} seconds`);
  console.log(`📈 Products processed: ${detailedProducts.length}/${products.length}`);

  await browser.close();
})();