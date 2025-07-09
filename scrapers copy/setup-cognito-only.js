// Create Cognito User Pool only (RDS is already being created)
const { createCognitoUserPool } = require('./setup-aws-infrastructure');

async function setupCognitoOnly() {
  console.log('🔐 Setting up Cognito User Pool...\n');
  
  const cognitoConfig = await createCognitoUserPool();
  
  if (cognitoConfig) {
    console.log('\n🎉 Cognito setup completed!');
    console.log('\n📝 Add these to your .env file:');
    console.log('================================');
    console.log(`COGNITO_USER_POOL_ID=${cognitoConfig.userPoolId}`);
    console.log(`COGNITO_APP_CLIENT_ID=${cognitoConfig.appClientId}`);
  }
}

setupCognitoOnly().catch(console.error);