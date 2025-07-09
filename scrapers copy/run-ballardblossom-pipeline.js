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
    console.log('🌸 Starting Ballard Blossom scraping pipeline...\n');
    await runCommand('node map-ballardblossom-categories.js');
    await runCommand('node fetch-ballardblossom-all-categories.js');
    await runCommand('node fetch-ballardblossom-all-categories-details.js');
    console.log('\n🎉 Ballard Blossom scraping pipeline completed successfully!');
    console.log('\n🌸 Check the category_products/ folder for results.');
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
  }
}

main(); 