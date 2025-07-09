#!/usr/bin/env node

// Test script to demonstrate autonomous OpenAI-powered scraping

import { ScrapingAgent } from './dist/agents/ScrapingAgent.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testAutonomousMode() {
  console.log('🤖 Testing Autonomous Mode with OpenAI Integration');
  console.log('='.repeat(60));

  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not found in environment variables');
    console.log('Please set your OpenAI API key in .env file:');
    console.log('OPENAI_API_KEY=your_api_key_here');
    return;
  }

  console.log('✅ OpenAI API key found');
  console.log('🚀 Initializing autonomous scraping agent...\n');

  const agent = new ScrapingAgent();

  // Test 1: Traditional mode vs Autonomous mode
  console.log('📋 Test 1: Comparing Traditional vs Autonomous Modes');
  console.log('-'.repeat(50));

  const testUrl = 'https://example.com';
  const targets = ['title', 'content'];

  try {
    // Traditional mode
    console.log('🔄 Running in Traditional Mode...');
    const traditionalResult = await agent.scrapeWebsite({
      url: testUrl,
      targets,
      headless: true,
      timeout: 30000
    });

    console.log('✅ Traditional Mode Results:');
    console.log(`   Success: ${traditionalResult.success}`);
    console.log(`   Data Points: ${Object.keys(traditionalResult.data).length}`);
    console.log(`   Execution Time: ${traditionalResult.executionTime}ms`);
    console.log(`   Selectors Used: ${Object.keys(traditionalResult.selectors).length}`);
    console.log();

    // Autonomous mode
    console.log('🤖 Running in Autonomous Mode...');
    const autonomousResult = await agent.scrapeWebsite({
      url: testUrl,
      targets,
      headless: true,
      timeout: 60000,
      autonomous: true
    });

    console.log('✅ Autonomous Mode Results:');
    console.log(`   Success: ${autonomousResult.success}`);
    console.log(`   Data Points: ${Object.keys(autonomousResult.data).length}`);
    console.log(`   Execution Time: ${autonomousResult.executionTime}ms`);
    
    if (autonomousResult.autonomous) {
      console.log(`   AI Steps Taken: ${autonomousResult.autonomous.steps.length}`);
      console.log(`   AI Confidence: ${(autonomousResult.autonomous.confidence * 100).toFixed(1)}%`);
      console.log(`   AI Reasoning: ${autonomousResult.autonomous.reasoning}`);
      
      console.log('\n🎯 Step-by-Step Autonomous Actions:');
      autonomousResult.autonomous.steps.forEach((step, index) => {
        const status = step.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${step.action.toUpperCase()}`);
        if (step.data) {
          console.log(`      Data: ${JSON.stringify(step.data).substring(0, 100)}...`);
        }
        if (step.error) {
          console.log(`      Error: ${step.error}`);
        }
      });
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Autonomous Mode Features:');
  console.log('✅ OpenAI GPT-4 powered decision making');
  console.log('✅ Adaptive interaction planning');
  console.log('✅ Intelligent selector generation');
  console.log('✅ Context-aware goal achievement');
  console.log('✅ Self-correcting behavior');
  console.log('✅ Detailed reasoning and confidence scores');

  console.log('\n🎯 Use Cases for Autonomous Mode:');
  console.log('• Complex multi-step workflows');
  console.log('• Dynamic content that requires interaction');
  console.log('• Unknown website structures');
  console.log('• High-value data extraction where precision matters');
  console.log('• When you need detailed reasoning for decisions');

  console.log('\n⚙️  Configuration:');
  console.log('• Set autonomous: true in scrape requests');
  console.log('• Requires OPENAI_API_KEY environment variable');
  console.log('• Uses GPT-4 for intelligent decision making');
  console.log('• Automatically learns and adapts strategies');

  await agent.close();
  console.log('\n✅ Autonomous testing completed!');
}

// Example usage scenarios
async function showExampleUsage() {
  console.log('\n📝 Example Usage Scenarios:');
  console.log('='.repeat(60));

  const examples = [
    {
      name: 'E-commerce Product Scraping',
      request: {
        url: 'https://shop.example.com/product/123',
        targets: ['product title', 'price', 'description', 'reviews'],
        autonomous: true
      },
      description: 'AI will intelligently navigate product pages, handle dynamic content, and extract comprehensive product data'
    },
    {
      name: 'News Article Extraction',
      request: {
        url: 'https://news.example.com/article/456',
        targets: ['headline', 'author', 'content', 'publish date'],
        autonomous: true
      },
      description: 'AI will identify article structure, handle paywalls or click-to-expand content, and extract full article data'
    },
    {
      name: 'Search Results Navigation',
      request: {
        url: 'https://search.example.com/results?q=topic',
        targets: ['search results', 'pagination'],
        autonomous: true,
        interactions: ['click next page', 'load more results']
      },
      description: 'AI will navigate search results, handle pagination, and collect comprehensive result data'
    }
  ];

  examples.forEach((example, index) => {
    console.log(`\n${index + 1}. ${example.name}:`);
    console.log(`   ${example.description}`);
    console.log(`   Request: ${JSON.stringify(example.request, null, 2)}`);
  });

  console.log('\n🔑 Key Advantages of Autonomous Mode:');
  console.log('• Handles complex, multi-step workflows automatically');
  console.log('• Adapts to different website structures without manual configuration');
  console.log('• Provides detailed reasoning for every decision made');
  console.log('• Learns from interactions to improve future performance');
  console.log('• Reduces need for manual selector writing and maintenance');
}

// Run the tests
async function main() {
  await testAutonomousMode();
  await showExampleUsage();
}

main().catch(console.error);