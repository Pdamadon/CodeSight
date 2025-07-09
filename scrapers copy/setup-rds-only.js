// Create RDS PostgreSQL instance only
const { createRDSInstance } = require('./setup-aws-infrastructure');

async function setupRDSOnly() {
  console.log('📊 Setting up RDS PostgreSQL database...\n');
  
  const rdsInstance = await createRDSInstance();
  
  if (rdsInstance) {
    console.log('\n🎉 RDS setup completed!');
    console.log('\n⏳ Database will be available in 5-10 minutes');
    console.log('📝 Check AWS Console for the database endpoint');
    console.log('Once available, add to your .env file:');
    console.log('DATABASE_URL="postgresql://honeydoo_admin:HoneydooSecure123!@[ENDPOINT]:5432/honeydoo_prod"');
  }
}

setupRDSOnly().catch(console.error);