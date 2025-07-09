const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🚀 Extracting fashion site categories...');
  const startTime = Date.now();
  
  const browser = await chromium.launch({ headless: false }); // Show browser to see what we're working with
  const page = await browser.newPage();

  // Test with a mid-size fashion retailer
  const testUrl = 'https://www.uniqlo.com/us/en/';
  
  console.log(`\n📍 Extracting categories from: ${testUrl}`);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const categories = await page.evaluate(() => {
      const categories = [];
      
      // Look for navigation links that might lead to product categories
      const navSelectors = [
        'nav a[href]',
        '.navigation a[href]',
        '.menu a[href]',
        '.nav-link',
        '[class*="nav"] a[href]',
        '[class*="menu"] a[href]',
        '.header a[href]',
        'header a[href]'
      ];
      
      const foundLinks = new Set();
      
      for (const selector of navSelectors) {
        const links = document.querySelectorAll(selector);
        links.forEach(link => {
          const href = link.href;
          const text = link.textContent.trim();
          
          // Filter for fashion-related categories
          const fashionKeywords = [
            'men', 'women', 'kids', 'children', 'baby',
            'jeans', 'pants', 'shirts', 'tops', 'dresses',
            'shoes', 'accessories', 'bags', 'jewelry',
            'clothing', 'apparel', 'fashion', 'wear',
            'jackets', 'coats', 'sweaters', 'knitwear',
            'collection', 'new', 'sale', 'clearance'
          ];
          
          const isRelevant = text && href && 
            (fashionKeywords.some(keyword => 
              text.toLowerCase().includes(keyword) || 
              href.toLowerCase().includes(keyword)
            )) &&
            !href.includes('#') && // Skip anchor links
            !href.includes('mailto:') && // Skip email links
            !href.includes('tel:') && // Skip phone links
            href.includes(window.location.hostname) && // Only internal links
            text.length > 1 && text.length < 50; // Reasonable text length
          
          if (isRelevant && !foundLinks.has(href)) {
            foundLinks.add(href);
            categories.push({
              text: text,
              href: href,
              selector: selector
            });
          }
        });
      }
      
      // Also look for specific product collection pages
      const collectionSelectors = [
        'a[href*="/collections/"]',
        'a[href*="/category/"]',
        'a[href*="/shop/"]',
        'a[href*="/products/"]',
        'a[href*="/men/"]',
        'a[href*="/women/"]'
      ];
      
      for (const selector of collectionSelectors) {
        const links = document.querySelectorAll(selector);
        links.forEach(link => {
          const href = link.href;
          const text = link.textContent.trim() || link.getAttribute('title') || 'Collection';
          
          if (href && !foundLinks.has(href) && text.length > 1) {
            foundLinks.add(href);
            categories.push({
              text: text,
              href: href,
              selector: selector + ' (collection)'
            });
          }
        });
      }
      
      return categories;
    });
    
    console.log(`\n✅ Found ${categories.length} fashion categories`);
    
    if (categories.length > 0) {
      console.log('\n📦 Fashion categories:');
      categories.forEach((cat, i) => {
        console.log(`${i + 1}. ${cat.text} — ${cat.href}`);
      });
      
      // Save categories
      fs.writeFileSync('uniqlo-fashion-categories.json', JSON.stringify(categories, null, 2));
      console.log('\n💾 Saved categories to uniqlo-fashion-categories.json');
    } else {
      console.log('\n❌ No fashion categories found');
      
      // Debug - show all links found
      const allLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 20);
        return links.map(link => ({
          text: link.textContent.trim(),
          href: link.href
        }));
      });
      
      console.log('\nFirst 20 links found for debugging:');
      allLinks.forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}" → ${link.href}`);
      });
    }
    
  } catch (err) {
    console.error(`❌ Error extracting categories:`, err.message);
  }
  
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;
  console.log(`\n🏁 Category extraction completed in ${totalTime.toFixed(2)} seconds`);
  
  // Keep browser open for manual inspection
  console.log('\n👀 Browser open for inspection - press Ctrl+C to close');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
})();