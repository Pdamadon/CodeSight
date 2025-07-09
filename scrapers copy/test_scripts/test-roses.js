// test-roses.js
const axios = require('axios');

async function findRoses() {
  const API_URL = 'http://localhost:4000/discover-products';
  const userRequest = 'I want to buy roses';

  try {
    console.log(`🔍 Searching for: "${userRequest}"`);
    console.log('📡 Sending request to:', API_URL);
    
    const response = await axios.post(API_URL, { userRequest });

    console.log('\n📋 Parsed Requirements:');
    console.log(JSON.stringify(response.data.requirements, null, 2));

    if (response.data && response.data.products && response.data.products.length > 0) {
      console.log(`\n✅ Found ${response.data.products.length} rose products (showing top 5):\n`);
      response.data.products.slice(0, 5).forEach((product, idx) => {
        console.log(`--- Product #${idx + 1} ---`);
        console.log(`Title: ${product.title}`);
        console.log(`Price: ${product.price}`);
        console.log(`Site: ${product.site}`);
        console.log(`URL: ${product.url}`);
        if (product.image) console.log(`Image: ${product.image}`);
        if (product.relevance !== undefined) console.log(`Relevance: ${product.relevance}`);
        console.log('');
      });
    } else {
      console.log('❌ No rose products found.');
    }
  } catch (err) {
    console.error('❌ Error searching for roses:', err.message);
    if (err.response && err.response.data) {
      console.error('Server response:', err.response.data);
    }
  }
}

console.log('🚀 Starting Rose Search Test...\n');
findRoses(); 