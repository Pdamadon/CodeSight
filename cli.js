#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { ScrapingAgent } from './dist/agents/ScrapingAgent.js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const program = new Command();
let agent = null;

// Initialize agent
async function initializeAgent() {
  if (!agent) {
    agent = new ScrapingAgent();
  }
  return agent;
}

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  if (agent) {
    await agent.close();
  }
  process.exit(0);
});

program
  .name('codesight')
  .description('CodeSight - Autonomous Web Scraping Agent')
  .version('1.0.0');

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode for autonomous scraping')
  .action(async () => {
    await runInteractiveMode();
  });

// Quick scrape command
program
  .command('scrape')
  .description('Quick scrape a website')
  .option('-u, --url <url>', 'Website URL to scrape')
  .option('-t, --targets <targets>', 'Comma-separated extraction targets')
  .option('-a, --autonomous', 'Use autonomous mode')
  .option('-o, --output <file>', 'Output file (JSON format)')
  .option('--timeout <seconds>', 'Request timeout in seconds', '30')
  .action(async (options) => {
    await runQuickScrape(options);
  });

// Batch processing
program
  .command('batch')
  .description('Process multiple scraping tasks from a file')
  .option('-f, --file <file>', 'JSON file containing scraping tasks')
  .option('-o, --output <dir>', 'Output directory for results')
  .action(async (options) => {
    await runBatchMode(options);
  });

// Results viewer
program
  .command('results')
  .description('View recent scraping results')
  .option('-l, --limit <number>', 'Number of results to show', '10')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await showResults(options);
  });

async function runInteractiveMode() {
  console.log(chalk.cyan.bold('\n🚀 CodeSight - Autonomous Web Scraping Agent'));
  console.log(chalk.gray('Navigate websites intelligently and extract data with AI-powered decisions\n'));

  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.red('❌ OPENAI_API_KEY not found. Autonomous mode requires OpenAI API key.'));
    console.log(chalk.yellow('💡 Add your OpenAI API key to .env file for full autonomous capabilities.\n'));
  }

  const agent = await initializeAgent();

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🎯 Autonomous Scraping - Let AI decide how to extract data', value: 'autonomous' },
          { name: '🔧 Manual Scraping - Traditional selector-based extraction', value: 'manual' },
          { name: '📊 View Recent Results', value: 'results' },
          { name: '🧪 Test OpenAI Integration', value: 'test' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') {
      console.log(chalk.green('👋 Goodbye!'));
      break;
    }

    switch (action) {
      case 'autonomous':
        await runAutonomousSession(agent);
        break;
      case 'manual':
        await runManualSession(agent);
        break;
      case 'results':
        await showResults({ limit: 10 });
        break;
      case 'test':
        await testOpenAIIntegration();
        break;
    }
  }

  await agent.close();
}

async function runAutonomousSession(agent) {
  console.log(chalk.cyan.bold('\n🤖 Autonomous Scraping Mode'));
  console.log(chalk.gray('Describe what you want to extract and let AI figure out how to do it\n'));

  const questions = [
    {
      type: 'input',
      name: 'url',
      message: 'Website URL:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'goal',
      message: 'What do you want to extract? (e.g., "article title and summary", "product price and reviews"):',
      validate: (input) => input.trim().length > 0 || 'Please describe what you want to extract'
    },
    {
      type: 'confirm',
      name: 'interactions',
      message: 'Should the AI click buttons/navigate if needed to find the data?',
      default: true
    },
    {
      type: 'number',
      name: 'timeout',
      message: 'Timeout (seconds):',
      default: 60
    }
  ];

  const answers = await inquirer.prompt(questions);

  const spinner = ora('🤖 AI is analyzing the website and making autonomous decisions...').start();

  try {
    const startTime = Date.now();
    const result = await agent.scrapeWebsite({
      url: answers.url,
      targets: [answers.goal],
      autonomous: true,
      timeout: answers.timeout * 1000,
      headless: true
    });

    const duration = Date.now() - startTime;
    spinner.stop();

    console.log(chalk.green.bold('\n✅ Autonomous Scraping Complete!'));
    console.log(chalk.gray(`⏱️  Execution Time: ${duration}ms\n`));

    if (result.success) {
      displayScrapingResults(result, answers.url);
    } else {
      console.log(chalk.red('❌ Scraping failed'));
      if (result.errors && result.errors.length > 0) {
        console.log(chalk.red('Errors:'));
        result.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      }
    }

  } catch (error) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function runManualSession(agent) {
  console.log(chalk.yellow.bold('\n🔧 Manual Scraping Mode'));
  console.log(chalk.gray('Specify exact targets and let the system find the best selectors\n'));

  const questions = [
    {
      type: 'input',
      name: 'url',
      message: 'Website URL:',
      validate: (input) => {
        try {
          new URL(input);
          return true;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    },
    {
      type: 'input',
      name: 'targets',
      message: 'Extraction targets (comma-separated):',
      validate: (input) => input.trim().length > 0 || 'Please specify what to extract'
    },
    {
      type: 'number',
      name: 'timeout',
      message: 'Timeout (seconds):',
      default: 30
    }
  ];

  const answers = await inquirer.prompt(questions);
  const targets = answers.targets.split(',').map(t => t.trim());

  const spinner = ora('🔍 Analyzing page structure and extracting data...').start();

  try {
    const result = await agent.scrapeWebsite({
      url: answers.url,
      targets: targets,
      autonomous: false,
      timeout: answers.timeout * 1000,
      headless: true
    });

    spinner.stop();

    console.log(chalk.green.bold('\n✅ Manual Scraping Complete!'));

    if (result.success) {
      displayScrapingResults(result, answers.url);
    } else {
      console.log(chalk.red('❌ Scraping failed'));
      if (result.errors && result.errors.length > 0) {
        console.log(chalk.red('Errors:'));
        result.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      }
    }

  } catch (error) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

function displayScrapingResults(result, url) {
  console.log(chalk.blue.bold('📊 Extraction Results:'));
  console.log(chalk.gray(`🌐 URL: ${url}`));
  console.log(chalk.gray(`📈 Success: ${result.success}`));
  console.log(chalk.gray(`📋 Data Points: ${Object.keys(result.data).length}`));
  console.log(chalk.gray(`⏱️  Execution Time: ${result.executionTime}ms\n`));

  if (result.autonomous) {
    console.log(chalk.magenta.bold('🧠 AI Decision Analysis:'));
    console.log(chalk.gray(`🎯 Steps Taken: ${result.autonomous.steps.length}`));
    console.log(chalk.gray(`🎪 Confidence: ${(result.autonomous.confidence * 100).toFixed(1)}%`));
    console.log(chalk.gray(`💭 Reasoning: ${result.autonomous.reasoning}\n`));

    if (result.autonomous.steps.length > 0) {
      console.log(chalk.magenta('🔄 AI Steps:'));
      result.autonomous.steps.forEach((step, index) => {
        const status = step.success ? chalk.green('✅') : chalk.red('❌');
        console.log(`${status} ${index + 1}. ${step.action.toUpperCase()}`);
        
        if (step.data) {
          Object.entries(step.data).forEach(([key, value]) => {
            if (value && typeof value === 'object' && value.text) {
              const confidence = value.confidence || 0;
              const confColor = confidence > 0.7 ? chalk.green : confidence > 0.4 ? chalk.yellow : chalk.red;
              console.log(`     ${confColor('●')} ${key}: "${value.text.substring(0, 100)}..." (${(confidence * 100).toFixed(1)}%)`);
            }
          });
        }
      });
      console.log();
    }
  }

  if (Object.keys(result.data).length > 0) {
    console.log(chalk.green.bold('📄 Extracted Data:'));
    
    const tableData = [
      [chalk.bold('Target'), chalk.bold('Content'), chalk.bold('Selector'), chalk.bold('Length')]
    ];

    Object.entries(result.data).forEach(([key, value]) => {
      if (value && typeof value === 'object' && value.text) {
        const preview = value.text.length > 80 ? value.text.substring(0, 80) + '...' : value.text;
        const selector = value.selector || 'N/A';
        const length = value.text.length;
        
        tableData.push([
          chalk.cyan(key),
          chalk.gray(preview),
          chalk.yellow(selector),
          chalk.blue(length.toString())
        ]);
      }
    });

    console.log(table(tableData, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼'
      }
    }));
  }

  // Save results option
  inquirer.prompt([
    {
      type: 'confirm',
      name: 'save',
      message: 'Save results to file?',
      default: false
    }
  ]).then(async (answers) => {
    if (answers.save) {
      const filename = `scraping-results-${Date.now()}.json`;
      const filepath = path.join(process.cwd(), 'results', filename);
      
      // Ensure results directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
      console.log(chalk.green(`💾 Results saved to: ${filepath}`));
    }
  });
}

async function testOpenAIIntegration() {
  console.log(chalk.magenta.bold('\n🧪 Testing OpenAI Integration'));
  
  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.red('❌ OPENAI_API_KEY not found'));
    return;
  }

  const spinner = ora('🤖 Testing OpenAI connection...').start();

  try {
    const { AutonomousPlanner } = await import('./dist/ai/AutonomousPlanner.js');
    const planner = new AutonomousPlanner();

    const testContext = {
      url: 'https://example.com',
      goal: 'extract page title',
      currentHtml: '<html><head><title>Test Page</title></head><body><h1>Welcome</h1></body></html>',
      previousAttempts: [],
      availableElements: [
        { tag: 'h1', text: 'Welcome', attributes: {}, selector: 'h1' }
      ],
      currentData: {}
    };

    const decision = await planner.makeAutonomousDecision(testContext);
    spinner.stop();

    console.log(chalk.green('✅ OpenAI Integration Test Successful!'));
    console.log(chalk.gray(`🎯 Action: ${decision.action}`));
    console.log(chalk.gray(`🎪 Confidence: ${(decision.confidence * 100).toFixed(1)}%`));
    console.log(chalk.gray(`💭 Reasoning: ${decision.reasoning}`));

  } catch (error) {
    spinner.stop();
    console.log(chalk.red(`❌ OpenAI Integration Failed: ${error.message}`));
  }
}

async function runQuickScrape(options) {
  if (!options.url) {
    console.log(chalk.red('❌ URL is required. Use --url <url>'));
    return;
  }

  if (!options.targets) {
    console.log(chalk.red('❌ Targets are required. Use --targets <targets>'));
    return;
  }

  const agent = await initializeAgent();
  const targets = options.targets.split(',').map(t => t.trim());

  console.log(chalk.cyan(`🚀 Scraping: ${options.url}`));
  console.log(chalk.gray(`🎯 Targets: ${targets.join(', ')}`));
  console.log(chalk.gray(`🤖 Autonomous: ${options.autonomous ? 'Yes' : 'No'}\n`));

  const spinner = ora('Scraping...').start();

  try {
    const result = await agent.scrapeWebsite({
      url: options.url,
      targets: targets,
      autonomous: options.autonomous || false,
      timeout: (parseInt(options.timeout) || 30) * 1000,
      headless: true
    });

    spinner.stop();

    if (result.success) {
      console.log(chalk.green('✅ Scraping successful!'));
      displayScrapingResults(result, options.url);

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
        console.log(chalk.green(`💾 Results saved to: ${options.output}`));
      }
    } else {
      console.log(chalk.red('❌ Scraping failed'));
    }

  } catch (error) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }

  await agent.close();
}

async function runBatchMode(options) {
  if (!options.file) {
    console.log(chalk.red('❌ File is required. Use --file <file>'));
    return;
  }

  if (!fs.existsSync(options.file)) {
    console.log(chalk.red(`❌ File not found: ${options.file}`));
    return;
  }

  const tasks = JSON.parse(fs.readFileSync(options.file, 'utf8'));
  const agent = await initializeAgent();

  console.log(chalk.cyan(`📋 Processing ${tasks.length} tasks from ${options.file}\n`));

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(chalk.blue(`🔄 Task ${i + 1}/${tasks.length}: ${task.url}`));

    const spinner = ora(`Scraping task ${i + 1}...`).start();

    try {
      const result = await agent.scrapeWebsite({
        url: task.url,
        targets: task.targets,
        autonomous: task.autonomous || false,
        timeout: task.timeout || 30000,
        headless: true
      });

      spinner.stop();

      if (result.success) {
        console.log(chalk.green(`✅ Task ${i + 1} completed successfully`));
        
        if (options.output) {
          const filename = `task-${i + 1}-${Date.now()}.json`;
          const filepath = path.join(options.output, filename);
          
          if (!fs.existsSync(options.output)) {
            fs.mkdirSync(options.output, { recursive: true });
          }
          
          fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
          console.log(chalk.gray(`💾 Results saved to: ${filepath}`));
        }
      } else {
        console.log(chalk.red(`❌ Task ${i + 1} failed`));
      }

    } catch (error) {
      spinner.stop();
      console.log(chalk.red(`❌ Task ${i + 1} error: ${error.message}`));
    }

    console.log(''); // Empty line between tasks
  }

  await agent.close();
  console.log(chalk.green('🎉 Batch processing complete!'));
}

async function showResults(options) {
  const resultsDir = path.join(process.cwd(), 'results');
  
  if (!fs.existsSync(resultsDir)) {
    console.log(chalk.yellow('📁 No results directory found. Run some scraping tasks first!'));
    return;
  }

  const files = fs.readdirSync(resultsDir)
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => {
      const aTime = fs.statSync(path.join(resultsDir, a)).mtime;
      const bTime = fs.statSync(path.join(resultsDir, b)).mtime;
      return bTime - aTime;
    })
    .slice(0, parseInt(options.limit) || 10);

  if (files.length === 0) {
    console.log(chalk.yellow('📄 No result files found'));
    return;
  }

  console.log(chalk.cyan.bold(`📊 Recent Results (${files.length} files):\n`));

  files.forEach((file, index) => {
    const filepath = path.join(resultsDir, file);
    const stats = fs.statSync(filepath);
    const result = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    console.log(chalk.blue(`${index + 1}. ${file}`));
    console.log(chalk.gray(`   📅 Created: ${stats.mtime.toLocaleString()}`));
    console.log(chalk.gray(`   🌐 URL: ${result.url || 'N/A'}`));
    console.log(chalk.gray(`   📈 Success: ${result.success ? 'Yes' : 'No'}`));
    console.log(chalk.gray(`   📋 Data Points: ${Object.keys(result.data || {}).length}`));
    
    if (result.autonomous) {
      console.log(chalk.magenta(`   🤖 Autonomous: ${(result.autonomous.confidence * 100).toFixed(1)}% confidence`));
    }
    
    console.log('');
  });
}

// Parse command line arguments
program.parse();

// If no command specified, run interactive mode
if (!process.argv.slice(2).length) {
  runInteractiveMode();
}