const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Testing fashion site scraper...');
  const startTime = Date.now();
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Test Nordstrom men's jeans category
  const testUrl = 'https://www.nordstrom.com/browse/men/clothing/jeans';
  
  console.log(`\n📍 Testing URL: ${testUrl}`);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for dynamic content
    
    const products = await page.evaluate(() => {
      // Try multiple selectors that fashion sites commonly use
      const selectors = [
        'article[data-testid="product-card"]',
        '.product-card',
        '.product-tile',
        '.product-item',
        '[data-product-id]',
        '.product',
        '.item'
      ];
      
      let productCards = [];
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          console.log(`Found ${found.length} products with selector: ${selector}`);
          productCards = Array.from(found);
          break;
        }
      }
      
      if (productCards.length === 0) {
        console.log('No products found with standard selectors, trying broader search...');
        // Fallback to any element with common fashion site patterns
        const fallbackSelectors = ['[data-testid*="product"]', '[class*="product"]', '[id*="product"]'];
        for (const selector of fallbackSelectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0) {
            console.log(`Found ${found.length} elements with fallback selector: ${selector}`);
            productCards = Array.from(found).slice(0, 10); // Limit to first 10
            break;
          }
        }
      }
      
      return productCards.map((card, index) => {
        // Product name
        let name = '';
        const nameSelectors = [
          '[data-testid="product-title"]',
          '.product-title',
          '.product-name',
          'h1', 'h2', 'h3', 'h4',
          '[aria-label]',
          'a[href*="product"]'
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
          '[data-testid="price"]',
          '.price',
          '.product-price',
          '[class*="price"]',
          '[class*="Price"]',
          '.sr-only'
        ];
        for (const sel of priceSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim() && el.textContent.includes('$')) {
            price = el.textContent.trim();
            break;
          }
        }
        
        // Image
        let image = '';
        const imgEl = card.querySelector('img');
        if (imgEl) {
          image = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('srcset') || '';
        }
        
        // Product URL
        let url = '';
        const linkEl = card.querySelector('a[href*="product"], a[href*="item"]');
        if (linkEl) {
          url = linkEl.href;
        }
        
        // Brand (fashion-specific)
        let brand = '';
        const brandSelectors = [
          '[data-testid="brand"]',
          '.brand',
          '.product-brand',
          '[class*="brand"]',
          '[class*="Brand"]'
        ];
        for (const sel of brandSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim()) {
            brand = el.textContent.trim();
            break;
          }
        }
        
        return { 
          name, 
          price, 
          brand, 
          image, 
          url, 
          selector_used: productCards.length > 0 ? 'found' : 'fallback',
          index 
        };
      }).filter(p => p.name || p.price || p.url); // Keep if we found any useful data
    });
    
    console.log(`\n✅ Found ${products.length} products`);
    
    // Show first few products for analysis
    if (products.length > 0) {
      console.log('\n📦 Sample products:');
      products.slice(0, 3).forEach((product, i) => {
        console.log(`${i + 1}. ${product.name || 'No name'}`);
        console.log(`   Price: ${product.price || 'No price'}`);
        console.log(`   Brand: ${product.brand || 'No brand'}`);
        console.log(`   URL: ${product.url || 'No URL'}`);
        console.log('');
      });
    }
    
    // Save results
    fs.writeFileSync('nordstrom-test-results.json', JSON.stringify(products, null, 2));
    console.log('💾 Saved results to nordstrom-test-results.json');
    
  } catch (err) {
    console.error(`❌ Error scraping fashion site:`, err.message);
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  console.log(`\n🏁 Fashion scraper test completed in ${totalTime.toFixed(2)} seconds`);
  
  await browser.close();
})();