// Create new AWS resources with do.ai branding
const AWS = require('aws-sdk');
require('dotenv').config();

const rds = new AWS.RDS({ region: 'us-west-2' });
const cognito = new AWS.CognitoIdentityServiceProvider({ region: 'us-west-2' });

// Create new Cognito User Pool with correct name
async function createDoAICognitoUserPool() {
  const userPoolParams = {
    PoolName: 'doai-users',
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
    console.log('🔄 Creating new Cognito User Pool: doai-users...');
    const userPool = await cognito.createUserPool(userPoolParams).promise();
    console.log('✅ User Pool created');
    console.log('User Pool ID:', userPool.UserPool.Id);

    // Create App Client
    const appClientParams = {
      UserPoolId: userPool.UserPool.Id,
      ClientName: 'doai-mobile-app',
      GenerateSecret: false,
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

// Create database snapshot and restore with new name
async function createDoAIDatabase() {
  try {
    console.log('🔄 Creating snapshot of existing database...');
    
    const snapshotId = `doai-migration-snapshot-${Date.now()}`;
    
    const snapshotParams = {
      DBSnapshotIdentifier: snapshotId,
      DBInstanceIdentifier: 'honeydoo-db'
    };

    const snapshot = await rds.createDBSnapshot(snapshotParams).promise();
    console.log('✅ Snapshot created:', snapshotId);
    console.log('⏳ Waiting for snapshot to complete...');

    // Wait for snapshot to complete
    await rds.waitFor('dBSnapshotCompleted', {
      DBSnapshotIdentifier: snapshotId
    }).promise();

    console.log('✅ Snapshot completed');

    // Create new database from snapshot
    console.log('🔄 Creating new database: doai-db...');
    
    const restoreParams = {
      DBInstanceIdentifier: 'doai-db',
      DBSnapshotIdentifier: snapshotId,
      DBInstanceClass: 'db.t3.micro',
      PubliclyAccessible: true,
      Tags: [
        { Key: 'Project', Value: 'doai' },
        { Key: 'Environment', Value: 'production' }
      ]
    };

    const newDB = await rds.restoreDBInstanceFromDBSnapshot(restoreParams).promise();
    console.log('✅ New database creation initiated');
    console.log('DB Instance ID:', newDB.DBInstance.DBInstanceIdentifier);
    console.log('⏳ Database will be available in 5-10 minutes');

    return {
      dbInstanceId: newDB.DBInstance.DBInstanceIdentifier,
      snapshotId: snapshotId
    };

  } catch (error) {
    console.error('❌ Failed to create database:', error.message);
    return null;
  }
}

async function createDoAIResources() {
  console.log('🚀 Creating do.ai AWS resources...\n');

  // Create new Cognito User Pool
  console.log('🔐 Setting up authentication...');
  const cognitoConfig = await createDoAICognitoUserPool();

  // Create new database from snapshot
  console.log('\n📊 Setting up database...');
  const dbConfig = await createDoAIDatabase();

  if (cognitoConfig && dbConfig) {
    console.log('\n🎉 do.ai AWS resources created!');
    console.log('\n📝 Update your .env file:');
    console.log('================================');
    console.log(`COGNITO_USER_POOL_ID=${cognitoConfig.userPoolId}`);
    console.log(`COGNITO_APP_CLIENT_ID=${cognitoConfig.appClientId}`);
    console.log(`# DATABASE_URL will be available when doai-db is ready`);
    
    console.log('\n🧹 Cleanup old resources:');
    console.log('- Delete old Cognito User Pool: us-west-2_WGVH52T8p');
    console.log('- Delete old RDS instance: honeydoo-db (after testing)');
  }
}

// Run if called directly
if (require.main === module) {
  createDoAIResources().catch(console.error);
}

module.exports = { createDoAICognitoUserPool, createDoAIDatabase };