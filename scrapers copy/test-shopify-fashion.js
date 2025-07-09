const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Testing Shopify fashion site scraper...');
  const startTime = Date.now();
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Test Everlane (popular fashion brand on Shopify)
  const testUrl = 'https://www.everlane.com/collections/mens-jeans';
  
  console.log(`\n📍 Testing URL: ${testUrl}`);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000); // Wait for dynamic content
    
    const products = await page.evaluate(() => {
      // Shopify common selectors
      const selectors = [
        '.product-card',
        '.product-item',
        '.grid-product',
        '.product-grid-item',
        '.product',
        '[data-product-id]',
        '.collection-product',
        '.product-block'
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
        console.log('No products found with Shopify selectors, trying generic...');
        // Try more generic selectors
        const genericSelectors = [
          'article',
          '.item',
          '[class*="product"]',
          '[class*="card"]',
          '.grid-item'
        ];
        
        for (const selector of genericSelectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 0 && found.length < 100) { // Avoid selecting too many generic elements
            console.log(`Found ${found.length} elements with generic selector: ${selector}`);
            productCards = Array.from(found).slice(0, 20); // Limit to first 20
            selectorUsed = selector;
            break;
          }
        }
      }
      
      return productCards.map((card, index) => {
        // Product name
        let name = '';
        const nameSelectors = [
          '.product-title',
          '.product-name',
          'h2', 'h3', 'h4',
          '.title',
          'a[href*="product"]',
          '[class*="title"]',
          '[class*="name"]'
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
          '.money',
          '[class*="price"]',
          '[class*="Price"]',
          '.cost',
          '.amount'
        ];
        for (const sel of priceSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim() && (el.textContent.includes('$') || el.textContent.includes('€') || el.textContent.includes('£'))) {
            price = el.textContent.trim();
            break;
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
        const linkEl = card.querySelector('a[href*="product"], a[href*="collections"]');
        if (linkEl) {
          url = linkEl.href;
        }
        
        // Color/variant info (fashion-specific)
        let colors = [];
        const colorElements = card.querySelectorAll('[class*="color"], [class*="variant"], [class*="swatch"]');
        colors = Array.from(colorElements).map(el => el.textContent.trim() || el.getAttribute('title') || '').filter(c => c);
        
        return { 
          name, 
          price, 
          image, 
          url, 
          colors,
          selector_used: selectorUsed,
          index 
        };
      }).filter(p => p.name || p.price || p.url); // Keep if we found any useful data
    });
    
    console.log(`\n✅ Found ${products.length} products`);
    
    // Show first few products for analysis
    if (products.length > 0) {
      console.log('\n📦 Sample products:');
      products.slice(0, 5).forEach((product, i) => {
        console.log(`${i + 1}. ${product.name || 'No name'}`);
        console.log(`   Price: ${product.price || 'No price'}`);
        console.log(`   Colors: ${product.colors.join(', ') || 'No colors'}`);
        console.log(`   URL: ${product.url || 'No URL'}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No products found - let\'s debug the page structure');
      
      // Debug info if no products found
      const debugInfo = await page.evaluate(() => {
        return {
          title: document.title,
          totalElements: document.querySelectorAll('*').length,
          bodyClasses: document.body.className,
          firstFewElements: Array.from(document.querySelectorAll('div')).slice(0, 10).map(el => ({
            className: el.className,
            id: el.id,
            textContent: el.textContent.substring(0, 100)
          }))
        };
      });
      
      console.log('Debug info:', debugInfo);
    }
    
    // Save results
    fs.writeFileSync('everlane-test-results.json', JSON.stringify(products, null, 2));
    console.log('💾 Saved results to everlane-test-results.json');
    
  } catch (err) {
    console.error(`❌ Error scraping Shopify fashion site:`, err.message);
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  console.log(`\n🏁 Shopify fashion scraper test completed in ${totalTime.toFixed(2)} seconds`);
  
  await browser.close();
})();