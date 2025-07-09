// AWS Infrastructure Setup Script
// This script helps automate the AWS resource creation

const AWS = require('aws-sdk');
require('dotenv').config();

// Check if AWS credentials are configured
async function checkAWSCredentials() {
  try {
    const sts = new AWS.STS();
    const identity = await sts.getCallerIdentity().promise();
    console.log('✅ AWS credentials configured');
    console.log('Account ID:', identity.Account);
    console.log('User ARN:', identity.Arn);
    return true;
  } catch (error) {
    console.log('❌ AWS credentials not configured');
    console.log('Please run: aws configure');
    console.log('You need:');
    console.log('- AWS Access Key ID');
    console.log('- AWS Secret Access Key');
    console.log('- Default region (recommend: us-west-2)');
    console.log('- Default output format (recommend: json)');
    return false;
  }
}

// Create RDS PostgreSQL instance
async function createRDSInstance() {
  const rds = new AWS.RDS({ region: process.env.AWS_REGION || 'us-west-2' });

  const params = {
    DBInstanceIdentifier: 'honeydoo-db',
    DBInstanceClass: 'db.t3.micro',
    Engine: 'postgres',
    MasterUsername: 'honeydoo_admin',
    MasterUserPassword: process.env.DB_MASTER_PASSWORD || 'HoneydooSecure123!',
    AllocatedStorage: 20,
    DBName: 'honeydoo_prod',
    VpcSecurityGroupIds: [], // Will need to be configured
    BackupRetentionPeriod: 7,
    MultiAZ: false,
    PubliclyAccessible: true, // For development, change to false in production
    StorageType: 'gp2',
    Tags: [
      { Key: 'Project', Value: 'honeydoo' },
      { Key: 'Environment', Value: 'production' }
    ]
  };

  try {
    console.log('🔄 Creating RDS PostgreSQL instance...');
    const result = await rds.createDBInstance(params).promise();
    console.log('✅ RDS instance creation initiated');
    console.log('DB Instance ID:', result.DBInstance.DBInstanceIdentifier);
    console.log('Status:', result.DBInstance.DBInstanceStatus);
    console.log('⏳ This will take 5-10 minutes to complete');
    return result.DBInstance;
  } catch (error) {
    console.error('❌ Failed to create RDS instance:', error.message);
    return null;
  }
}

// Create Cognito User Pool
async function createCognitoUserPool() {
  const cognito = new AWS.CognitoIdentityServiceProvider({ 
    region: process.env.AWS_REGION || 'us-west-2' 
  });

  const userPoolParams = {
    PoolName: 'honeydoo-users',
    Policies: {
      PasswordPolicy: {
        MinimumLength: 8,
        RequireUppercase: true,
        RequireLowercase: true,
        RequireNumbers: true,
        RequireSymbols: false
      }
    },
    AutoVerifiedAttributes: ['email'],
    UsernameAttributes: ['email'],
    Schema: [
      {
        Name: 'email',
        AttributeDataType: 'String',
        Required: true,
        Mutable: true
      },
      {
        Name: 'given_name',
        AttributeDataType: 'String',
        Required: true,
        Mutable: true
      },
      {
        Name: 'family_name',
        AttributeDataType: 'String',
        Required: true,
        Mutable: true
      },
      {
        Name: 'phone_number',
        AttributeDataType: 'String',
        Required: false,
        Mutable: true
      }
    ]
  };

  try {
    console.log('🔄 Creating Cognito User Pool...');
    const userPool = await cognito.createUserPool(userPoolParams).promise();
    console.log('✅ User Pool created');
    console.log('User Pool ID:', userPool.UserPool.Id);

    // Create App Client
    const appClientParams = {
      UserPoolId: userPool.UserPool.Id,
      ClientName: 'honeydoo-mobile-app',
      GenerateSecret: false, // Mobile apps don't use client secrets
      ExplicitAuthFlows: [
        'ALLOW_ADMIN_USER_PASSWORD_AUTH',
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH'
      ]
    };

    const appClient = await cognito.createUserPoolClient(appClientParams).promise();
    console.log('✅ App Client created');
    console.log('App Client ID:', appClient.UserPoolClient.ClientId);

    return {
      userPoolId: userPool.UserPool.Id,
      appClientId: appClient.UserPoolClient.ClientId
    };

  } catch (error) {
    console.error('❌ Failed to create Cognito User Pool:', error.message);
    return null;
  }
}

// Main setup function
async function setupAWSInfrastructure() {
  console.log('🚀 Setting up AWS infrastructure for Honeydoo...\n');

  // Check credentials
  const hasCredentials = await checkAWSCredentials();
  if (!hasCredentials) {
    return;
  }

  // Create RDS instance
  console.log('\n📊 Setting up database...');
  const rdsInstance = await createRDSInstance();

  // Create Cognito User Pool
  console.log('\n🔐 Setting up authentication...');
  const cognitoConfig = await createCognitoUserPool();

  // Output configuration
  if (rdsInstance && cognitoConfig) {
    console.log('\n🎉 Infrastructure setup completed!');
    console.log('\n📝 Add these to your .env file:');
    console.log('================================');
    console.log(`AWS_REGION=${process.env.AWS_REGION || 'us-west-2'}`);
    console.log(`COGNITO_USER_POOL_ID=${cognitoConfig.userPoolId}`);
    console.log(`COGNITO_APP_CLIENT_ID=${cognitoConfig.appClientId}`);
    console.log('\n⏳ RDS endpoint will be available in 5-10 minutes.');
    console.log('Check AWS Console for the database endpoint.');
  }
}

// Check if running directly
if (require.main === module) {
  setupAWSInfrastructure().catch(console.error);
}

module.exports = {
  checkAWSCredentials,
  createRDSInstance,
  createCognitoUserPool,
  setupAWSInfrastructure
};