const fs = require('fs');

// Simple regex-based extraction test
async function testExtractionSimple() {
  try {
    const htmlFile = 'debug-1751648382610.html';
    if (!fs.existsSync(htmlFile)) {
      console.log('File not found:', htmlFile);
      return;
    }
    console.log(`Testing extraction with: ${htmlFile}`);
    const html = fs.readFileSync(htmlFile, 'utf8');
    
    // Count product cards
    const productCardMatches = html.match(/data-component="desktopSimpleProduct"/g);
    console.log(`Found ${productCardMatches ? productCardMatches.length : 0} product cards`);
    
    // Extract product information using regex
    const productRegex = /<div[^>]*data-component="desktopSimpleProduct"[^>]*>(.*?)<\/div>/gs;
    const products = [];
    let match;
    let count = 0;
    
    // Print the first product card's HTML for debugging
    const firstMatch = productRegex.exec(html);
    if (firstMatch) {
      console.log('\n--- First product card HTML ---\n');
      console.log(firstMatch[1].slice(0, 2000)); // Print first 2000 chars
      console.log('\n--- End of product card HTML ---\n');
    }
    // Reset regex index for actual extraction
    productRegex.lastIndex = 0;
    
    while ((match = productRegex.exec(html)) !== null && count < 10) {
      const productHtml = match[1];
      count++;
      
      // Extract product name
      let productName = '';
      const nameMatch = productHtml.match(/<span[^>]*class="[^"]*transformedName[^"]*"[^>]*>(.*?)<\/span>/s);
      if (nameMatch) {
        productName = nameMatch[1].replace(/<[^>]*>/g, '').trim();
      } else {
        // Try to get from alt attribute of product image
        const imgAltMatch = productHtml.match(/<img[^>]*data-component="productImage"[^>]*alt="([^"]*)"/s);
        if (imgAltMatch) {
          productName = imgAltMatch[1].trim();
        }
      }
      
      // Extract price
      const priceMatch = productHtml.match(/<span[^>]*class="[^"]*mbp2303[^"]*"[^>]*>(.*?)<\/span>/s);
      const price = priceMatch ? priceMatch[1].trim() : '';
      
      // Extract sale price
      const salePriceMatch = productHtml.match(/<span[^>]*class="[^"]*mbp2289[^"]*"[^>]*><strong>(.*?)<\/strong><\/span>/s);
      const salePrice = salePriceMatch ? salePriceMatch[1].trim() : '';
      
      // Extract URL
      const urlMatch = productHtml.match(/href="([^"]*)"[^>]*data-component="linkRender"/s);
      const url = urlMatch ? urlMatch[1] : '';
      
      // Extract image
      const imgMatch = productHtml.match(/<img[^>]*data-component="productImage"[^>]*src="([^"]*)"/s);
      const imageUrl = imgMatch ? imgMatch[1] : '';
      
      // Extract delivery type
      const deliveryMatch = productHtml.match(/<div[^>]*class="[^"]*mbp2314[^"]*"[^>]*>(.*?)<\/div>/s);
      const deliveryType = deliveryMatch ? deliveryMatch[1].trim() : '';
      
      // Extract options available
      const optionsMatch = productHtml.match(/<p[^>]*class="[^"]*mbp2221[^"]*"[^>]*>(.*?)<\/p>/s);
      const optionsAvailable = optionsMatch ? optionsMatch[1].trim() : '';
      
      // Extract brand
      const brandMatch = productHtml.match(/<p[^>]*class="[^"]*mbp2216 mbp2193[^"]*"[^>]*>(.*?)<\/p>/s);
      const brand = brandMatch ? brandMatch[1].trim() : '';
      
      // Extract passport eligibility
      const passportMatch = productHtml.match(/<span[^>]*>[^<]*Passport[^<]*<\/span>/s);
      const passportEligible = passportMatch ? passportMatch[0].replace(/<[^>]*>/g, '').trim() : '';
      
      // Extract product ID
      const staticIdMatch = productHtml.match(/data-staticid="([^"]*)"/s);
      const productId = staticIdMatch ? staticIdMatch[1].replace('product-item-', '') : '';
      
      if (productName) {
        const product = {
          name: productName,
          price: salePrice || price,
          originalPrice: salePrice ? price : null,
          url: url,
          imageUrl: imageUrl,
          deliveryType: deliveryType,
          optionsAvailable: optionsAvailable,
          brand: brand,
          passportEligible: passportEligible,
          productId: productId,
          site: '1800flowers.com'
        };
        
        console.log(`✅ Product ${count}: ${product.name} - ${product.price}`);
        products.push(product);
      } else {
        console.log(`⚠️ Skipping product ${count} - no name found`);
      }
    }
    
    console.log(`\n🎉 Successfully extracted ${products.length} products`);
    
    // Show first few products in detail
    products.slice(0, 3).forEach((product, i) => {
      console.log(`\nProduct ${i + 1}:`);
      console.log(`  Name: ${product.name}`);
      console.log(`  Price: ${product.price}`);
      console.log(`  Original Price: ${product.originalPrice || 'N/A'}`);
      console.log(`  URL: ${product.url}`);
      console.log(`  Image: ${product.imageUrl ? 'Yes' : 'No'}`);
      console.log(`  Delivery: ${product.deliveryType}`);
      console.log(`  Options: ${product.optionsAvailable}`);
      console.log(`  Brand: ${product.brand}`);
      console.log(`  Passport: ${product.passportEligible}`);
      console.log(`  ID: ${product.productId}`);
    });
    
    return products;
    
  } catch (error) {
    console.error('Error testing extraction:', error);
  }
}

testExtractionSimple(); 