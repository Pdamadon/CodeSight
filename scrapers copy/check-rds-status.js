// Check RDS database status and get endpoint when ready
const AWS = require('aws-sdk');
require('dotenv').config();

const rds = new AWS.RDS({ region: process.env.AWS_REGION || 'us-west-2' });

async function checkRDSStatus() {
  try {
    console.log('🔍 Checking RDS database status...\n');
    
    const result = await rds.describeDBInstances({
      DBInstanceIdentifier: 'honeydoo-db'
    }).promise();
    
    const instance = result.DBInstances[0];
    const status = instance.DBInstanceStatus;
    const endpoint = instance.Endpoint?.Address;
    
    console.log(`Status: ${status}`);
    
    if (status === 'available' && endpoint) {
      console.log('✅ Database is ready!');
      console.log(`📍 Endpoint: ${endpoint}`);
      console.log('\n📝 Update your .env file:');
      console.log('================================');
      console.log(`DATABASE_URL="postgresql://honeydoo_admin:HoneydooSecure123!@${endpoint}:5432/honeydoo_prod"`);
      console.log('\n🔄 Next steps:');
      console.log('1. Update DATABASE_URL in .env file');
      console.log('2. Run: npm run db:push (to create tables)');
      console.log('3. Run: npm run db:seed (to add sample data)');
      console.log('4. Test connection with: node test-database.js');
      
    } else if (status === 'creating') {
      console.log('⏳ Database is still being created...');
      console.log('💡 This usually takes 5-10 minutes');
      console.log('🔄 Run this script again in a few minutes');
      
    } else {
      console.log(`ℹ️  Current status: ${status}`);
      if (endpoint) {
        console.log(`📍 Endpoint: ${endpoint}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking RDS status:', error.message);
  }
}

checkRDSStatus();