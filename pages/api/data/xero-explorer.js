import axios from 'axios';
import { getValidXeroAccessToken } from '../../../lib/xeroAuth';

// Comprehensive Xero data explorer - fetches all available data types
async function fetchXeroData(accessToken, tenantId) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Xero-tenant-id': tenantId,
    Accept: 'application/json',
  };

  const data = {};
  const errors = [];

  // Helper function to safely fetch data
  const fetchData = async (key, endpoint, params = {}) => {
    try {
      const response = await axios.get(`https://api.xero.com/api.xro/2.0/${endpoint}`, {
        headers,
        params,
      });
      data[key] = response.data[endpoint] || response.data;
      return true;
    } catch (err) {
      errors.push({
        endpoint,
        status: err.response?.status,
        message: err.response?.data?.Detail || err.message,
      });
      return false;
    }
  };

  // Fetch all major data types
  await Promise.all([
    // Core accounting data
    fetchData('accounts', 'Accounts'),
    fetchData('contacts', 'Contacts'),
    fetchData('invoices', 'Invoices', { where: 'Status=="AUTHORISED" || Status=="SUBMITTED" || Status=="PAID"' }),
    fetchData('bankTransactions', 'BankTransactions'),
    fetchData('bankAccounts', 'Accounts', { where: 'Type=="BANK"' }),
    fetchData('payments', 'Payments'),
    fetchData('manualJournals', 'ManualJournals'),

    // Reports
    fetchData('balanceSheet', 'Reports/BalanceSheet'),
    fetchData('profitAndLoss', 'Reports/ProfitAndLoss'),
    fetchData('trialBalance', 'Reports/TrialBalance'),
    fetchData('agedReceivables', 'Reports/AgedReceivables'),
    fetchData('agedPayables', 'Reports/AgedPayables'),
    fetchData('executiveSummary', 'Reports/ExecutiveSummary'),

    // Additional data
    fetchData('taxRates', 'TaxRates'),
    fetchData('trackingCategories', 'TrackingCategories'),
    fetchData('repeatingInvoices', 'RepeatingInvoices'),
    fetchData('budgets', 'Budgets'),
  ]);

  return { data, errors };
}

export default async function handler(req, res) {
  try {
    const { accessToken, tenantId } = await getValidXeroAccessToken();
    const { data, errors } = await fetchXeroData(accessToken, tenantId);

    res.status(200).json({
      success: true,
      message: 'Xero data explorer results',
      dataAvailable: Object.keys(data).filter(key => data[key] && data[key].length > 0),
      data,
      errors: errors.length > 0 ? errors : null,
      summary: {
        accounts: data.accounts?.length || 0,
        contacts: data.contacts?.length || 0,
        invoices: data.invoices?.length || 0,
        bankTransactions: data.bankTransactions?.length || 0,
        payments: data.payments?.length || 0,
        bankAccounts: data.bankAccounts?.length || 0,
      },
    });
  } catch (error) {
    if (error.message === 'XERO_NOT_CONNECTED') {
      return res.status(401).json({ error: 'not_connected' });
    }
    console.error('Xero explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to explore Xero data',
      message: error.message,
    });
  }
}
