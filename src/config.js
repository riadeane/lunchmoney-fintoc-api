const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load variables from .env if present
dotenv.config();

/**
 * Load configuration from environment variables and optional config.json.
 *
 * The precedence is:
 *  1. Environment variables (.env)
 *  2. config.json values
 *  3. Hard‑coded defaults
 */
function loadConfig() {
  // Defaults
  const defaults = {
    currency: 'CLP',
    days_to_sync: 7,
    category_rules: {}
  };

  // Attempt to read config.json from current working directory
  const configPath = path.resolve(process.cwd(), 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (typeof json.currency === 'string') {
        defaults.currency = json.currency;
      }
      if (typeof json.days_to_sync === 'number') {
        defaults.days_to_sync = json.days_to_sync;
      }
      if (typeof json.category_rules === 'object') {
        defaults.category_rules = json.category_rules;
      }
    } catch (err) {
      console.warn('Warning: failed to parse config.json:', err.message);
    }
  }

  return {
    lunchmoneyToken: process.env.LUNCHMONEY_TOKEN,
    finocApiKey: process.env.FINTOC_API_KEY,
    finocLinkId: process.env.FINTOC_LINK_ID,
    currency: process.env.CURRENCY_CODE || defaults.currency,
    daysToSync: parseInt(process.env.DAYS_TO_SYNC || defaults.days_to_sync, 10),
    categoryRules: defaults.category_rules,
    lunchmoneyAssetId: process.env.LUNCHMONEY_ASSET_ID || process.env.LM_ASSET_ID || null
  };
}

module.exports = {
  loadConfig
};