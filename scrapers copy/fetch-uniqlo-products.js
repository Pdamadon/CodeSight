const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const categories = JSON.parse(fs.readFileSync('uniqlo-fashion-categories.json', 'utf-8'));
  
  // Filter to a few representative categories for testing
  const testCategories = categories.filter(cat => 
    cat.text.includes('Jeans') || 
    cat.text.includes('T-Shirts') || 
    cat.text.includes('Jackets')
  ).slice(0, 3); // Just test 3 categories
  
  console.log('🚀 Starting fashion product scraper test...');
  console.log(`Testing ${testCategories.length} categories out of ${categories.length} total`);
  const startTime = Date.now();
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const [i, cat] of testCategories.entries()) {
    console.log(`\n[${i + 1}/${testCategories.length}] Scraping: ${cat.text} — ${cat.href}`);
    
    try {
      await page.goto(cat.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000); // Wait for dynamic content
      
      const products = await page.evaluate(() => {
        // Uniqlo-specific selectors (learned from manual inspection)
        const selectors = [
          '.product-tile',
          '.grid-tile',
          '[data-test="product-tile"]',
          '.product-item',
          '.product-card',
          '.fr-product-tile',
          '[class*="ProductTile"]',
          '[class*="product"]'
        ];
        
        let productCards = [];
        let selectorUsed = '';
        
        for (const selector of selectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            console.log(`Found ${found.length} products with selector: ${selector}`);
            productCards = Array.from(found);
            selectorUsed = selector;
            break;
          }
        }
        
        if (productCards.length === 0) {
          // Fallback to more generic selectors
          const fallbackSelectors = [
            'article',
            '.item',
            'li[class*="product"]',
            'div[class*="tile"]',
            'a[href*="/products/"]'
          ];
          
          for (const selector of fallbackSelectors) {
            const found = document.querySelectorAll(selector);
            if (found.length > 2 && found.length < 100) {
              console.log(`Using fallback selector: ${selector} (${found.length} items)`);
              productCards = Array.from(found);
              selectorUsed = selector + ' (fallback)';
              break;
            }
          }
        }
        
        return productCards.map(card => {
          // Product name
          let name = '';
          const nameSelectors = [
            '.product-title',
            '.product-name',
            '.tile-title',
            'h1', 'h2', 'h3', 'h4',
            '[data-test="product-name"]',
            '.fr-product-tile-name',
            'a[href*="/products/"]'
          ];
          
          for (const sel of nameSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim()) {
              name = el.textContent.trim();
              break;
            }
          }
          
          // Price
          let price = '';
          const priceSelectors = [
            '.price',
            '.product-price',
            '.tile-price',
            '[data-test="price"]',
            '.fr-product-tile-price',
            '[class*="price"]',
            '[class*="Price"]'
          ];
          
          for (const sel of priceSelectors) {
            const el = card.querySelector(sel);
            if (el && el.textContent.trim()) {
              const text = el.textContent.trim();
              if (text.includes('$') || /\$?\d+(\.\d{2})?/.test(text)) {
                price = text;
                break;
              }
            }
          }
          
          // Image
          let image = '';
          const imgEl = card.querySelector('img');
          if (imgEl) {
            image = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-srcset') || '';
          }
          
          // Product URL
          let url = '';
          const linkEl = card.querySelector('a[href*="/products/"], a[href]');
          if (linkEl) {
            url = linkEl.href;
          }
          
          // Color options (fashion-specific)
          const colorElements = card.querySelectorAll('[class*="color"], [class*="swatch"], [data-color]');
          const colors = Array.from(colorElements).map(el => 
            el.getAttribute('data-color') || el.getAttribute('title') || el.textContent.trim()
          ).filter(c => c);
          
          return { 
            name, 
            price, 
            image, 
            url, 
            colors,
            selector_used: selectorUsed
          };
        }).filter(p => p.name && (p.price || p.url)); // Only keep products with name and either price or URL
      });
      
      // Save products for this category
      const safeName = cat.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const outFile = `uniqlo-${safeName}-products.json`;
      fs.writeFileSync(outFile, JSON.stringify(products, null, 2));
      
      console.log(`✅ Found ${products.length} products`);
      if (products.length > 0) {
        console.log(`   Sample: "${products[0].name}" - ${products[0].price}`);
        console.log(`   Saved to: ${outFile}`);
      }
      
    } catch (err) {
      console.error(`❌ Error scraping ${cat.text}:`, err.message);
    }
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  const avgTimePerCategory = totalTime / testCategories.length;
  
  console.log(`\n🏁 Fashion product scraper completed in ${totalTime.toFixed(2)} seconds`);
  console.log(`📊 Average time per category: ${avgTimePerCategory.toFixed(2)} seconds`);
  console.log(`📈 Categories processed: ${testCategories.length}`);
  
  // Summary of all products found
  let totalProducts = 0;
  testCategories.forEach(cat => {
    const safeName = cat.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const outFile = `uniqlo-${safeName}-products.json`;
    try {
      const products = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
      totalProducts += products.length;
    } catch (e) {}
  });
  
  console.log(`📦 Total products extracted: ${totalProducts}`);

  await browser.close();
})();