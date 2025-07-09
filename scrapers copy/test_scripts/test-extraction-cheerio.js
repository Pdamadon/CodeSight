const fs = require('fs');
const cheerio = require('cheerio');

// Test extraction using cheerio for better HTML parsing
async function testExtractionCheerio() {
  try {
    const htmlFile = 'debug-1751648382610.html';
    if (!fs.existsSync(htmlFile)) {
      console.log('File not found:', htmlFile);
      return;
    }
    
    console.log(`Testing extraction with cheerio: ${htmlFile}`);
    const html = fs.readFileSync(htmlFile, 'utf8');
    
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    // Find all product cards
    const productCards = $('div[data-component="desktopSimpleProduct"]');
    console.log(`Found ${productCards.length} product cards`);
    
    const products = [];
    
    // Extract product information from each card
    productCards.each((index, element) => {
      if (index >= 10) return; // Limit to first 10 for testing
      
      const $card = $(element);
      
      // Extract product name from image alt attribute
      const $img = $card.find('img[data-component="productImage"]');
      const productName = $img.attr('alt') || '';
      
      // Extract product URL
      const $link = $card.find('a[data-testid]');
      const productUrl = $link.attr('href') || '';
      const testId = $link.attr('data-testid') || '';
      
      // Extract image URL
      const imageUrl = $img.attr('src') || $img.attr('data-src') || '';
      
      // Extract price (try multiple selectors)
      let price = '';
      const $price = $card.find('[data-component="price"], .price, [class*="price"]').first();
      if ($price.length) {
        price = $price.text().trim();
      }
      
      if (productName) {
        products.push({
          name: productName,
          url: productUrl,
          image: imageUrl,
          price: price,
          testId: testId
        });
        
        console.log(`\n[${index + 1}] Product: ${productName}`);
        console.log(`   URL: ${productUrl}`);
        console.log(`   Price: ${price}`);
        console.log(`   Test ID: ${testId}`);
      }
    });
    
    console.log(`\n✅ Successfully extracted ${products.length} products`);
    
    // Save results to JSON file
    fs.writeFileSync('extracted-products.json', JSON.stringify(products, null, 2));
    console.log('📄 Results saved to extracted-products.json');
    
  } catch (error) {
    console.error('❌ Error during extraction:', error);
  }
}

testExtractionCheerio(); 