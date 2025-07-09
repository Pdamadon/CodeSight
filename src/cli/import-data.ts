// import-data.ts - CLI command for importing data from external scrapers

import { Command } from 'commander';
import { DataIngestion, DataSource } from '../data/DataIngestion.js';
import { WorldModel } from '../knowledge/WorldModel.js';
import { getDatabaseConfig } from '../config/database.js';
import { Logger } from '../monitoring/Logger.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';

const program = new Command();
const logger = Logger.getInstance();

program
  .name('import-data')
  .description('Import data from external scrapers to train CodeSight')
  .version('1.0.0');

// Import from file command
program
  .command('file')
  .description('Import data from a specific file')
  .argument('<file>', 'Path to the data file')
  .option('-t, --type <type>', 'Data type (json, jsonl, csv, scrapy, playwright, puppeteer, selenium)', 'json')
  .option('-f, --format <format>', 'Custom format configuration (JSON)')
  .option('-l, --limit <limit>', 'Limit number of records to import', '1000')
  .option('-s, --skip <skip>', 'Skip first N records', '0')
  .option('--dry-run', 'Preview import without actually importing')
  .action(async (file, options) => {
    await importFromFile(file, options);
  });

// Import from directory command
program
  .command('directory')
  .description('Import data from all files in a directory')
  .argument('<directory>', 'Path to the directory containing data files')
  .option('-r, --recursive', 'Search recursively in subdirectories')
  .option('-p, --pattern <pattern>', 'File pattern to match (glob)', '*.{json,jsonl,csv}')
  .option('-l, --limit <limit>', 'Limit number of records per file', '1000')
  .option('--parallel', 'Process files in parallel')
  .option('--dry-run', 'Preview import without actually importing')
  .action(async (directory, options) => {
    await importFromDirectory(directory, options);
  });

// Discover data sources command
program
  .command('discover')
  .description('Discover and analyze data sources in a directory')
  .argument('<directory>', 'Path to the directory to analyze')
  .option('-r, --recursive', 'Search recursively in subdirectories')
  .option('-o, --output <output>', 'Output file for discovered sources (JSON)')
  .action(async (directory, options) => {
    await discoverDataSources(directory, options);
  });

// Import from scrapers copy directory
program
  .command('scrapers-copy')
  .description('Import data from the scrapers copy directory')
  .option('-l, --limit <limit>', 'Limit number of records per file', '100')
  .option('--dry-run', 'Preview import without actually importing')
  .action(async (options) => {
    const scrapersDir = path.join(process.cwd(), 'scrapers copy');
    await importFromScrapersDirectory(scrapersDir, options);
  });

// Create learning pipeline command
program
  .command('learn')
  .description('Create learning pipeline from imported data')
  .option('--analyze-patterns', 'Analyze and extract scraping patterns')
  .option('--build-recommendations', 'Build selector recommendations')
  .option('--update-models', 'Update AI models with new patterns')
  .action(async (options) => {
    await createLearningPipeline(options);
  });

// Status command
program
  .command('status')
  .description('Show import status and statistics')
  .action(async () => {
    await showImportStatus();
  });

async function importFromFile(filePath: string, options: any) {
  const spinner = ora('Initializing data import...').start();
  
  try {
    // Initialize WorldModel and DataIngestion
    const worldModel = new WorldModel(getDatabaseConfig());
    await worldModel.initialize();
    
    const dataIngestion = new DataIngestion(worldModel);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    spinner.text = 'Analyzing file format...';
    
    // Create data source
    const dataSource: DataSource = {
      name: path.basename(filePath, path.extname(filePath)),
      type: options.type as any,
      path: filePath,
      format: options.format ? JSON.parse(options.format) : {
        url: 'url',
        domain: 'domain',
        timestamp: 'timestamp',
        data: 'data'
      },
      enabled: true
    };
    
    // Register data source
    await dataIngestion.registerDataSource(dataSource);
    
    if (options.dryRun) {
      spinner.stop();
      console.log(chalk.yellow('🔍 Dry run mode - no data will be imported'));
      console.log(chalk.cyan('Data source configuration:'));
      console.log(JSON.stringify(dataSource, null, 2));
      return;
    }
    
    spinner.text = 'Importing data...';
    
    // Import data
    const result = await dataIngestion.importFromSource(dataSource.name, {
      limit: parseInt(options.limit),
      offset: parseInt(options.skip)
    });
    
    spinner.stop();
    
    // Display results
    displayImportResult(result, dataSource.name);
    
    await worldModel.disconnect();
    
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Import failed:'), error);
    process.exit(1);
  }
}

async function importFromDirectory(directory: string, options: any) {
  const spinner = ora('Discovering data sources...').start();
  
  try {
    // Initialize WorldModel and DataIngestion
    const worldModel = new WorldModel(getDatabaseConfig());
    await worldModel.initialize();
    
    const dataIngestion = new DataIngestion(worldModel);
    
    // Discover data sources
    const dataSources = await dataIngestion.discoverDataSources(directory);
    
    if (dataSources.length === 0) {
      spinner.stop();
      console.log(chalk.yellow('No data sources found in directory'));
      return;
    }
    
    spinner.stop();
    console.log(chalk.green(`Found ${dataSources.length} data sources`));
    
    if (options.dryRun) {
      console.log(chalk.yellow('🔍 Dry run mode - no data will be imported'));
      displayDataSources(dataSources);
      return;
    }
    
    // Register all data sources
    for (const source of dataSources) {
      await dataIngestion.registerDataSource(source);
    }
    
    // Import from all sources
    const results = await dataIngestion.importFromMultipleSources(
      dataSources.map(s => s.name),
      {
        parallel: options.parallel,
        continueOnError: true,
        limit: parseInt(options.limit)
      }
    );
    
    // Display results
    displayMultipleImportResults(results);
    
    await worldModel.disconnect();
    
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Directory import failed:'), error);
    process.exit(1);
  }
}

async function discoverDataSources(directory: string, options: any) {
  const spinner = ora('Discovering data sources...').start();
  
  try {
    const worldModel = new WorldModel(getDatabaseConfig());
    await worldModel.initialize();
    
    const dataIngestion = new DataIngestion(worldModel);
    
    const dataSources = await dataIngestion.discoverDataSources(directory);
    
    spinner.stop();
    
    if (dataSources.length === 0) {
      console.log(chalk.yellow('No data sources found'));
      return;
    }
    
    console.log(chalk.green(`Discovered ${dataSources.length} data sources:`));
    displayDataSources(dataSources);
    
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(dataSources, null, 2));
      console.log(chalk.green(`\n💾 Data sources saved to: ${options.output}`));
    }
    
    await worldModel.disconnect();
    
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Discovery failed:'), error);
    process.exit(1);
  }
}

async function importFromScrapersDirectory(scrapersDir: string, options: any) {
  const spinner = ora('Analyzing scrapers directory...').start();
  
  try {
    if (!fs.existsSync(scrapersDir)) {
      throw new Error(`Scrapers directory not found: ${scrapersDir}`);
    }
    
    const worldModel = new WorldModel(getDatabaseConfig());
    await worldModel.initialize();
    
    const dataIngestion = new DataIngestion(worldModel);
    
    // Look for JSON files in scrapers directory
    const jsonFiles = fs.readdirSync(scrapersDir)
      .filter(file => file.endsWith('.json') && !file.includes('config'))
      .map(file => path.join(scrapersDir, file));
    
    if (jsonFiles.length === 0) {
      spinner.stop();
      console.log(chalk.yellow('No JSON data files found in scrapers directory'));
      return;
    }
    
    spinner.stop();
    console.log(chalk.green(`Found ${jsonFiles.length} JSON files in scrapers directory`));
    
    if (options.dryRun) {
      console.log(chalk.yellow('🔍 Dry run mode - no data will be imported'));
      jsonFiles.forEach(file => console.log(chalk.cyan(`- ${path.basename(file)}`)));
      return;
    }
    
    // Create data sources for each JSON file
    const dataSources: DataSource[] = jsonFiles.map(file => ({
      name: path.basename(file, '.json'),
      type: 'json',
      path: file,
      format: {
        url: 'url',
        domain: 'domain',
        timestamp: 'timestamp',
        data: 'data'
      },
      enabled: true
    }));
    
    // Register and import
    for (const source of dataSources) {
      await dataIngestion.registerDataSource(source);
    }
    
    const results = await dataIngestion.importFromMultipleSources(
      dataSources.map(s => s.name),
      {
        parallel: false,
        continueOnError: true,
        limit: parseInt(options.limit)
      }
    );
    
    displayMultipleImportResults(results);
    
    await worldModel.disconnect();
    
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Scrapers import failed:'), error);
    process.exit(1);
  }
}

async function createLearningPipeline(options: any) {
  const spinner = ora('Creating learning pipeline...').start();
  
  try {
    const worldModel = new WorldModel(getDatabaseConfig());
    await worldModel.initialize();
    
    const dataIngestion = new DataIngestion(worldModel);
    
    await dataIngestion.createLearningPipeline();
    
    spinner.stop();
    console.log(chalk.green('✅ Learning pipeline created successfully'));
    
    // Show statistics
    const stats = await worldModel.getStatistics();
    console.log(chalk.cyan('\n📊 Current Data Statistics:'));
    console.log(`Entities: ${stats.entities}`);
    console.log(`Relationships: ${stats.relationships}`);
    console.log(`Facts: ${stats.facts}`);
    console.log(`Domains: ${stats.domains.join(', ')}`);
    
    await worldModel.disconnect();
    
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Learning pipeline creation failed:'), error);
    process.exit(1);
  }
}

async function showImportStatus() {
  const spinner = ora('Loading import status...').start();
  
  try {
    const worldModel = new WorldModel(getDatabaseConfig());
    await worldModel.initialize();
    
    const stats = await worldModel.getStatistics();
    
    spinner.stop();
    
    console.log(chalk.cyan.bold('\n📊 Import Status & Statistics\n'));
    
    const statusTable = [
      ['Metric', 'Value'],
      ['Total Entities', stats.entities.toString()],
      ['Total Relationships', stats.relationships.toString()],
      ['Total Facts', stats.facts.toString()],
      ['Unique Domains', stats.domains.length.toString()],
      ['Active Domains', stats.domains.join(', ') || 'None']
    ];
    
    console.log(table(statusTable));
    
    await worldModel.disconnect();
    
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Failed to load status:'), error);
    process.exit(1);
  }
}

function displayImportResult(result: any, sourceName: string) {
  console.log(chalk.green.bold(`\n✅ Import completed: ${sourceName}`));
  console.log(chalk.cyan(`📊 Records processed: ${result.recordsProcessed}`));
  console.log(chalk.cyan(`📥 Records imported: ${result.recordsImported}`));
  console.log(chalk.cyan(`⏱️  Processing time: ${result.processingTime}ms`));
  console.log(chalk.cyan(`🔍 Patterns found: ${result.patterns.length}`));
  
  if (result.errors.length > 0) {
    console.log(chalk.red(`❌ Errors: ${result.errors.length}`));
    result.errors.slice(0, 5).forEach((error: string) => {
      console.log(chalk.red(`  • ${error}`));
    });
  }
  
  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`⚠️  Warnings: ${result.warnings.length}`));
    result.warnings.slice(0, 5).forEach((warning: string) => {
      console.log(chalk.yellow(`  • ${warning}`));
    });
  }
}

function displayMultipleImportResults(results: Map<string, any>) {
  console.log(chalk.green.bold('\n📊 Import Results Summary\n'));
  
  const tableData = [
    ['Source', 'Processed', 'Imported', 'Success Rate', 'Errors', 'Time (ms)']
  ];
  
  let totalProcessed = 0;
  let totalImported = 0;
  let totalTime = 0;
  
  results.forEach((result, sourceName) => {
    const successRate = result.recordsProcessed > 0 
      ? ((result.recordsImported / result.recordsProcessed) * 100).toFixed(1)
      : '0';
    
    tableData.push([
      sourceName,
      result.recordsProcessed.toString(),
      result.recordsImported.toString(),
      `${successRate}%`,
      result.errors.length.toString(),
      result.processingTime.toString()
    ]);
    
    totalProcessed += result.recordsProcessed;
    totalImported += result.recordsImported;
    totalTime += result.processingTime;
  });
  
  // Add totals row
  const overallSuccessRate = totalProcessed > 0 
    ? ((totalImported / totalProcessed) * 100).toFixed(1)
    : '0';
  
  tableData.push([
    chalk.bold('TOTAL'),
    chalk.bold(totalProcessed.toString()),
    chalk.bold(totalImported.toString()),
    chalk.bold(`${overallSuccessRate}%`),
    chalk.bold('-'),
    chalk.bold(totalTime.toString())
  ]);
  
  console.log(table(tableData));
}

function displayDataSources(dataSources: DataSource[]) {
  const tableData = [
    ['Name', 'Type', 'Path', 'Status']
  ];
  
  dataSources.forEach(source => {
    tableData.push([
      source.name,
      source.type,
      source.path,
      source.enabled ? chalk.green('Enabled') : chalk.red('Disabled')
    ]);
  });
  
  console.log(table(tableData));
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export default program;