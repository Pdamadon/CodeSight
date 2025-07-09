#!/usr/bin/env node

// Test script to demonstrate autonomous mode on real websites

import { ScrapingAgent } from './dist/agents/ScrapingAgent.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testRealAutonomousMode() {
  console.log('🤖 Testing REAL Autonomous Mode on Live Websites');
  console.log('='.repeat(60));

  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY required for autonomous mode');
    return;
  }

  const agent = new ScrapingAgent();

  // Test cases with real websites
  const testCases = [
    {
      name: 'News Website - BBC',
      url: 'https://www.bbc.com/news',
      targets: ['headline', 'article summary'],
      autonomous: true,
      timeout: 45000
    },
    {
      name: 'E-commerce - Amazon Product',
      url: 'https://www.amazon.com/dp/B08N5WRWNW',
      targets: ['product title', 'price', 'rating'],
      autonomous: true,
      timeout: 60000
    },
    {
      name: 'Social Media - Twitter',
      url: 'https://twitter.com/openai',
      targets: ['tweet content', 'username'],
      autonomous: true,
      timeout: 45000
    },
    {
      name: 'Wikipedia Article',
      url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      targets: ['article title', 'first paragraph', 'table of contents'],
      autonomous: true,
      timeout: 30000
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🎯 Testing: ${testCase.name}`);
    console.log('-'.repeat(50));
    console.log(`URL: ${testCase.url}`);
    console.log(`Targets: ${testCase.targets.join(', ')}`);
    console.log(`Autonomous: ${testCase.autonomous}`);
    
    try {
      const startTime = Date.now();
      const result = await agent.scrapeWebsite(testCase);
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ Results for ${testCase.name}:`);
      console.log(`   Success: ${result.success}`);
      console.log(`   Execution Time: ${duration}ms`);
      console.log(`   Data Points Extracted: ${Object.keys(result.data).length}`);
      
      if (result.autonomous) {
        console.log(`   AI Steps: ${result.autonomous.steps.length}`);
        console.log(`   AI Confidence: ${(result.autonomous.confidence * 100).toFixed(1)}%`);
        console.log(`   AI Reasoning: ${result.autonomous.reasoning}`);
        
        console.log('\n🎯 AI Decision Steps:');
        result.autonomous.steps.forEach((step, index) => {
          const status = step.success ? '✅' : '❌';
          console.log(`   ${index + 1}. ${status} ${step.action.toUpperCase()}`);
          if (step.data && Object.keys(step.data).length > 0) {
            console.log(`      → Extracted: ${Object.keys(step.data).join(', ')}`);
          }
          if (step.error) {
            console.log(`      → Error: ${step.error}`);
          }
        });
      }
      
      if (result.success && Object.keys(result.data).length > 0) {
        console.log('\n📊 Extracted Data:');
        for (const [key, value] of Object.entries(result.data)) {
          if (value && typeof value === 'object' && value.text) {
            const preview = value.text.substring(0, 100);
            console.log(`   ${key}: "${preview}${value.text.length > 100 ? '...' : ''}"`);
          }
        }
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️  Errors:');
        result.errors.forEach(error => console.log(`   - ${error}`));
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50));
    
    // Wait between tests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await agent.close();
  console.log('\n✅ All autonomous tests completed!');
}

async function demonstrateInteractiveMode() {
  console.log('\n🎮 Interactive Autonomous Mode Demo');
  console.log('='.repeat(60));
  
  const agent = new ScrapingAgent();
  
  // Test with interactions
  const interactiveTest = {
    name: 'Search Results with Navigation',
    url: 'https://duckduckgo.com/?q=artificial+intelligence',
    targets: ['search results', 'result titles', 'result snippets'],
    autonomous: true,
    interactions: ['click more results', 'scroll to load more'],
    timeout: 60000
  };
  
  console.log(`🎯 Testing: ${interactiveTest.name}`);
  console.log(`URL: ${interactiveTest.url}`);
  console.log(`Targets: ${interactiveTest.targets.join(', ')}`);
  console.log(`Interactions: ${interactiveTest.interactions.join(', ')}`);
  
  try {
    const result = await agent.scrapeWebsite(interactiveTest);
    
    console.log(`\n✅ Interactive Results:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Data Points: ${Object.keys(result.data).length}`);
    
    if (result.autonomous) {
      console.log(`   AI Steps: ${result.autonomous.steps.length}`);
      console.log(`   AI Confidence: ${(result.autonomous.confidence * 100).toFixed(1)}%`);
      
      console.log('\n🤖 AI Interactive Steps:');
      result.autonomous.steps.forEach((step, index) => {
        const status = step.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${step.action.toUpperCase()}`);
        if (step.data) {
          console.log(`      → Action Data: ${JSON.stringify(step.data).substring(0, 100)}...`);
        }
      });
    }
    
  } catch (error) {
    console.log(`❌ Interactive test failed: ${error.message}`);
  }
  
  await agent.close();
}

async function main() {
  console.log('🚀 Starting Comprehensive Autonomous Testing...\n');
  
  await testRealAutonomousMode();
  await demonstrateInteractiveMode();
  
  console.log('\n🎉 All autonomous testing completed!');
  console.log('\n💡 Key Insights:');
  console.log('• Autonomous mode adapts to different website structures');
  console.log('• AI makes intelligent decisions about data extraction');
  console.log('• Each website requires different strategies');
  console.log('• The system learns from successes and failures');
  console.log('• Complex interactions are handled automatically');
}

main().catch(console.error);