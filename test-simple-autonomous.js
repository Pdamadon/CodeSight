#!/usr/bin/env node

// Simple, focused test of autonomous mode

import { ScrapingAgent } from './dist/agents/ScrapingAgent.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSimpleAutonomous() {
  console.log('🧪 Simple Autonomous Test');
  console.log('='.repeat(40));

  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY required');
    return;
  }

  const agent = new ScrapingAgent();
  
  try {
    console.log('🤖 Testing autonomous mode on a simple website...');
    
    // Test on a simple, reliable website
    const result = await agent.scrapeWebsite({
      url: 'https://httpbin.org/html',
      targets: ['page title', 'main heading'],
      autonomous: true,
      timeout: 30000,
      headless: true
    });
    
    console.log('\n✅ Autonomous Test Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Execution Time: ${result.executionTime}ms`);
    console.log(`   Data Points: ${Object.keys(result.data).length}`);
    
    if (result.autonomous) {
      console.log(`   AI Steps: ${result.autonomous.steps.length}`);
      console.log(`   AI Confidence: ${(result.autonomous.confidence * 100).toFixed(1)}%`);
      console.log(`   AI Reasoning: ${result.autonomous.reasoning}`);
      
      console.log('\n🎯 AI Steps Taken:');
      result.autonomous.steps.forEach((step, index) => {
        const status = step.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${step.action.toUpperCase()}`);
        if (step.data) {
          console.log(`      Data: ${JSON.stringify(step.data).substring(0, 150)}...`);
        }
        if (step.error) {
          console.log(`      Error: ${step.error}`);
        }
      });
    }
    
    if (result.success && Object.keys(result.data).length > 0) {
      console.log('\n📊 Extracted Data:');
      for (const [key, value] of Object.entries(result.data)) {
        if (value && typeof value === 'object' && value.text) {
          console.log(`   ${key}: "${value.text}"`);
        }
      }
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.log('❌ Test failed:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  } finally {
    await agent.close();
  }
}

// Quick validation that OpenAI is responsive
async function quickOpenAITest() {
  console.log('\n🔍 Quick OpenAI Validation...');
  
  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    console.log('✅ OpenAI client initialized');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Just respond with "OK" to test the connection.' }
      ],
      max_tokens: 10,
      temperature: 0
    });
    
    console.log(`✅ OpenAI response: "${response.choices[0]?.message?.content}"`);
    
  } catch (error) {
    console.log('❌ OpenAI validation failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.status === 401) {
      console.log('   → Invalid API key');
    } else if (error.status === 429) {
      console.log('   → Rate limit or quota exceeded');
    } else if (error.status === 500) {
      console.log('   → OpenAI server error');
    }
  }
}

async function main() {
  await quickOpenAITest();
  await testSimpleAutonomous();
}

main().catch(console.error);