const { chromium } = require('playwright');

async function testProductExtraction() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('🌹 Testing product extraction on 1800flowers.com/roses...');
    
    // Set a realistic user agent
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    // Navigate to the roses page
    await page.goto('https://www.1800flowers.com/roses', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);
    
    // Take a screenshot to see what we're working with
    await page.screenshot({ path: 'roses-page.png', fullPage: true });
    console.log('📸 Screenshot saved as roses-page.png');
    
    // Log all class names of divs containing both an image and a link
    const productDivs = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      return divs
        .filter(div => div.querySelector('img') && div.querySelector('a'))
        .map(div => ({
          className: div.className,
          outerHTML: div.outerHTML.substring(0, 300), // for context
        }));
    });
    console.log('\n🔎 Candidate product divs (class names and HTML snippets):');
    productDivs.forEach((div, i) => {
      console.log(`\n[${i + 1}] class: ", div.className, "`);
      console.log(div.outerHTML);
    });
    
    // Now let's extract products with detailed logging
    const products = await page.evaluate(() => {
      console.log('🔍 Starting product extraction...');
      
      // Log the page title and URL for context
      console.log('Page title:', document.title);
      console.log('Page URL:', window.location.href);
      
      // Try to find product containers with multiple strategies
      const strategies = [
        {
          name: 'CSS Selectors',
          elements: () => {
            const selectors = [
              '.product',
              '.product-item', 
              '.product-card',
              '.product-tile',
              '.product-box',
              '.item',
              '.card',
              '.tile',
              '.box',
              '[data-product-id]',
              '[data-product]',
              '.product-grid .product',
              '.products .product',
              '.search-results .product',
              '.product-list .product',
              '.grid .product',
              '.collection .product'
            ];
            
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
                return Array.from(elements);
              }
            }
            return [];
          }
        },
        {
          name: 'Class Name Search',
          elements: () => {
            const allElements = document.querySelectorAll('*');
            const productElements = Array.from(allElements).filter(el => {
              if (!el.className || typeof el.className !== 'string') return false;
              const className = el.className.toLowerCase();
              return className.includes('product') || 
                     className.includes('item') || 
                     className.includes('card') || 
                     className.includes('tile') ||
                     className.includes('box');
            });
            console.log(`🔍 Found ${productElements.length} elements with product-related class names`);
            return productElements.slice(0, 20); // Limit to first 20
          }
        },
        {
          name: 'Link Analysis',
          elements: () => {
            const links = document.querySelectorAll('a[href*="/product"], a[href*="/item"], a[href*="/roses"]');
            console.log(`🔗 Found ${links.length} product-like links`);
            return Array.from(links).slice(0, 10);
          }
        },
        {
          name: 'Generic Divs',
          elements: () => {
            const divs = document.querySelectorAll('div');
            const cardLikeDivs = Array.from(divs).filter(div => {
              // Look for divs that might be product cards
              const hasImage = div.querySelector('img');
              const hasText = div.textContent.trim().length > 10;
              const hasLink = div.querySelector('a');
              return hasImage && hasText && hasLink;
            });
            console.log(`📦 Found ${cardLikeDivs.length} divs that look like product cards`);
            return cardLikeDivs.slice(0, 10);
          }
        }
      ];
      
      let allProducts = [];
      
      for (const strategy of strategies) {
        console.log(`\n🎯 Trying strategy: ${strategy.name}`);
        const elements = strategy.elements();
        
        if (elements.length > 0) {
          console.log(`Found ${elements.length} potential products with ${strategy.name}`);
          
          const extractedProducts = elements.map((el, index) => {
            console.log(`\n📋 Analyzing element ${index + 1} from ${strategy.name}:`);
            
            // Extract title
            const titleSelectors = [
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              '.product-title', '.product-name', '.title', '.name',
              '.item-title', '.card-title', '.tile-title',
              '[data-title]', '[data-name]'
            ];
            
            let title = '';
            for (const selector of titleSelectors) {
              const titleEl = el.querySelector(selector);
              if (titleEl && titleEl.textContent.trim()) {
                title = titleEl.textContent.trim();
                console.log(`  Title found with ${selector}: "${title}"`);
                break;
              }
            }
            
            // If no title found, try to get meaningful text
            if (!title) {
              const textContent = el.textContent.trim();
              const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
              if (lines.length > 0) {
                title = lines[0].substring(0, 100);
                console.log(`  Title extracted from text: "${title}"`);
              }
            }
            
            // Extract price
            const priceSelectors = [
              '.price', '.product-price', '[data-price]', '.cost', '.amount',
              '.item-price', '.card-price', '.tile-price',
              '.price-current', '.price-regular', '.price-sale'
            ];
            
            let price = '';
            for (const selector of priceSelectors) {
              const priceEl = el.querySelector(selector);
              if (priceEl && priceEl.textContent.trim()) {
                price = priceEl.textContent.trim();
                console.log(`  Price found with ${selector}: "${price}"`);
                break;
              }
            }
            
            // Extract image
            const imageEl = el.querySelector('img');
            const image = imageEl ? imageEl.src : '';
            if (image) {
              console.log(`  Image found: ${image.substring(0, 50)}...`);
            }
            
            // Extract URL
            const linkEl = el.querySelector('a') || (el.tagName === 'A' ? el : null);
            const url = linkEl ? linkEl.href : '';
            if (url) {
              console.log(`  URL found: ${url}`);
            }
            
            return {
              title,
              price,
              image,
              url,
              strategy: strategy.name,
              elementIndex: index
            };
          }).filter(p => p.title && p.title.length > 0);
          
          allProducts.push(...extractedProducts);
          console.log(`✅ Extracted ${extractedProducts.length} products from ${strategy.name}`);
        }
      }
      
      // Remove duplicates based on title
      const uniqueProducts = [];
      const seenTitles = new Set();
      
      for (const product of allProducts) {
        if (!seenTitles.has(product.title)) {
          seenTitles.add(product.title);
          uniqueProducts.push(product);
        }
      }
      
      console.log(`\n🎉 Final result: ${uniqueProducts.length} unique products found`);
      return uniqueProducts;
    });
    
    console.log('\n📊 Product Extraction Results:');
    console.log(`Found ${products.length} products`);
    
    products.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.title}`);
      console.log(`   Price: ${product.price || 'N/A'}`);
      console.log(`   URL: ${product.url || 'N/A'}`);
      console.log(`   Strategy: ${product.strategy}`);
      if (product.image) {
        console.log(`   Image: ${product.image.substring(0, 50)}...`);
      }
    });
    
    // Save results to file
    const fs = require('fs');
    fs.writeFileSync('product-extraction-results.json', JSON.stringify(products, null, 2));
    console.log('\n💾 Results saved to product-extraction-results.json');
    
  } catch (error) {
    console.error('❌ Error during product extraction:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testProductExtraction(); 