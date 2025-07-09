#!/usr/bin/env node

// Simple test to verify OpenAI integration is working

import { AutonomousPlanner } from './dist/ai/AutonomousPlanner.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function testOpenAIIntegration() {
  console.log('🔧 Testing OpenAI Integration');
  console.log('='.repeat(40));

  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not found');
    return;
  }

  console.log('✅ OpenAI API key found');
  
  try {
    const planner = new AutonomousPlanner();
    console.log('✅ AutonomousPlanner initialized');
    
    // Test context
    const context = {
      url: 'https://example.com',
      goal: 'extract page title',
      currentHtml: '<html><head><title>Test Page</title></head><body><h1>Welcome</h1><p>This is a test page</p></body></html>',
      previousAttempts: [],
      availableElements: [
        {
          tag: 'h1',
          text: 'Welcome',
          attributes: { class: 'header' },
          selector: 'h1'
        },
        {
          tag: 'p',
          text: 'This is a test page',
          attributes: {},
          selector: 'p'
        }
      ],
      currentData: {}
    };
    
    console.log('🤖 Making autonomous decision...');
    const decision = await planner.makeAutonomousDecision(context);
    
    console.log('✅ OpenAI Decision Made:');
    console.log(`   Action: ${decision.action}`);
    console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`   Reasoning: ${decision.reasoning}`);
    console.log(`   Parameters: ${JSON.stringify(decision.parameters, null, 2)}`);
    
    // Test selector generation
    console.log('\n🎯 Testing AI Selector Generation...');
    const selectorResult = await planner.generateImprovedSelectors(context, ['h2', '.nonexistent']);
    
    console.log('✅ AI Selector Generation:');
    console.log(`   Selectors: ${JSON.stringify(selectorResult.selectors, null, 2)}`);
    console.log(`   Confidence: ${(selectorResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Reasoning: ${selectorResult.reasoning}`);
    
    // Test interaction sequence planning
    console.log('\n🔄 Testing Interaction Sequence Planning...');
    const sequence = await planner.planInteractionSequence({
      ...context,
      goal: 'find and click a button to load more content'
    });
    
    console.log('✅ AI Interaction Sequence:');
    sequence.forEach((step, index) => {
      console.log(`   ${index + 1}. ${step.action.toUpperCase()} (${(step.confidence * 100).toFixed(1)}%)`);
      console.log(`      → ${step.reasoning}`);
    });
    
    console.log('\n🎉 OpenAI Integration Test Successful!');
    
  } catch (error) {
    console.log('❌ OpenAI Integration Test Failed:');
    console.log(`   Error: ${error.message}`);
    
    if (error.message.includes('API key')) {
      console.log('   → Check your OpenAI API key');
    } else if (error.message.includes('rate limit')) {
      console.log('   → Rate limit exceeded, try again later');
    } else if (error.message.includes('quota')) {
      console.log('   → OpenAI quota exceeded, check your billing');
    }
  }
}

testOpenAIIntegration();