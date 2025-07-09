# Database Setup Guide

This guide will help you set up MongoDB and Pinecone for CodeSight's persistent world model.

## Prerequisites

- Node.js 18+ installed
- MongoDB instance (local or MongoDB Atlas)
- Pinecone account
- OpenAI API key

## 1. MongoDB Setup

### Option A: Local MongoDB

1. Install MongoDB locally:
```bash
# macOS with Homebrew
brew install mongodb/brew/mongodb-community

# Start MongoDB
brew services start mongodb/brew/mongodb-community
```

2. Your connection string will be:
```
MONGODB_CONNECTION_STRING=mongodb://localhost:27017
```

### Option B: MongoDB Atlas (Recommended)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string from "Connect" → "Connect your application"
5. Your connection string will look like:
```
MONGODB_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/
```

## 2. Pinecone Setup

1. Create a free account at [Pinecone](https://www.pinecone.io/)
2. Create a new index with these settings:
   - **Index Name**: `codesight-vectors`
   - **Dimensions**: `1536` (for OpenAI ada-002 embeddings)
   - **Metric**: `cosine`
   - **Cloud**: `AWS`
   - **Region**: `us-east-1`
3. Get your API key from the Pinecone console

## 3. OpenAI API Setup

1. Create an account at [OpenAI](https://platform.openai.com/)
2. Generate an API key
3. Make sure you have access to the `text-embedding-ada-002` model

## 4. Environment Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Fill in your credentials:
```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-key-here

# MongoDB Configuration
MONGODB_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DATABASE=codesight

# Pinecone Configuration
PINECONE_API_KEY=your-pinecone-api-key-here
PINECONE_INDEX_NAME=codesight-vectors
PINECONE_ENVIRONMENT=us-east-1-aws
```

## 5. Install Dependencies

```bash
npm install
```

## 6. Test the Setup

Run the database health check:
```bash
npm run test:db
```

## 7. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CodeSight WorldModel                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐           ┌─────────────────────────┐  │
│  │    MongoDB      │           │       Pinecone         │  │
│  │                 │           │                        │  │
│  │ • Entities      │           │ • Content Embeddings  │  │
│  │ • Relationships │           │ • Semantic Search      │  │
│  │ • Facts         │           │ • RAG Context          │  │
│  │ • Change Log    │           │ • Pattern Matching     │  │
│  │ • Sessions      │           │ • Similarity Search    │  │
│  └─────────────────┘           └─────────────────────────┘  │
│                                                             │
│              ┌─────────────────────────────────────────┐    │
│              │         OpenAI Embeddings              │    │
│              │    (text-embedding-ada-002)            │    │
│              └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 8. Data Flow

1. **Scraping**: Autonomous agent scrapes web pages
2. **Extraction**: Entities, relationships, and facts extracted
3. **Storage**: Structured data → MongoDB, Embeddings → Pinecone
4. **Indexing**: Automatic indexing for fast queries
5. **Retrieval**: Semantic search + structured queries for planning
6. **RAG**: Previous knowledge enriches autonomous decisions

## 9. Scaling Considerations

### MongoDB Scaling
- Use MongoDB Atlas for automatic scaling
- Consider sharding for large datasets
- Monitor index performance

### Pinecone Scaling
- Start with free tier (1M vectors)
- Upgrade to paid plans for higher throughput
- Consider multiple indexes for different use cases

### Cost Optimization
- Use embedding caching to reduce OpenAI API calls
- Implement data retention policies
- Monitor vector storage usage

## 10. Monitoring and Maintenance

### Health Checks
```bash
# Check database connections
npm run monitor:health

# View storage statistics
npm run monitor:metrics

# Check recent scraping activity
npm run monitor:logs
```

### Maintenance Tasks
- Regular data cleanup: `npm run cleanup:old-data`
- Index optimization: `npm run optimize:indexes`
- Backup procedures: `npm run backup:data`

## 11. Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Check connection string format
- Verify network access (IP whitelist for Atlas)
- Ensure user has proper permissions

**Pinecone Index Not Found**
- Verify index name matches environment variable
- Check API key permissions
- Ensure index is in the correct region

**OpenAI API Errors**
- Check API key validity
- Verify billing account status
- Monitor rate limits

**Vector Dimension Mismatch**
- Ensure Pinecone index dimension is 1536
- Check OpenAI embedding model consistency

### Getting Help

1. Check the logs: `npm run monitor:logs`
2. Run health checks: `npm run monitor:health`
3. Review the troubleshooting section in the main README
4. Open an issue on GitHub with error details

## 12. Development Setup

For development, you can use Docker Compose:

```bash
# Start MongoDB and other services
docker-compose up -d

# Your .env file
MONGODB_CONNECTION_STRING=mongodb://localhost:27017
```

See `docker-compose.yml` for the full development setup.