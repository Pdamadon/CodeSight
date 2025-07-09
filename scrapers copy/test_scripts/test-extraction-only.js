const fs = require('fs');

// Test the extraction logic with the captured HTML
async function testExtraction() {
  try {
    // Read the most recent HTML file
    const files = fs.readdirSync('.').filter(f => f.startsWith('debug-') && f.endsWith('.html'));
    const latestFile = files.sort().pop();
    
    if (!latestFile) {
      console.log('No debug HTML files found');
      return;
    }
    
    console.log(`Testing extraction with: ${latestFile}`);
    const html = fs.readFileSync(latestFile, 'utf8');
    
    // Create a simple DOM-like environment
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Mock console.log for the browser environment
    const consoleLogs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      consoleLogs.push(args.join(' '));
      originalLog(...args);
    };
    
    // Run the extraction logic
    const productCards = document.querySelectorAll('div[data-component="desktopSimpleProduct"]');
    console.log(`Found ${productCards.length} product cards with data-component="desktopSimpleProduct"`);
    
    const extractedProducts = [];
    
    productCards.forEach((card, index) => {
      try {
        console.log(`Processing product card ${index + 1}...`);
        
        // Extract product name from the transformedName span
        const nameElement = card.querySelector('[data-component="productName"] .transformedName');
        const productName = nameElement ? nameElement.textContent.trim() : '';
        
        // Extract price from the retail-price-range span
        const priceElement = card.querySelector('[data-testid="retail-price-range"] .mbp2303');
        const price = priceElement ? priceElement.textContent.trim() : '';
        
        // Extract sale price if available
        const salePriceElement = card.querySelector('[data-testid="sale-price"] .mbp2289 strong');
        const salePrice = salePriceElement ? salePriceElement.textContent.trim() : '';
        
        // Extract product URL from the first link
        const linkElement = card.querySelector('a[data-component="linkRender"]');
        const productUrl = linkElement ? linkElement.href : '';
        
        // Extract image URL
        const imgElement = card.querySelector('img[data-component="productImage"]');
        const imageUrl = imgElement ? imgElement.src : '';
        
        // Extract delivery type
        const deliveryElement = card.querySelector('[data-component="deliveryType"] .mbp2314');
        const deliveryType = deliveryElement ? deliveryElement.textContent.trim() : '';
        
        // Extract options available
        const optionsElement = card.querySelector('.mbp2221');
        const optionsAvailable = optionsElement ? optionsElement.textContent.trim() : '';
        
        // Extract brand if available
        const brandElement = card.querySelector('.mbp2216.mbp2193');
        const brand = brandElement ? brandElement.textContent.trim() : '';
        
        // Extract passport eligibility
        const passportElement = card.querySelector('[data-component="restructurePassport"] span');
        const passportEligible = passportElement ? passportElement.textContent.trim() : '';
        
        // Extract product ID from data-staticid
        const staticId = card.getAttribute('data-staticid') || '';
        const productId = staticId.replace('product-item-', '');
        
        if (productName) {
          const product = {
            name: productName,
            price: salePrice || price,
            originalPrice: salePrice ? price : null,
            url: productUrl,
            imageUrl: imageUrl,
            deliveryType: deliveryType,
            optionsAvailable: optionsAvailable,
            brand: brand,
            passportEligible: passportEligible,
            productId: productId,
            site: '1800flowers.com'
          };
          
          console.log(`✅ Extracted product: ${product.name} - ${product.price}`);
          extractedProducts.push(product);
        } else {
          console.log(`⚠️ Skipping product card ${index + 1} - no name found`);
        }
      } catch (error) {
        console.error(`❌ Error processing product card ${index + 1}:`, error);
      }
    });
    
    console.log(`🎉 Successfully extracted ${extractedProducts.length} products`);
    
    // Show first few products
    extractedProducts.slice(0, 5).forEach((product, i) => {
      console.log(`\nProduct ${i + 1}:`);
      console.log(`  Name: ${product.name}`);
      console.log(`  Price: ${product.price}`);
      console.log(`  URL: ${product.url}`);
      console.log(`  Image: ${product.imageUrl ? 'Yes' : 'No'}`);
      console.log(`  Delivery: ${product.deliveryType}`);
      console.log(`  Brand: ${product.brand}`);
    });
    
    return extractedProducts;
    
  } catch (error) {
    console.error('Error testing extraction:', error);
  }
}

testExtraction(); 