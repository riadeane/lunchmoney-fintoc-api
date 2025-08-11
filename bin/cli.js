#!/usr/bin/env node

const { program } = require('commander');
const { loadConfig } = require('../src/config');
const { sync } = require('../src/sync');
const { clearMemory, getMemoryStats, loadMemory } = require('../src/memory');
const { buildMemoryFromLunchMoney } = require('../src/learnLunchMoney');
const pkg = require('../package.json');
const chalk = require('chalk');

program
  .version(pkg.version)
  .option('--dry-run', 'Preview changes without sending them')
  .option('--clear-memory', 'Clear all categorization memory')
  .option('--show-memory', 'Display current categorization memory stats')
  .option('--rebuild-memory', 'Rebuild memory from Lunch Money transaction history')
  .option('--export-memory', 'Export memory to config.json format')
  .parse(process.argv);

async function run() {
  const opts = program.opts();
  const config = loadConfig();

  // Handle memory management commands first
  if (opts.clearMemory) {
    try {
      clearMemory();
      console.log(chalk.green('✓ Categorization memory cleared successfully'));
      return;
    } catch (err) {
      console.error(chalk.red('Error clearing memory:', err.message));
      process.exit(1);
    }
  }

  if (opts.showMemory) {
    try {
      const stats = getMemoryStats();
      console.log(chalk.blue('📊 Categorization Memory Statistics:'));
      console.log(`  Total entries: ${stats.totalEntries}`);
      console.log(`  Unique categories: ${stats.uniqueCategories}`);
      console.log(`  Last modified: ${stats.lastModified || 'Never'}`);
      
      if (stats.categories.length > 0) {
        console.log('\n  Categories learned:');
        stats.categories.forEach(cat => console.log(`    • ${cat}`));
      }

      if (stats.totalEntries > 0) {
        console.log('\n  Recent payee mappings:');
        const memory = loadMemory();
        const entries = Object.entries(memory).slice(-10);
        entries.forEach(([payee, category]) => {
          console.log(`    "${payee}" → "${category}"`);
        });
        if (Object.keys(memory).length > 10) {
          console.log(`    ... and ${Object.keys(memory).length - 10} more`);
        }
      }
      return;
    } catch (err) {
      console.error(chalk.red('Error reading memory stats:', err.message));
      process.exit(1);
    }
  }

  if (opts.rebuildMemory) {
    if (!config.lunchmoneyToken) {
      console.error('Error: missing Lunch Money API token. Set LUNCHMONEY_TOKEN in your .env file.');
      process.exit(1);
    }
    
    try {
      console.log(chalk.blue('🔄 Rebuilding memory from Lunch Money transaction history...'));
      const memory = await buildMemoryFromLunchMoney(config.lunchmoneyToken);
      const entries = Object.keys(memory).length;
      console.log(chalk.green(`✓ Memory rebuilt successfully with ${entries} payee-category mappings`));
      return;
    } catch (err) {
      console.error(chalk.red('Error rebuilding memory:', err.message));
      process.exit(1);
    }
  }

  if (opts.exportMemory) {
    try {
      const memory = loadMemory();
      console.log(chalk.blue('📤 Current memory in config.json format:'));
      console.log(JSON.stringify({ category_rules: memory }, null, 2));
      return;
    } catch (err) {
      console.error(chalk.red('Error exporting memory:', err.message));
      process.exit(1);
    }
  }

  // Regular sync operation
  if (!config.lunchmoneyToken) {
    console.error('Error: missing Lunch Money API token. Set LUNCHMONEY_TOKEN in your .env file.');
    process.exit(1);
  }

  if (!config.gmailClientId || !config.gmailClientSecret || !config.gmailRefreshToken) {
    console.error(
      'Error: missing Gmail credentials. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN in your .env file.'
    );
    process.exit(1);
  }

  try {
    const result = await sync({ config, dryRun: opts.dryRun });
    
    // Exit with error code if sync had issues
    if (!result.success) {
      console.error(chalk.red('\n⚠ Sync completed with errors'));
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red('Sync failed:', err.message));
    process.exit(1);
  }
}

run();