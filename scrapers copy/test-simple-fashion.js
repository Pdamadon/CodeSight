const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Testing simple fashion retailer...');
  const startTime = Date.now();
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Try Uniqlo - known for simpler site structure
  const testUrl = 'https://www.uniqlo.com/us/en/men/jeans';
  
  console.log(`\n📍 Testing URL: ${testUrl}`);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait longer for content
    
    const products = await page.evaluate(() => {
      // Try comprehensive selectors
      const selectors = [
        '.product-tile',
        '.product-card', 
        '.product-item',
        '.grid-tile',
        '.tile',
        '[data-test="product-tile"]',
        '[class*="product"]',
        '[class*="tile"]',
        '[class*="item"]',
        'article',
        '.fr-product-tile'
      ];
      
      let productCards = [];
      let selectorUsed = '';
      
      for (const selector of selectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0 && found.length < 200) { // Reasonable number
          console.log(`Found ${found.length} products with selector: ${selector}`);
          productCards = Array.from(found);
          selectorUsed = selector;
          break;
        }
      }
      
      // If still no products, try very broad search
      if (productCards.length === 0) {
        console.log('Trying very broad selectors...');
        const broadSelectors = ['div[class*="product"]', 'div[class*="item"]', 'li', 'div[data-*]'];
        
        for (const selector of broadSelectors) {
          const found = document.querySelectorAll(selector);
          if (found.length > 5 && found.length < 100) {
            console.log(`Found ${found.length} elements with broad selector: ${selector}`);
            productCards = Array.from(found).slice(0, 20);
            selectorUsed = selector;
            break;
          }
        }
      }
      
      console.log(`Processing ${productCards.length} elements with selector: ${selectorUsed}`);
      
      return productCards.map((card, index) => {
        // Product name - try many variations
        let name = '';
        const nameSelectors = [
          '.product-title',
          '.product-name', 
          '.title',
          '.name',
          'h1', 'h2', 'h3', 'h4', 'h5',
          '[data-test="product-name"]',
          '[aria-label]',
          'a[title]',
          '[class*="title"]',
          '[class*="name"]'
        ];
        for (const sel of nameSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim() && el.textContent.trim().length > 2) {
            name = el.textContent.trim();
            break;
          }
        }
        
        // Try getting name from links if still empty
        if (!name) {
          const link = card.querySelector('a');
          if (link && link.textContent.trim()) {
            name = link.textContent.trim();
          }
        }
        
        // Price
        let price = '';
        const priceSelectors = [
          '.price',
          '.product-price',
          '.cost',
          '.amount',
          '[class*="price"]',
          '[class*="Price"]',
          '[data-test="price"]',
          '.money'
        ];
        for (const sel of priceSelectors) {
          const el = card.querySelector(sel);
          if (el && el.textContent.trim()) {
            const text = el.textContent.trim();
            if (text.includes('$') || text.includes('€') || text.includes('£') || /\d+/.test(text)) {
              price = text;
              break;
            }
          }
        }
        
        // Image
        let image = '';
        const imgEl = card.querySelector('img');
        if (imgEl) {
          image = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-srcset') || imgEl.getAttribute('srcset') || '';
        }
        
        // Product URL
        let url = '';
        const linkEl = card.querySelector('a[href]');
        if (linkEl && linkEl.href) {
          url = linkEl.href;
        }
        
        // Extract any other potentially useful info
        const allText = card.textContent.trim();
        const hasUsefulContent = name || price || url || (allText.length > 10 && allText.length < 500);
        
        return { 
          name, 
          price, 
          image, 
          url, 
          selector_used: selectorUsed,
          all_text: allText.substring(0, 100), // First 100 chars of all text
          has_useful_content: hasUsefulContent,
          index 
        };
      }).filter(p => p.has_useful_content); // Only keep items with useful content
    });
    
    console.log(`\n✅ Found ${products.length} potential products`);
    
    // Show results
    if (products.length > 0) {
      console.log('\n📦 Sample products:');
      products.slice(0, 5).forEach((product, i) => {
        console.log(`${i + 1}. Name: "${product.name || 'No name'}"`);
        console.log(`   Price: "${product.price || 'No price'}"`);
        console.log(`   URL: ${product.url || 'No URL'}`);
        console.log(`   Sample text: "${product.all_text}"`);
        console.log('');
      });
      
      // Count how many have each field
      const withName = products.filter(p => p.name).length;
      const withPrice = products.filter(p => p.price).length;
      const withURL = products.filter(p => p.url).length;
      
      console.log(`📊 Quality metrics:`);
      console.log(`   Products with names: ${withName}/${products.length} (${Math.round(withName/products.length*100)}%)`);
      console.log(`   Products with prices: ${withPrice}/${products.length} (${Math.round(withPrice/products.length*100)}%)`);
      console.log(`   Products with URLs: ${withURL}/${products.length} (${Math.round(withURL/products.length*100)}%)`);
      
    } else {
      console.log('\n❌ Still no products found');
      
      // Last resort debug
      const finalDebug = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          bodyText: document.body.textContent.substring(0, 500),
          hasJavaScriptContent: document.querySelectorAll('script').length,
          elementCounts: {
            divs: document.querySelectorAll('div').length,
            links: document.querySelectorAll('a').length,
            images: document.querySelectorAll('img').length,
            articles: document.querySelectorAll('article').length,
            sections: document.querySelectorAll('section').length
          }
        };
      });
      
      console.log('Final debug:', finalDebug);
    }
    
    // Save results
    fs.writeFileSync('uniqlo-test-results.json', JSON.stringify(products, null, 2));
    console.log('💾 Saved results to uniqlo-test-results.json');
    
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  console.log(`\n🏁 Fashion scraper test completed in ${totalTime.toFixed(2)} seconds`);
  
  await browser.close();
})();