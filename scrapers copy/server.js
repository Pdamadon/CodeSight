// Load environment variables
require('dotenv').config();

// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const buildCheckoutCart = require('./cartBuilder');
const ProductDiscovery = require('./productDiscovery');
const UniversalCartBuilder = require('./universalCartBuilder');

// Import database and routes
const { testConnection, disconnectDatabase } = require('./lib/database');
const authRoutes = require('./routes/auth');
const addressRoutes = require('./routes/addresses');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/orders', orderRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Legacy endpoint for backward compatibility
app.post('/build-cart', async (req, res) => {
  const {
    productUrl,
    variantName,
    zipCode,
    cardMessage,
    deliveryDateLabel,
    email,
    firstName,
    lastName,
    address1,
    address2,
    city,
    zip,
    country,
    province,
    phone,
  } = req.body;

  console.log('📦 Incoming cart request:', req.body);

  if (!productUrl || !zipCode || !cardMessage || !deliveryDateLabel) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const result = await buildCheckoutCart({
      productUrl,
      variantName: variantName || 'Modest',
      zipCode,
      cardMessage,
      deliveryDateLabel,
      email,
      firstName,
      lastName,
      address1,
      address2,
      city,
      zip,
      country,
      province,
      phone,
    });

    if (!result || !result.checkoutUrl) {
      throw new Error('Failed to reach checkout');
    }

    return res.status(200).json({ checkoutUrl: result.checkoutUrl });
  } catch (err) {
    console.error('❌ Cart creation failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// New AI-powered product discovery endpoint
app.post('/discover-products', async (req, res) => {
  const { userRequest } = req.body;

  console.log('🔍 Product discovery request:', userRequest);

  if (!userRequest) {
    return res.status(400).json({ error: 'Missing user request.' });
  }

  try {
    const discovery = new ProductDiscovery();
    const result = await discovery.discoverProducts(userRequest);

    return res.status(200).json(result);
  } catch (err) {
    console.error('❌ Product discovery failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// New universal cart building endpoint
app.post('/build-universal-cart', async (req, res) => {
  const {
    productUrl,
    variantName,
    quantity = 1,
    zipCode,
    cardMessage,
    deliveryDate,
    customerInfo = {}
  } = req.body;

  console.log('🌐 Universal cart request:', {
    productUrl,
    variantName,
    quantity,
    zipCode,
    cardMessage,
    deliveryDate
  });

  if (!productUrl) {
    return res.status(400).json({ error: 'Missing product URL.' });
  }

  try {
    const cartBuilder = new UniversalCartBuilder();
    const result = await cartBuilder.buildCart({
      productUrl,
      variantName,
      quantity,
      zipCode,
      cardMessage,
      deliveryDate,
      customerInfo
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('❌ Universal cart creation failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Combined endpoint: discover products and build cart in one request
app.post('/smart-order', async (req, res) => {
  const {
    userRequest,
    zipCode,
    cardMessage,
    deliveryDate,
    customerInfo = {},
    selectedProductIndex = 0 // Which product from discovery results to use
  } = req.body;

  console.log('🧠 Smart order request:', userRequest);

  if (!userRequest) {
    return res.status(400).json({ error: 'Missing user request.' });
  }

  try {
    // Step 1: Discover products
    const discovery = new ProductDiscovery();
    const discoveryResult = await discovery.discoverProducts(userRequest);

    if (!discoveryResult.products || discoveryResult.products.length === 0) {
      return res.status(404).json({ error: 'No products found matching your request.' });
    }

    // Step 2: Select the best product (or specified index)
    const selectedProduct = discoveryResult.products[selectedProductIndex];
    if (!selectedProduct) {
      return res.status(400).json({ error: 'Invalid product selection.' });
    }

    // Step 3: Build cart with the selected product
    const cartBuilder = new UniversalCartBuilder();
    const cartResult = await cartBuilder.buildCart({
      productUrl: selectedProduct.url,
      variantName: selectedProduct.variants?.[0]?.name, // Use first variant if available
      quantity: discoveryResult.requirements.quantity || 1,
      zipCode,
      cardMessage,
      deliveryDate,
      customerInfo
    });

    if (cartResult.error) {
      throw new Error(cartResult.error);
    }

    return res.status(200).json({
      discovery: discoveryResult,
      selectedProduct,
      cart: cartResult
    });

  } catch (err) {
    console.error('❌ Smart order failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Legacy health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    endpoints: [
      '/build-cart (legacy)',
      '/discover-products (new)',
      '/build-universal-cart (new)',
      '/smart-order (new)'
    ]
  });
});

// Start server with database connection
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    app.listen(PORT, '0.0.0.0', () => {
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      const ip =
        Object.values(networkInterfaces)
          .flat()
          .find((iface) => iface.family === 'IPv4' && !iface.internal)?.address || 'localhost';

      console.log(`🚀 DoAI API Server running at http://${ip}:${PORT}`);
      console.log('📋 Available endpoints:');
      console.log('  POST /api/auth/register - User registration');
      console.log('  POST /api/auth/login - User login');
      console.log('  GET  /api/auth/profile - User profile');
      console.log('  GET  /api/addresses - User addresses');
      console.log('  POST /api/addresses - Add new address');
      console.log('  GET  /api/orders - User orders');
      console.log('  POST /api/orders - Create new order');
      console.log('  POST /build-cart - Legacy cart building');
      console.log('  POST /discover-products - AI product discovery');
      console.log('  POST /build-universal-cart - Universal cart building');
      console.log('  POST /smart-order - Complete AI-powered ordering');
      console.log('  GET  /api/health - Health check');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Graceful shutdown...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Graceful shutdown...');
  await disconnectDatabase();
  process.exit(0);
});

// Start the server
startServer();