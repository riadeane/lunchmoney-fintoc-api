const chalk = require('chalk');
const axios = require('axios');
const { fetchBancoChileEmails } = require('./fetchGmail');
const { fetchTransactions } = require('./fetchLM');
const { assignCategoryId } = require('./categorize');
const {
  withRetry,
  shouldRetryHttpError,
  generateTransactionFingerprint,
  sanitizeErrorForLogging,
  batchArray
} = require('./utils');

/**
 * Sync recent movements to Lunch Money from Banco de Chile credit card
 * notification emails retrieved from Gmail.
 *
 * @param {Object} options
 * @param {Object} options.config Configuration object returned by loadConfig().
 * @param {boolean} options.dryRun If true, only output what would be done.
 */
async function sync({ config, dryRun = false }) {
  const {
    lunchmoneyToken,
    daysToSync,
    categoryRules,
    currency,
    lunchmoneyAssetId,
    gmailClientId,
    gmailClientSecret,
    gmailRefreshToken,
    gmailUser
  } = config;
  let movements = [];

  // Fetch Gmail Banco de Chile transactions if configured
  if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
    try {
      const gmailTx = await withRetry(
        () =>
          fetchBancoChileEmails({
            clientId: gmailClientId,
            clientSecret: gmailClientSecret,
            refreshToken: gmailRefreshToken,
            user: gmailUser,
            daysToSync
          }),
        3,
        1000,
        shouldRetryHttpError
      );
      console.log(chalk.blue(`Found ${gmailTx.length} Gmail transactions to process`));
      movements.push(...gmailTx);
    } catch (err) {
      const sanitizedError = sanitizeErrorForLogging(err, { operation: 'fetch_gmail' });
      console.error(chalk.red(`Error fetching Gmail transactions: ${err.message}`));
      console.error('Details:', JSON.stringify(sanitizedError, null, 2));
    }
  }

  if (movements.length === 0) {
    console.log(chalk.yellow('No transactions found in the given period.'));
    return;
  }

  console.log(chalk.blue(`Processing ${movements.length} transaction(s)`));

  // Determine date range for checking duplicates
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysToSync);
  const startDateStr = startDate.toISOString().slice(0, 10);
  const endDateStr = endDate.toISOString().slice(0, 10);

  // Fetch existing Lunch Money transactions for dedupe with retry logic
  let existing;
  try {
    existing = await withRetry(
      () => fetchTransactions(lunchmoneyToken, startDateStr, endDateStr, lunchmoneyAssetId),
      3,
      1000,
      shouldRetryHttpError
    );
  } catch (err) {
    const sanitizedError = sanitizeErrorForLogging(err, { operation: 'fetch_lunchmoney' });
    console.error(chalk.red(`Error fetching Lunch Money transactions: ${err.message}`));
    console.error('Details:', JSON.stringify(sanitizedError, null, 2));
    return;
  }

  console.log(chalk.blue(`Found ${existing.length} existing Lunch Money transactions for duplicate check`));

  // Create enhanced duplicate detection using both simple key and fingerprint
  const existingFingerprints = new Set();
  const existingSimpleKeys = new Set();
  
  for (const tx of existing) {
    // Simple key for backward compatibility
    const simpleKey = `${tx.date}-${Number(tx.amount).toFixed(2)}`;
    existingSimpleKeys.add(simpleKey);
    
    // Enhanced fingerprint for better detection
    const fingerprint = generateTransactionFingerprint({
      date: tx.date,
      amount: tx.amount,
      payee: tx.payee || '',
      reference: tx.external_id || tx.id
    });
    existingFingerprints.add(fingerprint);
  }

  const newTransactions = [];
  const skippedDuplicates = [];
  const processingErrors = [];

  for (const movement of movements) {
    try {
      // Check for duplicates using both methods
      const simpleKey = `${movement.date}-${Number(movement.amount).toFixed(2)}`;
      const fingerprint = generateTransactionFingerprint({
        date: movement.date,
        amount: movement.amount,
        payee: movement.payee,
        reference: movement.reference
      });
      
      if (existingSimpleKeys.has(simpleKey) || existingFingerprints.has(fingerprint)) {
        const duplicateInfo = {
          date: movement.date,
          amount: movement.amount.toFixed(2),
          payee: movement.payee,
          method: existingFingerprints.has(fingerprint) ? 'fingerprint' : 'simple'
        };
        skippedDuplicates.push(duplicateInfo);
        
        console.log(
          chalk.yellow(
            `Duplicate skipped (${duplicateInfo.method}): ${movement.date} ${movement.amount.toFixed(2)} ${movement.payee}`
          )
        );
        continue;
      }

      // Assign category with retry logic
      let categoryId = null;
      try {
        categoryId = await withRetry(
          () => assignCategoryId(lunchmoneyToken, movement.payee, categoryRules),
          2, // Fewer retries for categorization
          500
        );
      } catch (err) {
        const sanitizedError = sanitizeErrorForLogging(err, { 
          operation: 'categorize',
          payee: movement.payee 
        });
        processingErrors.push({
          transaction: movement,
          error: err.message,
          step: 'categorization'
        });
        console.error(
          chalk.red(`Failed to assign category for "${movement.payee}": ${err.message}`)
        );
        // Continue without category rather than failing the entire transaction
      }

      const transaction = {
        date: movement.date,
        amount: movement.amount.toFixed(2),
        payee: movement.payee,
        currency: currency.toLowerCase(),
        ...(categoryId ? { category_id: categoryId } : {}),
        ...(lunchmoneyAssetId ? { asset_id: parseInt(lunchmoneyAssetId) } : {}),
        ...(movement.reference ? { external_id: movement.reference } : {})
      };

      newTransactions.push(transaction);
      
      // Add to our tracking sets to prevent duplicates within this batch
      existingSimpleKeys.add(simpleKey);
      existingFingerprints.add(fingerprint);

    } catch (err) {
      const sanitizedError = sanitizeErrorForLogging(err, { 
        operation: 'process_transaction',
        movement 
      });
      processingErrors.push({
        transaction: movement,
        error: err.message,
        step: 'processing'
      });
      console.error(
        chalk.red(`Error processing transaction ${movement.date} ${movement.payee}: ${err.message}`)
      );
    }
  }

  // Summary of processing
  console.log(chalk.blue(`Processing summary:`));
  console.log(chalk.green(`  New transactions: ${newTransactions.length}`));
  console.log(chalk.yellow(`  Duplicates skipped: ${skippedDuplicates.length}`));
  if (processingErrors.length > 0) {
    console.log(chalk.red(`  Processing errors: ${processingErrors.length}`));
  }

  if (newTransactions.length === 0) {
    console.log(chalk.yellow('No new transactions to sync.'));
    return {
      success: true,
      processed: movements.length,
      inserted: 0,
      skipped: skippedDuplicates.length,
      errors: processingErrors.length
    };
  }

  if (dryRun) {
    console.log(chalk.blue(`Dry run: ${newTransactions.length} transaction(s) would be inserted.`));
    for (const tx of newTransactions) {
      console.log(
        chalk.green(
          `NEW ${tx.date} ${tx.amount} ${tx.payee} ${tx.category_id ? `(Category ID: ${tx.category_id})` : ''}`
        )
      );
    }
    return {
      success: true,
      processed: movements.length,
      inserted: newTransactions.length,
      skipped: skippedDuplicates.length,
      errors: processingErrors.length,
      dryRun: true
    };
  }

  // Insert new transactions into Lunch Money with batching for large sets
  const batchSize = 50; // Lunch Money API limit
  const batches = batchArray(newTransactions, batchSize);
  let totalInserted = 0;
  const insertionErrors = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(chalk.blue(`Inserting batch ${i + 1}/${batches.length} (${batch.length} transactions)`));

    try {
      await withRetry(
        async () => {
          const response = await axios.post(
            'https://dev.lunchmoney.app/v1/transactions',
            {
              transactions: batch,
              apply_rules: false,
              skip_duplicates: false,
              debit_as_negative: false,
              skip_balance_update: true
            },
            {
              headers: {
                Authorization: `Bearer ${lunchmoneyToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          return response;
        },
        3,
        1000,
        shouldRetryHttpError
      );

      totalInserted += batch.length;
      console.log(chalk.green(`✓ Batch ${i + 1} inserted successfully (${batch.length} transactions)`));

    } catch (err) {
      const sanitizedError = sanitizeErrorForLogging(err, { 
        operation: 'insert_transactions',
        batchSize: batch.length 
      });
      
      insertionErrors.push({
        batchIndex: i,
        batchSize: batch.length,
        error: err.message
      });

      console.error(
        chalk.red(`✗ Error inserting batch ${i + 1}: ${err.response?.data?.error || err.message}`)
      );
      console.error('Batch details:', JSON.stringify(sanitizedError, null, 2));
    }
  }

  // Final summary
  console.log(chalk.blue('='.repeat(50)));
  console.log(chalk.green(`✓ Successfully inserted ${totalInserted} transaction(s) into Lunch Money`));
  
  if (insertionErrors.length > 0) {
    console.log(chalk.red(`✗ ${insertionErrors.length} batch(es) failed to insert`));
  }
  
  if (processingErrors.length > 0) {
    console.log(chalk.yellow(`⚠ ${processingErrors.length} transaction(s) had processing errors`));
  }

  return {
    success: insertionErrors.length === 0,
    processed: movements.length,
    inserted: totalInserted,
    skipped: skippedDuplicates.length,
    errors: processingErrors.length + insertionErrors.length,
    batches: batches.length,
    insertionErrors,
    processingErrors
  };
}

module.exports = {
  sync
};