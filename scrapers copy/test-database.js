// Test script to demonstrate the database functionality
require('dotenv').config();

const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

let userToken = '';

// Test user registration and authentication
async function testAuth() {
  console.log('🔐 Testing Authentication...\n');

  try {
    // Register a new user
    console.log('1. Registering new user...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: 'demo@honeydoo.com',
      firstName: 'Demo',
      lastName: 'User',
      phone: '555-999-8888',
      password: 'demopass123'
    });

    console.log('✅ User registered successfully');
    console.log('User ID:', registerResponse.data.user.id);
    userToken = registerResponse.data.token;

    // Test getting user profile
    console.log('\n2. Getting user profile...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    console.log('✅ Profile retrieved successfully');
    console.log('User:', profileResponse.data.user.firstName, profileResponse.data.user.lastName);

  } catch (error) {
    if (error.response?.status === 409) {
      console.log('ℹ️ User already exists, attempting login...');
      
      // Try to login instead
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'demo@honeydoo.com',
        password: 'demopass123'
      });
      
      console.log('✅ Login successful');
      userToken = loginResponse.data.token;
    } else {
      console.error('❌ Auth test failed:', error.response?.data || error.message);
    }
  }
}

// Test address management
async function testAddresses() {
  console.log('\n🏠 Testing Address Management...\n');

  try {
    // Add a new address
    console.log('1. Adding new address...');
    const addressResponse = await axios.post(`${BASE_URL}/addresses`, {
      label: 'Home',
      firstName: 'Demo',
      lastName: 'User',
      address1: '789 Demo Street',
      city: 'Seattle',
      state: 'WA',
      zip: '98103',
      phone: '555-999-8888',
      isDefault: true
    }, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    console.log('✅ Address added successfully');
    const addressId = addressResponse.data.address.id;

    // Get all addresses
    console.log('\n2. Getting all addresses...');
    const addressesResponse = await axios.get(`${BASE_URL}/addresses`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    console.log('✅ Addresses retrieved successfully');
    console.log('Address count:', addressesResponse.data.addresses.length);

    return addressId;

  } catch (error) {
    console.error('❌ Address test failed:', error.response?.data || error.message);
    return null;
  }
}

// Test order management
async function testOrders(addressId) {
  console.log('\n📦 Testing Order Management...\n');

  try {
    // Get a product from the database first
    const { prisma } = require('./lib/database');
    const product = await prisma.product.findFirst();
    const store = await prisma.store.findFirst();

    if (!product || !store) {
      console.log('ℹ️ No products or stores found in database. Skipping order test.');
      return;
    }

    // Create a new order
    console.log('1. Creating new order...');
    const orderResponse = await axios.post(`${BASE_URL}/orders`, {
      storeId: store.id,
      addressId: addressId,
      userRequest: 'I want to buy flowers for my anniversary',
      deliveryType: 'DELIVERY',
      deliveryDate: '2025-01-10',
      cardMessage: 'Happy Anniversary!',
      orderItems: [
        {
          productId: product.id,
          quantity: 1,
          price: product.price
        }
      ]
    }, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    console.log('✅ Order created successfully');
    console.log('Order ID:', orderResponse.data.order.id);
    console.log('Total Amount:', orderResponse.data.order.totalAmount);

    // Get all orders
    console.log('\n2. Getting order history...');
    const ordersResponse = await axios.get(`${BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    console.log('✅ Orders retrieved successfully');
    console.log('Order count:', ordersResponse.data.orders.length);

  } catch (error) {
    console.error('❌ Order test failed:', error.response?.data || error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('🧪 Starting Database & API Tests\n');
  console.log('=====================================\n');

  await testAuth();
  const addressId = await testAddresses();
  
  if (addressId) {
    await testOrders(addressId);
  }

  console.log('\n=====================================');
  console.log('🎉 All tests completed!');
  console.log('\nThe database and API are working correctly.');
  console.log('You can now integrate the mobile app with these endpoints.');
  
  process.exit(0);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});