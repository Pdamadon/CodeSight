const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Testing improved fashion scraper...');
  const startTime = Date.now();
  
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const page = await browser.newPage();

  // Test one specific category URL from our extracted list
  const testUrl = 'https://www.uniqlo.com/us/en/women/bottoms/jeans';
  
  console.log(`\n📍 Testing improved scraper on: ${testUrl}`);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000); // Wait for content to load
    
    // First, let's see what the page structure looks like
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        productElements: {
          'div[class*="product"]': document.querySelectorAll('div[class*="product"]').length,
          'a[href*="/products/"]': document.querySelectorAll('a[href*="/products/"]').length,
          '.fr-product-tile': document.querySelectorAll('.fr-product-tile').length,
          'article': document.querySelectorAll('article').length,
          '[data-test-id]': document.querySelectorAll('[data-test-id]').length
        }
      };
    });
    
    console.log('Page info:', pageInfo);
    
    const products = await page.evaluate(() => {
      // Start with product links since those are most reliable
      const productLinks = Array.from(document.querySelectorAll('a[href*="/products/"]'));
      
      return productLinks.map(link => {
        // Get the container that holds this product link
        let container = link.closest('div[class*="product"], article, .tile, li') || link;
        
        // Product name - try the link text first, then look in container
        let name = '';
        if (link.textContent.trim()) {
          name = link.textContent.trim();
        } else {
          // Look for name in container
          const nameEl = container.querySelector('h1, h2, h3, h4, h5, .title, .name, [class*="title"], [class*="name"]');
          if (nameEl) {
            name = nameEl.textContent.trim();
          }
        }
        
        // Price - look in the container
        let price = '';
        const priceSelectors = [
          '.price', '.cost', '.amount', '[class*="price"]', '[class*="Price"]'
        ];
        
        for (const sel of priceSelectors) {
          const priceEl = container.querySelector(sel);
          if (priceEl) {
            const priceText = priceEl.textContent.trim();
            if (priceText.includes('$') || /\$?\d+(\.\d{2})?/.test(priceText)) {
              price = priceText;
              break;
            }
          }
        }
        
        // If no price found in container, try to extract from name text
        if (!price && name) {
          const priceMatch = name.match(/\$[\d,]+(\.\d{2})?/);
          if (priceMatch) {
            price = priceMatch[0];
            // Clean the name by removing the price
            name = name.replace(priceMatch[0], '').trim();
          }
        }
        
        // Image
        let image = '';
        const imgEl = container.querySelector('img') || link.querySelector('img');
        if (imgEl) {
          image = imgEl.src || imgEl.getAttribute('data-src') || '';
        }
        
        // URL
        const url = link.href;
        
        // Extract clean product name (remove size info, ratings, etc.)
        if (name) {
          // Remove common patterns like "WOMEN, XXS-XXL", ratings like "4.7(119)"
          name = name.replace(/^(WOMEN|MEN|KIDS),?\s*[^A-Z]*/, ''); // Remove size prefixes
          name = name.replace(/\d+\.\d+\(\d+\).*$/, ''); // Remove ratings
          name = name.replace(/\$[\d,]+(\.\d{2})?.*$/, ''); // Remove price suffixes
          name = name.trim();
        }
        
        return {
          name,
          price,
          image,
          url,
          originalText: link.textContent.trim().substring(0, 100) // Keep original for debugging
        };
      }).filter(p => p.name && p.url); // Only keep items with name and URL
    });
    
    console.log(`\n✅ Found ${products.length} products`);
    
    if (products.length > 0) {
      console.log('\n📦 First 5 products:');
      products.slice(0, 5).forEach((product, i) => {
        console.log(`${i + 1}. "${product.name}"`);
        console.log(`   Price: ${product.price || 'No price'}`);
        console.log(`   URL: ${product.url}`);
        console.log(`   Original: "${product.originalText}"`);
        console.log('');
      });
      
      // Save results
      fs.writeFileSync('uniqlo-improved-results.json', JSON.stringify(products, null, 2));
      console.log('💾 Saved to uniqlo-improved-results.json');
    }
    
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  console.log(`\n🏁 Improved scraper completed in ${totalTime.toFixed(2)} seconds`);
  
  // Keep browser open for inspection
  console.log('\n👀 Browser open - press Ctrl+C to close');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
})();