const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const { sync } = require('./src/sync');
const { loadConfig } = require('./src/config');
const { getMemoryStats } = require('./src/memory');
const { buildMemoryFromLunchMoney } = require('./src/learnLunchMoney');
const { sanitizeErrorForLogging } = require('./src/utils');
const chalk = require('chalk');

const app = express();
const PORT = process.env.PORT || 5000;

// Add JSON middleware
app.use(express.json());

// Server statistics
let serverStats = {
  startTime: new Date().toISOString(),
  lastSync: null,
  lastMemoryUpdate: null,
  totalSyncs: 0,
  totalErrors: 0,
  lastError: null
};

async function updateMemory() {
  try {
    console.log(chalk.blue('🔄 Rebuilding memory from Lunch Money'));
    const config = loadConfig();
    const memory = await buildMemoryFromLunchMoney(config.lunchmoneyToken);
    serverStats.lastMemoryUpdate = new Date().toISOString();
    console.log(chalk.green('✓ Memory rebuild completed'));
  } catch (error) {
    const sanitizedError = sanitizeErrorForLogging(error, { operation: 'memory_update' });
    console.error(chalk.red('Error rebuilding memory:'), error.message);
    serverStats.totalErrors++;
    serverStats.lastError = {
      timestamp: new Date().toISOString(),
      operation: 'memory_update',
      message: error.message
    };
  }
}

async function runScheduledSync() {
  try {
    console.log(chalk.blue('🔃 Running scheduled sync...'));
    const config = loadConfig();
    const result = await sync({ config });
    
    serverStats.lastSync = new Date().toISOString();
    serverStats.totalSyncs++;
    
    if (result.success) {
      console.log(chalk.green(`✓ Sync completed: ${result.inserted} inserted, ${result.skipped} skipped`));
    } else {
      console.log(chalk.yellow(`⚠ Sync completed with errors: ${result.errors} errors`));
      serverStats.totalErrors++;
      serverStats.lastError = {
        timestamp: new Date().toISOString(),
        operation: 'scheduled_sync',
        message: `Sync completed with ${result.errors} errors`
      };
    }
  } catch (error) {
    const sanitizedError = sanitizeErrorForLogging(error, { operation: 'scheduled_sync' });
    console.error(chalk.red('Error in scheduled sync:'), error.message);
    serverStats.totalErrors++;
    serverStats.lastError = {
      timestamp: new Date().toISOString(),
      operation: 'scheduled_sync',
      message: error.message
    };
  }
}

// Schedule tasks
cron.schedule('0 3 * * *', updateMemory, {
  name: 'daily-memory-update',
  timezone: 'UTC'
});

cron.schedule('0 * * * *', runScheduledSync, {
  name: 'hourly-sync',
  timezone: 'UTC'
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const config = loadConfig();
    const healthChecks = [];
    
    // Check Lunch Money API connectivity
    try {
      await axios.get('https://dev.lunchmoney.app/v1/categories', {
        headers: { Authorization: `Bearer ${config.lunchmoneyToken}` },
        timeout: 5000
      });
      healthChecks.push({ service: 'lunch_money', status: 'healthy' });
    } catch (err) {
      healthChecks.push({ 
        service: 'lunch_money', 
        status: 'unhealthy', 
        error: err.message 
      });
    }
    
    // Check Fintoc API connectivity
    try {
      await axios.get('https://api.fintoc.com/v1/health', { timeout: 5000 });
      healthChecks.push({ service: 'fintoc', status: 'healthy' });
    } catch (err) {
      healthChecks.push({ 
        service: 'fintoc', 
        status: 'unhealthy', 
        error: err.message 
      });
    }
    
    const allHealthy = healthChecks.every(check => check.status === 'healthy');
    const status = allHealthy ? 'healthy' : 'degraded';
    
    res.status(allHealthy ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      version: require('./package.json').version,
      uptime: Math.floor((Date.now() - new Date(serverStats.startTime).getTime()) / 1000),
      checks: healthChecks
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Stats endpoint
app.get('/stats', (req, res) => {
  const memoryStats = getMemoryStats();
  
  res.json({
    server: serverStats,
    memory: memoryStats,
    cron_jobs: cron.getTasks().size
  });
});

// Manual sync endpoint
app.post('/sync', async (req, res) => {
  try {
    const { dryRun = false } = req.body;
    console.log(chalk.blue(`🔄 Manual sync triggered (dry-run: ${dryRun})`));
    
    const config = loadConfig();
    const result = await sync({ config, dryRun });
    
    if (!dryRun) {
      serverStats.lastSync = new Date().toISOString();
      serverStats.totalSyncs++;
      
      if (!result.success) {
        serverStats.totalErrors++;
      }
    }
    
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const sanitizedError = sanitizeErrorForLogging(error, { operation: 'manual_sync' });
    serverStats.totalErrors++;
    serverStats.lastError = {
      timestamp: new Date().toISOString(),
      operation: 'manual_sync',
      message: error.message
    };
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manual memory rebuild endpoint
app.post('/rebuild-memory', async (req, res) => {
  try {
    console.log(chalk.blue('🔄 Manual memory rebuild triggered'));
    const config = loadConfig();
    const memory = await buildMemoryFromLunchMoney(config.lunchmoneyToken);
    
    serverStats.lastMemoryUpdate = new Date().toISOString();
    
    res.json({
      success: true,
      entries: Object.keys(memory).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const sanitizedError = sanitizeErrorForLogging(error, { operation: 'manual_memory_rebuild' });
    serverStats.totalErrors++;
    serverStats.lastError = {
      timestamp: new Date().toISOString(),
      operation: 'manual_memory_rebuild',
      message: error.message
    };
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Lunchmoney-Fintoc Sync Server',
    status: 'running',
    version: require('./package.json').version,
    endpoints: {
      health: '/health',
      stats: '/stats',
      manual_sync: 'POST /sync',
      rebuild_memory: 'POST /rebuild-memory'
    }
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log(chalk.yellow('SIGTERM received, shutting down gracefully'));
  cron.getTasks().forEach(task => task.stop());
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('SIGINT received, shutting down gracefully'));
  cron.getTasks().forEach(task => task.stop());
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(chalk.green(`🚀 Sync server running on port ${PORT}`));
  console.log(chalk.blue(`📊 Health check: http://localhost:${PORT}/health`));
  console.log(chalk.blue(`📈 Stats: http://localhost:${PORT}/stats`));
  
  // Initialize memory on startup
  updateMemory();
});
