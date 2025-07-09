// test-single-site.js
const { chromium } = require('playwright');

async function testSingleSite() {
  console.log('🧪 Testing single site approach...\n');
  
  const browser = await chromium.launch({ 
    headless: false, // Show browser for debugging
    slowMo: 1000 // Slow down actions
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    // Test 1800flowers.com/roses
    console.log('🔍 Testing: https://www.1800flowers.com/roses');
    
    await page.goto('https://www.1800flowers.com/roses', { 
      waitUntil: 'domcontentloaded', // Less strict than networkidle
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    console.log('Current URL:', page.url());
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    // Look for products
    const products = await page.evaluate(() => {
      console.log('🔍 Looking for products...');
      
      // Try multiple selectors
      const selectors = [
        '.product',
        '.product-item',
        '.item',
        '[data-product]',
        '.product-card',
        '.product-grid .product',
        '.products .product'
      ];
      
      let foundProducts = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        console.log(`Selector "${selector}": ${elements.length} elements`);
        
        if (elements.length > 0) {
          foundProducts = Array.from(elements).map(el => {
            const title = el.querySelector('h1, h2, h3, .title, .name')?.textContent?.trim() || '';
            const price = el.querySelector('.price, .cost, .amount')?.textContent?.trim() || '';
            const image = el.querySelector('img')?.src || '';
            const url = el.querySelector('a')?.href || '';
            
            return { title, price, image, url };
          }).filter(p => p.title && p.url);
          
          console.log(`Found ${foundProducts.length} products with selector: ${selector}`);
          break;
        }
      }
      
      // If no products found, try to find any clickable elements
      if (foundProducts.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="/product"], a[href*="/item"]');
        console.log(`Found ${allLinks.length} product-like links`);
        
        foundProducts = Array.from(allLinks).slice(0, 5).map(link => ({
          title: link.textContent?.trim() || 'Product',
          price: '',
          image: '',
          url: link.href
        }));
      }
      
      return foundProducts;
    });
    
    console.log(`\n📋 Found ${products.length} products:`);
    products.forEach((product, idx) => {
      console.log(`\n--- Product ${idx + 1} ---`);
      console.log(`Title: ${product.title}`);
      console.log(`Price: ${product.price}`);
      console.log(`URL: ${product.url}`);
      if (product.image) console.log(`Image: ${product.image}`);
    });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
    console.log('\n📸 Screenshot saved as test-screenshot.png');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testSingleSite(); 