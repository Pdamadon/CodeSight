const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔍 Debugging fashion site structure...');
  
  const browser = await chromium.launch({ headless: false }); // Show browser for debugging
  const page = await browser.newPage();

  const testUrl = 'https://www.nordstrom.com/browse/men/clothing/jeans';
  
  console.log(`\n📍 Testing URL: ${testUrl}`);
  
  try {
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait longer for dynamic content
    
    // Debug: Get page title and basic info
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    
    // Debug: Check for common React/SPA patterns
    const debugInfo = await page.evaluate(() => {
      const info = {
        hasReact: !!window.React,
        hasAngular: !!window.angular,
        hasVue: !!window.Vue,
        totalElements: document.querySelectorAll('*').length,
        divCount: document.querySelectorAll('div').length,
        hasDataTestIds: document.querySelectorAll('[data-testid]').length,
        hasProductClass: document.querySelectorAll('[class*="product"]').length,
        hasItemClass: document.querySelectorAll('[class*="item"]').length,
        bodyClasses: document.body.className,
        scripts: Array.from(document.querySelectorAll('script')).length
      };
      
      // Look for any elements that might be product containers
      const potentialProducts = [];
      
      // Check for data attributes
      const dataTestIds = Array.from(document.querySelectorAll('[data-testid]'))
        .map(el => el.getAttribute('data-testid'))
        .filter(id => id && (id.includes('product') || id.includes('item')))
        .slice(0, 10);
      
      // Check for classes with product/item
      const productClasses = Array.from(document.querySelectorAll('[class*="product"], [class*="item"]'))
        .map(el => el.className)
        .filter(cls => cls && (cls.includes('product') || cls.includes('item')))
        .slice(0, 10);
      
      return {
        ...info,
        sampleDataTestIds: dataTestIds,
        sampleProductClasses: productClasses,
        bodyHTML: document.body.innerHTML.substring(0, 1000) // First 1000 chars
      };
    });
    
    console.log('\n🔍 Debug Info:');
    console.log('- Has React:', debugInfo.hasReact);
    console.log('- Total elements:', debugInfo.totalElements);
    console.log('- Elements with data-testid:', debugInfo.hasDataTestIds);
    console.log('- Elements with "product" in class:', debugInfo.hasProductClass);
    console.log('- Elements with "item" in class:', debugInfo.hasItemClass);
    console.log('- Sample data-testids:', debugInfo.sampleDataTestIds);
    console.log('- Sample product classes:', debugInfo.sampleProductClasses);
    
    // Save debug info
    fs.writeFileSync('nordstrom-debug-info.json', JSON.stringify(debugInfo, null, 2));
    console.log('\n💾 Debug info saved to nordstrom-debug-info.json');
    
    // Wait for user to see the page
    console.log('\n👀 Browser is open - check the page manually');
    console.log('Press Ctrl+C when ready to close');
    
    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }
  
  await browser.close();
})();