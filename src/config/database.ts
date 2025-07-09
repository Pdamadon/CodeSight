// database.ts - Database configuration for MongoDB + Pinecone

import { StorageConfig } from '../storage/UnifiedStore.js';
import { Logger } from '../monitoring/Logger.js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

export function getDatabaseConfig(): StorageConfig {
  const logger = Logger.getInstance();
  
  // MongoDB configuration
  const mongoConnectionString = process.env.MONGODB_CONNECTION_STRING || 
    process.env.MONGODB_URI || 
    'mongodb://localhost:27017';
  
  const mongoDatabase = process.env.MONGODB_DATABASE || 'codesight';
  
  // Pinecone configuration
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'codesight-vectors';
  const pineconeEnvironment = process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws';
  
  // OpenAI configuration
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  // Validate required environment variables
  if (!pineconeApiKey) {
    logger.warn('PINECONE_API_KEY not found in environment variables');
  }
  
  if (!openaiApiKey) {
    logger.warn('OPENAI_API_KEY not found in environment variables');
  }
  
  const config: StorageConfig = {
    mongodb: {
      connectionString: mongoConnectionString,
      databaseName: mongoDatabase
    },
    pinecone: {
      apiKey: pineconeApiKey || '',
      indexName: pineconeIndexName,
      environment: pineconeEnvironment
    },
    openai: {
      apiKey: openaiApiKey || ''
    }
  };
  
  logger.info('Database configuration loaded', {
    mongodb: {
      hasConnectionString: !!mongoConnectionString,
      database: mongoDatabase
    },
    pinecone: {
      hasApiKey: !!pineconeApiKey,
      indexName: pineconeIndexName,
      environment: pineconeEnvironment
    },
    openai: {
      hasApiKey: !!openaiApiKey
    }
  });
  
  return config;
}

export function validateDatabaseConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check MongoDB
  if (!process.env.MONGODB_CONNECTION_STRING && !process.env.MONGODB_URI) {
    warnings.push('MongoDB connection string not provided, using default localhost');
  }
  
  // Check Pinecone
  if (!process.env.PINECONE_API_KEY) {
    errors.push('PINECONE_API_KEY is required for vector storage');
  }
  
  // Check OpenAI
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required for embedding generation');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export const DB_CONFIG = getDatabaseConfig();