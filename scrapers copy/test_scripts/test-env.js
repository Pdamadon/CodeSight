// test-env.js
require('dotenv').config();

console.log('🔍 Testing Environment Variables...\n');

console.log('Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('- PORT:', process.env.PORT || 'not set');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Found (length: ' + process.env.OPENAI_API_KEY.length + ')' : '❌ Not found');

if (!process.env.OPENAI_API_KEY) {
  console.log('\n❌ OPENAI_API_KEY is missing!');
  console.log('Please check your .env file and make sure it contains:');
  console.log('OPENAI_API_KEY=your_actual_api_key_here');
  console.log('\nGet your API key at: https://platform.openai.com/api-keys');
} else {
  console.log('\n✅ Environment variables are properly configured!');
  console.log('You can now run the AI-powered system.');
}

// Test OpenAI connection
if (process.env.OPENAI_API_KEY) {
  console.log('\n🧪 Testing OpenAI connection...');
  
  const OpenAI = require('openai');
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Say 'Hello from OpenAI!'" }],
    max_tokens: 10,
  })
  .then(response => {
    console.log('✅ OpenAI connection successful!');
    console.log('Response:', response.choices[0].message.content);
  })
  .catch(error => {
    console.log('❌ OpenAI connection failed:', error.message);
    if (error.message.includes('401')) {
      console.log('This usually means your API key is invalid or expired.');
    }
  });
} 