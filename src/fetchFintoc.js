const axios = require('axios');

/**
 * Fetch recent movements from Fintoc.
 *
 * @param {Object} params
 * @param {string} params.apiKey - Fintoc API secret key.
 * @param {string} params.linkId - Fintoc account or link identifier.
 * @param {number} params.daysToSync - Number of days of history to fetch.
 * @returns {Promise<Array<{date: string, amount: number, payee: string}>>}
 */
async function fetchFintocTransactions({ apiKey, linkId, daysToSync }) {
  if (!apiKey || !linkId) {
    throw new Error('Missing Fintoc API key or link ID.');
  }
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - daysToSync);

  const perPage = 200;
  let page = 1;
  let hasMore = true;
  const transactions = [];

  while (hasMore) {
    const url = `https://api.fintoc.com/v1/accounts/${encodeURIComponent(linkId)}/movements`;
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        params: {
          per_page: perPage,
          page
        }
      });

      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        for (const movement of data) {
          // Determine the date field.  Fintoc returns `transaction_date` for movements.
          const dateStr =
            movement.transaction_date ||
            movement.post_date ||
            movement.date ||
            null;
          if (!dateStr) {
            continue;
          }
          const movementDate = new Date(dateStr);
          if (movementDate >= startDate && movementDate <= endDate) {
            const payee =
              movement.description ||
              movement.description_internal ||
              movement.name ||
              movement.concept ||
              movement.source ||
              'Unknown';
            // Amount is returned in the smallest currency unit (e.g. centavos).
            // Convert to major unit by dividing by 100.  For currencies without decimals (e.g. CLP),
            // this will still produce a decimal but will not affect the integer part.
            const amountMinor = Number(movement.amount);
            if (!Number.isFinite(amountMinor)) {
              continue;
            }
            const amountMajor = amountMinor / 100;
            transactions.push({
              date: dateStr.slice(0, 10),
              amount: amountMajor,
              payee
            });
          }
        }
        hasMore = data.length === perPage;
        page += 1;
      } else {
        hasMore = false;
      }
    } catch (err) {
      // Stop looping on errors
      throw new Error(`Fintoc API error: ${err.response?.data?.error || err.message}`);
    }
  }

  return transactions;
}

module.exports = {
  fetchFintocTransactions
};