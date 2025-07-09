#!/usr/bin/env node

// Test the enhanced autonomous mode with intelligent decision making

import { ScrapingAgent } from './dist/agents/ScrapingAgent.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testEnhancedAutonomous() {
  console.log('🚀 Testing Enhanced Autonomous Mode');
  console.log('='.repeat(50));

  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY required for autonomous mode');
    return;
  }

  const agent = new ScrapingAgent();

  // Test cases that showcase the enhanced autonomous capabilities
  const testCases = [
    {
      name: 'News Website Analysis',
      url: 'https://httpbin.org/html',
      targets: ['page title', 'main heading'],
      autonomous: true,
      timeout: 30000,
      expectedType: 'generic'
    },
    {
      name: 'Wikipedia Article Structure',
      url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      targets: ['article title', 'first paragraph'],
      autonomous: true,
      timeout: 45000,
      expectedType: 'wiki'
    },
    {
      name: 'News Article Extraction',
      url: 'https://www.bbc.com/news',
      targets: ['headline', 'article summary'],
      autonomous: true,
      timeout: 60000,
      expectedType: 'news'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🎯 Testing: ${testCase.name}`);
    console.log('-'.repeat(40));
    console.log(`URL: ${testCase.url}`);
    console.log(`Targets: ${testCase.targets.join(', ')}`);
    console.log(`Expected Type: ${testCase.expectedType}`);
    
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
        
        // Analyze the AI's decision-making process
        console.log('\n🧠 AI Decision Analysis:');
        result.autonomous.steps.forEach((step, index) => {
          const status = step.success ? '✅' : '❌';
          console.log(`   ${index + 1}. ${status} ${step.action.toUpperCase()}`);
          
          if (step.data) {
            // Show extraction quality
            for (const [key, value] of Object.entries(step.data)) {
              if (value && typeof value === 'object' && value.text) {
                const confidence = value.confidence || 0;
                const quality = confidence > 0.7 ? '🟢' : confidence > 0.4 ? '🟡' : '🔴';
                console.log(`      ${quality} ${key}: "${value.text.substring(0, 80)}..." (confidence: ${(confidence * 100).toFixed(1)}%)`);
              }
            }
          }
          
          if (step.error) {
            console.log(`      ❌ Error: ${step.error}`);
          }
        });
      }
      
      if (result.success && Object.keys(result.data).length > 0) {
        console.log('\n📊 Final Extracted Data:');
        for (const [key, value] of Object.entries(result.data)) {
          if (value && typeof value === 'object' && value.text) {
            const preview = value.text.substring(0, 150);
            const selector = value.selector || 'unknown';
            console.log(`   📄 ${key}:`);
            console.log(`      Text: "${preview}${value.text.length > 150 ? '...' : ''}"`);
            console.log(`      Selector: ${selector}`);
            console.log(`      Length: ${value.text.length} characters`);
          }
        }
      }
      
      // Test quality assessment
      console.log('\n🔍 Quality Assessment:');
      const hasRelevantData = Object.values(result.data).some(item => 
        item && typeof item === 'object' && item.text && item.text.length > 10
      );
      const hasHighConfidence = Object.values(result.data).some(item => 
        item && typeof item === 'object' && item.confidence && item.confidence > 0.7
      );
      
      console.log(`   Has Relevant Data: ${hasRelevantData ? '✅' : '❌'}`);
      console.log(`   Has High Confidence: ${hasHighConfidence ? '✅' : '❌'}`);
      console.log(`   Overall Quality: ${hasRelevantData && hasHighConfidence ? '🟢 Excellent' : hasRelevantData ? '🟡 Good' : '🔴 Needs Improvement'}`);
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
    
    console.log('\n' + '='.repeat(50));
    
    // Wait between tests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await agent.close();
  console.log('\n🎉 Enhanced Autonomous Testing Complete!');
  
  console.log('\n💡 Key Improvements Demonstrated:');
  console.log('• AI understands page structure and content types');
  console.log('• Intelligent selector generation based on semantic analysis');
  console.log('• Extraction quality validation with confidence scores');
  console.log('• Enhanced context building for better decision making');
  console.log('• Failure analysis and learning from previous attempts');
}

testEnhancedAutonomous().catch(console.error);