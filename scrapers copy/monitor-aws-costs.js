// AWS Cost Monitoring Script
require('dotenv').config();
const AWS = require('aws-sdk');

// Set up Cost Explorer (note: this service is only available in us-east-1)
const costExplorer = new AWS.CostExplorer({ region: 'us-east-1' });

async function getCurrentMonthCosts() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const params = {
    TimePeriod: {
      Start: start.toISOString().split('T')[0],
      End: end.toISOString().split('T')[0]
    },
    Granularity: 'MONTHLY',
    Metrics: ['BlendedCost'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE'
      }
    ]
  };

  try {
    console.log('📊 Fetching current month AWS costs...\n');
    const result = await costExplorer.getCostAndUsage(params).promise();
    
    if (result.ResultsByTime && result.ResultsByTime.length > 0) {
      const costs = result.ResultsByTime[0];
      const totalCost = parseFloat(costs.Total.BlendedCost.Amount);
      
      console.log(`💰 Total costs for ${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: $${totalCost.toFixed(2)}`);
      console.log('\n📋 Breakdown by service:');
      console.log('========================');
      
      costs.Groups.forEach(group => {
        const service = group.Keys[0];
        const amount = parseFloat(group.Metrics.BlendedCost.Amount);
        if (amount > 0) {
          console.log(`${service.padEnd(25)} $${amount.toFixed(2)}`);
        }
      });

      // Warning thresholds
      if (totalCost > 100) {
        console.log('\n⚠️  WARNING: Monthly costs exceed $100');
      } else if (totalCost > 50) {
        console.log('\n🟡 NOTICE: Monthly costs exceed $50');
      } else {
        console.log('\n✅ Costs are within expected range');
      }

    } else {
      console.log('No cost data available for current month');
    }

  } catch (error) {
    console.error('❌ Failed to fetch cost data:', error.message);
    if (error.code === 'UnauthorizedOperation') {
      console.log('\n💡 To enable cost monitoring:');
      console.log('1. Go to AWS Billing Dashboard');
      console.log('2. Enable "Receive Billing Alerts"');
      console.log('3. Grant your IAM user "ce:GetCostAndUsage" permission');
    }
  }
}

async function createBillingAlert() {
  const cloudwatch = new AWS.CloudWatch({ region: 'us-east-1' });
  
  const params = {
    AlarmName: 'honeydoo-monthly-costs',
    AlarmDescription: 'Alert when monthly AWS costs exceed $100',
    ActionsEnabled: true,
    MetricName: 'EstimatedCharges',
    Namespace: 'AWS/Billing',
    Statistic: 'Maximum',
    Dimensions: [
      {
        Name: 'Currency',
        Value: 'USD'
      }
    ],
    Period: 86400, // 24 hours
    EvaluationPeriods: 1,
    Threshold: 100,
    ComparisonOperator: 'GreaterThanThreshold'
  };

  try {
    console.log('🔔 Creating billing alert...');
    await cloudwatch.putMetricAlarm(params).promise();
    console.log('✅ Billing alert created');
    console.log('📧 Add SNS topic for email notifications in AWS Console');
  } catch (error) {
    console.error('❌ Failed to create billing alert:', error.message);
  }
}

async function monitorCosts() {
  try {
    await getCurrentMonthCosts();
    console.log('\n' + '='.repeat(50));
    console.log('💡 To set up email alerts:');
    console.log('1. Go to CloudWatch → Alarms');
    console.log('2. Create SNS topic for notifications');
    console.log('3. Subscribe your email to the topic');
  } catch (error) {
    console.error('Cost monitoring failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  monitorCosts();
}

module.exports = {
  getCurrentMonthCosts,
  createBillingAlert,
  monitorCosts
};