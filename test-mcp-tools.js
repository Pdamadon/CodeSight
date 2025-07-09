#!/usr/bin/env node

// Simple test script to verify MCP tools work
// This simulates calling the MCP tools directly

import { ScrapingAgent } from './dist/agents/ScrapingAgent.js';
import { DOMAnalyzer } from './dist/analyzers/DOMAnalyzer.js';
import { ScriptGenerator } from './dist/generators/ScriptGenerator.js';
import { ValidationSystem } from './dist/validation/ValidationSystem.js';

async function testMCPTools() {
  console.log('🔧 Testing MCP Tools...\n');
  
  // Test 1: DOM Analyzer
  console.log('1. Testing DOM Analyzer...');
  const analyzer = new DOMAnalyzer();
  
  const testHtml = `
    <html>
      <head><title>Test E-commerce</title></head>
      <body>
        <h1 class="product-title">Amazing Product</h1>
        <span class="price">$29.99</span>
        <div class="description">Great product description</div>
        <button class="add-to-cart">Add to Cart</button>
      </body>
    </html>
  `;
  
  try {
    const analysis = await analyzer.analyzeDOM({
      html: testHtml,
      targets: ['title', 'price', 'description']
    });
    
    console.log('✅ DOM analysis completed');
    console.log('   Found selectors:', Object.keys(analysis.selectors));
    console.log('   Confidence scores:', analysis.confidence);
  } catch (error) {
    console.log('❌ DOM analysis failed:', error.message);
  }
  
  // Test 2: Script Generator
  console.log('\n2. Testing Script Generator...');
  const generator = new ScriptGenerator();
  
  try {
    const script = await generator.generateScript({
      url: 'https://example.com',
      selectors: {
        title: '.product-title',
        price: '.price'
      },
      outputFormat: 'playwright'
    });
    
    console.log('✅ Script generation completed');
    console.log('   Script length:', script.length, 'characters');
    console.log('   Contains "chromium":', script.includes('chromium'));
  } catch (error) {
    console.log('❌ Script generation failed:', error.message);
  }
  
  // Test 3: Validation System
  console.log('\n3. Testing Validation System...');
  
  try {
    // Test valid request
    const validResult = ValidationSystem.validateScrapeRequest({
      url: 'https://example.com',
      targets: ['title', 'price'],
      timeout: 30000
    });
    
    if (validResult.success) {
      console.log('✅ Valid request validation passed');
    } else {
      console.log('❌ Valid request validation failed');
    }
    
    // Test invalid request
    const invalidResult = ValidationSystem.validateScrapeRequest({
      url: 'invalid-url',
      targets: [],
      timeout: 100
    });
    
    if (!invalidResult.success && invalidResult.errors.length > 0) {
      console.log('✅ Invalid request validation correctly failed');
      console.log('   Errors found:', invalidResult.errors.length);
    } else {
      console.log('❌ Invalid request validation should have failed');
    }
  } catch (error) {
    console.log('❌ Validation system failed:', error.message);
  }
  
  // Test 4: Error Handling
  console.log('\n4. Testing Error Handling...');
  
  try {
    const agent = new ScrapingAgent();
    
    // Test with invalid URL - should handle gracefully
    const result = await agent.scrapeWebsite({
      url: 'https://definitely-not-a-real-domain-12345.com',
      targets: ['title'],
      timeout: 5000
    });
    
    if (!result.success && result.errors && result.errors.length > 0) {
      console.log('✅ Error handling working correctly');
      console.log('   Error captured:', result.errors[0]);
    } else {
      console.log('❌ Error handling may not be working');
    }
    
    await agent.close();
  } catch (error) {
    console.log('✅ Error handling working (caught exception):', error.message);
  }
  
  console.log('\n🎯 MCP Tools test completed!');
}

testMCPTools().catch(console.error);