const axios = require('axios');

/**
 * Retrieve existing transactions from Lunch Money within a date range.
 *
 * This function calls the Lunch Money "Get All Transactions" endpoint and paginates
 * through results until no more pages are available.
 *
 * @param {string} token Lunch Money API token.
 * @param {string} startDate ISO date string (YYYY-MM-DD) inclusive.
 * @param {string} endDate ISO date string (YYYY-MM-DD) inclusive.
 * @param {string|number|null} assetId Optional asset ID to filter transactions.
 * @returns {Promise<Array<{date: string, amount: number}>>}
 */
async function fetchTransactions(token, startDate, endDate, assetId) {
  const results = [];
  let page = 1;
  const perPage = 500;
  let hasMore = true;

  while (hasMore) {
    const params = {
      start_date: startDate,
      end_date: endDate,
      debit_as_negative: false,
      per_page: perPage,
      page
    };
    if (assetId) {
      params.asset_id = assetId;
    }
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
        const amt = parseFloat(tx.amount);
        if (!isNaN(amt)) {
          results.push({
            date: tx.date,
            amount: amt
          });
        }
      }
      hasMore = data.has_more === true;
      page += 1;
    } catch (err) {
      throw new Error(`Lunch Money API error: ${err.response?.data?.error || err.message}`);
    }
  }
  return results;
}

module.exports = {
  fetchTransactions
};