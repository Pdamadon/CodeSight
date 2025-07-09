const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, 'category_products');

(async () => {
  // Ensure the directory exists
  if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR);

  // Find all product list files for categories
  const files = fs.readdirSync(PRODUCTS_DIR).filter(f => /^terra-bella-.*-products\.json$/.test(f));
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const page = await browser.newPage();

  for (const file of files) {
    const filePath = path.join(PRODUCTS_DIR, file);
    const products = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const detailedProducts = [];

    console.log(`\nExtracting details for ${products.length} products from ${file}...`);

    for (const [i, product] of products.entries()) {
      console.log(`[${i + 1}/${products.length}] ${product.name} — ${product.url}`);
      try {
        await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(1500);

        const details = await page.evaluate(() => {
          // Title
          const name = document.querySelector('h1, .product-title, .ProductMeta__Title')?.textContent?.trim() || '';
          // Price
          const price = document.querySelector('.price, .product-price, .ProductMeta__Price')?.textContent?.trim() || '';
          // Description
          const description = document.querySelector('.product-description, .ProductMeta__Description, .rte, .description')?.textContent?.trim() || '';
          // All images
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

        detailedProducts.push({ ...product, ...details });
      } catch (err) {
        console.error(`❌ Error fetching details for ${product.url}:`, err.message);
      }
    }

    // Save detailed products for this category
    const outFile = path.join(PRODUCTS_DIR, file.replace('.json', '-detailed.json'));
    fs.writeFileSync(outFile, JSON.stringify(detailedProducts, null, 2));
    console.log(`✅ Saved detailed products to ${outFile}`);
  }

  await browser.close();
})(); 