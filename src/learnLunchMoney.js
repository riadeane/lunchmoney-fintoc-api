const { fetchTransactions } = require('./fetchLM');
const { saveMemory } = require('./memory');
const { withRetry, shouldRetryHttpError } = require('./utils');
const chalk = require('chalk');

/**
 * Build categorization memory from Lunch Money transaction history
 * @param {string} token Lunch Money API token
 * @param {string} startDate Start date for learning (default: 2023-01-01)
 * @param {boolean} saveToFile Whether to save the memory to file
 * @returns {Promise<Object>} Memory object with payee -> category mappings
 */
async function buildMemoryFromLunchMoney(token, startDate = '2023-01-01', saveToFile = true) {
  console.log(chalk.blue(`📚 Learning from Lunch Money transactions since ${startDate}...`));
  
  try {
    // Fetch all transactions with retry logic
    const history = await withRetry(
      () => fetchTransactionsForLearning(token, startDate),
      3,
      1000,
      shouldRetryHttpError
    );

    console.log(chalk.blue(`Found ${history.length} historical transactions to analyze`));

    const memory = {};
    const categoryStats = {};
    let processed = 0;
    let learned = 0;

    for (const tx of history) {
      processed++;
      
      // Only learn from transactions that have both payee and category
      if (tx.payee && tx.category_name && tx.payee.trim() && tx.category_name.trim()) {
        const payee = tx.payee.trim();
        const category = tx.category_name.trim();
        
        // Track category usage for conflict resolution
        if (!categoryStats[payee]) {
          categoryStats[payee] = {};
        }
        if (!categoryStats[payee][category]) {
          categoryStats[payee][category] = 0;
        }
        categoryStats[payee][category]++;
      }
    }

    // Build memory using most frequent category for each payee
    for (const [payee, categories] of Object.entries(categoryStats)) {
      // Find the most frequently used category for this payee
      let maxCount = 0;
      let preferredCategory = null;
      
      for (const [category, count] of Object.entries(categories)) {
        if (count > maxCount) {
          maxCount = count;
          preferredCategory = category;
        }
      }
      
      if (preferredCategory && maxCount >= 2) { // Require at least 2 occurrences
        memory[payee] = preferredCategory;
        learned++;
      }
    }

    console.log(chalk.green(`✓ Processed ${processed} transactions`));
    console.log(chalk.green(`✓ Learned ${learned} payee-category mappings`));
    
    // Show some statistics
    const uniqueCategories = [...new Set(Object.values(memory))];
    console.log(chalk.blue(`📊 Statistics:`));
    console.log(`  • Unique payees learned: ${Object.keys(memory).length}`);
    console.log(`  • Unique categories: ${uniqueCategories.length}`);
    
    // Save to file if requested
    if (saveToFile) {
      saveMemory(memory);
      console.log(chalk.green('✓ Memory saved to categorization_memory.json'));
    }

    return memory;

  } catch (error) {
    console.error(chalk.red('Error building memory from Lunch Money:'), error.message);
    throw error;
  }
}

/**
 * Enhanced fetch transactions for learning with additional metadata
 * @param {string} token Lunch Money API token
 * @param {string} startDate Start date for fetching
 * @returns {Promise<Array>} Array of transactions with payee and category info
 */
async function fetchTransactionsForLearning(token, startDate) {
  const axios = require('axios');
  const results = [];
  let page = 1;
  const perPage = 1000; // Larger page size for learning
  let hasMore = true;

  while (hasMore) {
    const params = {
      start_date: startDate,
      debit_as_negative: false,
      per_page: perPage,
      page
    };

    try {
      const response = await axios.get('https://dev.lunchmoney.app/v1/transactions', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });

      const data = response.data;
      const transactions = data.transactions || [];
      
      for (const tx of transactions) {
        // Only include transactions with both payee and category information
        if (tx.payee && (tx.category_name || tx.category_id)) {
          results.push({
            id: tx.id,
            date: tx.date,
            amount: parseFloat(tx.amount) || 0,
            payee: tx.payee,
            category_name: tx.category_name,
            category_id: tx.category_id,
            notes: tx.notes
          });
        }
      }

      hasMore = data.has_more === true;
      page += 1;

      // Show progress for large datasets
      if (page % 10 === 0) {
        console.log(chalk.yellow(`  Fetched page ${page - 1} (${results.length} relevant transactions so far)...`));
      }

    } catch (err) {
      throw new Error(`Lunch Money API error on page ${page}: ${err.response?.data?.error || err.message}`);
    }
  }

  return results;
}

module.exports = { 
  buildMemoryFromLunchMoney,
  fetchTransactionsForLearning 
};
