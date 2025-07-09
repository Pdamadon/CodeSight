const { PrismaClient } = require('@prisma/client');
const redis = require('redis');

// Initialize Prisma Client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Initialize Redis Client
let redisClient = null;

const initializeRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Connected to Redis');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn('⚠️ Redis not available, continuing without caching:', error.message);
    return null;
  }
};

// Database connection test
const testConnection = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Test Redis connection
    await initializeRedis();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
const disconnectDatabase = async () => {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('✅ Redis disconnected');
    }
    
    await prisma.$disconnect();
    console.log('✅ PostgreSQL disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
};

// Cache helper functions
const cache = {
  get: async (key) => {
    if (!redisClient) return null;
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Redis get error:', error);
      return null;
    }
  },

  set: async (key, value, expireInSeconds = 3600) => {
    if (!redisClient) return false;
    try {
      await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Redis set error:', error);
      return false;
    }
  },

  del: async (key) => {
    if (!redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.warn('Redis delete error:', error);
      return false;
    }
  },

  // Clear all cached product data
  clearProducts: async () => {
    if (!redisClient) return false;
    try {
      const keys = await redisClient.keys('products:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.warn('Redis clear products error:', error);
      return false;
    }
  }
};

module.exports = {
  prisma,
  redisClient: () => redisClient,
  testConnection,
  disconnectDatabase,
  cache
};