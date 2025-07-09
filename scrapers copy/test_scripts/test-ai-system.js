// test-ai-system.js
const axios = require('axios');

const API_BASE = 'http://localhost:4000';

async function testProductDiscovery() {
  console.log('🧪 Testing AI Product Discovery...\n');

  const testRequests = [
    'I want to buy 5 red roses',
    'Looking for birthday flowers for my mom',
    'Need 12 white tulips for a wedding',
    'Want pink roses under $50',
    'Anniversary flowers with delivery tomorrow'
  ];

  for (const request of testRequests) {
    console.log(`📝 Request: "${request}"`);
    
    try {
      const response = await axios.post(`${API_BASE}/discover-products`, {
        userRequest: request
      });

      const { requirements, products, totalFound } = response.data;
      
      console.log(`✅ Found ${totalFound} products`);
      console.log(`📋 Requirements:`, requirements);
      
      if (products.length > 0) {
        console.log('🏆 Top products:');
        products.slice(0, 3).forEach((product, index) => {
          console.log(`  ${index + 1}. ${product.title} - ${product.price} (${product.relevance}% relevant)`);
        });
      }
      
      console.log('---\n');
    } catch (error) {
      console.error(`❌ Error with request "${request}":`, error.message);
    }
  }
}

async function testSmartOrder() {
  console.log('🧪 Testing Smart Order System...\n');

  const testOrder = {
    userRequest: 'I want to buy 5 red roses for my anniversary',
    zipCode: '98101',
    cardMessage: 'Happy Anniversary! I love you!',
    deliveryDate: 'Thu, 04 July, 2025',
    customerInfo: {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      address1: '123 Test St',
      city: 'Seattle',
      zip: '98101',
      country: 'United States',
      province: 'WA',
      phone: '555-123-4567'
    },
    selectedProductIndex: 0
  };

  try {
    console.log('📝 Smart Order Request:', testOrder.userRequest);
    
    const response = await axios.post(`${API_BASE}/smart-order`, testOrder);
    
    console.log('✅ Smart Order Result:');
    console.log('  Selected Product:', response.data.selectedProduct?.title);
    console.log('  Checkout URL:', response.data.cart?.checkoutUrl);
    console.log('  Requirements:', response.data.discovery?.requirements);
    
  } catch (error) {
    console.error('❌ Smart Order Error:', error.message);
  }
}

async function testUniversalCartBuilder() {
  console.log('🧪 Testing Universal Cart Builder...\n');

  const testCart = {
    productUrl: 'https://www.terrabellaflowers.com/products/citrus',
    variantName: 'Modest',
    quantity: 2,
    zipCode: '98101',
    cardMessage: 'Test message from universal builder',
    deliveryDate: 'Thu, 04 July, 2025',
    customerInfo: {
      email: 'test@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      address1: '456 Test Ave',
      city: 'Seattle',
      zip: '98101',
      country: 'United States',
      province: 'WA',
      phone: '555-987-6543'
    }
  };

  try {
    console.log('📝 Universal Cart Request:', testCart.productUrl);
    
    const response = await axios.post(`${API_BASE}/build-universal-cart`, testCart);
    
    console.log('✅ Universal Cart Result:');
    console.log('  Checkout URL:', response.data.checkoutUrl);
    
  } catch (error) {
    console.error('❌ Universal Cart Error:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting AI-Powered Flower Ordering System Tests\n');
  console.log('=' .repeat(60) + '\n');

  // Test 1: Product Discovery
  await testProductDiscovery();
  
  console.log('=' .repeat(60) + '\n');
  
  // Test 2: Smart Order
  await testSmartOrder();
  
  console.log('=' .repeat(60) + '\n');
  
  // Test 3: Universal Cart Builder
  await testUniversalCartBuilder();
  
  console.log('=' .repeat(60) + '\n');
  console.log('✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testProductDiscovery,
  testSmartOrder,
  testUniversalCartBuilder,
  runAllTests
}; 