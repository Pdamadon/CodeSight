const { exec } = require('child_process');

async function runCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`\n🌸 Running: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`⚠️  Stderr: ${stderr}`);
      }
      console.log(`✅ Output: ${stdout}`);
      resolve(stdout);
    });
  });
}

async function main() {
  try {
    console.log('🌸 Starting Terra Bella scraping pipeline...\n');
    await runCommand('node map-terra-bella-floral-categories.js');
    await runCommand('node fetch-terra-bella-all-categories.js');
    await runCommand('node fetch-terra-bella-all-categories-details.js');
    console.log('\n🎉 Terra Bella scraping pipeline completed successfully!');
    console.log('\n🌸 Check the category_products/ folder for results.');
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
  }
}

main(); 