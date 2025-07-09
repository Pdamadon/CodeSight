// Test AWS configuration before full setup
require('dotenv').config();

const { checkAWSCredentials } = require('./setup-aws-infrastructure');

async function testAWSSetup() {
  console.log('🧪 Testing AWS Configuration...\n');
  
  const hasCredentials = await checkAWSCredentials();
  
  if (hasCredentials) {
    console.log('\n✅ AWS is properly configured!');
    console.log('You can now run: node setup-aws-infrastructure.js');
  } else {
    console.log('\n❌ AWS setup incomplete');
    console.log('\nTo configure AWS:');
    console.log('1. Create AWS account at https://aws.amazon.com');
    console.log('2. Create IAM user with programmatic access');
    console.log('3. Run: aws configure');
    console.log('4. Re-run this test');
  }
}

testAWSSetup().catch(console.error);