import axios from 'axios';
import { getValidXeroAccessToken, forceRefreshXeroAccessToken } from '../../../lib/xeroAuth';

async function fetchWithRetry(accessToken, tenantId, endpoint, params = {}) {
  try {
    return await axios.get(`https://api.xero.com/api.xro/2.0/${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        Accept: 'application/json',
      },
      params,
    });
  } catch (err) {
    if (err.response?.status === 401) {
      const { accessToken: newToken, tenantId: newTenantId } = await forceRefreshXeroAccessToken();
      return await axios.get(`https://api.xero.com/api.xro/2.0/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${newToken}`,
          'Xero-tenant-id': newTenantId,
          Accept: 'application/json',
        },
        params,
      });
    }
    throw err;
  }
}

async function fetchFinancialData(accessToken, tenantId) {
  const data = {};

  try {
    const accountsRes = await fetchWithRetry(accessToken, tenantId, 'Accounts', { where: 'Type=="BANK"' });
    data.bankAccounts = (accountsRes.data.Accounts || []).map((acc) => ({
      name: acc.Name,
      code: acc.Code,
      balance: acc.CurrencyCode === 'GBP' ? acc.CurrentGeographicRegion?.indexOf('UK') >= 0 ? 0 : 0 : 0,
      currency: acc.CurrencyCode,
    }));
    data.totalCash = data.bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  } catch (err) {
    console.error('Bank accounts error:', err.response?.status, err.response?.data?.Detail);
  }

  try {
    const invoicesRes = await fetchWithRetry(accessToken, tenantId, 'Invoices', {
      where: 'Status=="AUTHORISED" || Status=="SUBMITTED"',
    });
    data.invoices = (invoicesRes.data.Invoices || []);
    data.totalReceivable = data.invoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);
  } catch (err) {
    console.error('Invoices error:', err.response?.status, err.response?.data?.Detail);
  }

  try {
    const paymentsRes = await fetchWithRetry(accessToken, tenantId, 'BankTransactions', {
      where: 'Type=="ACCRECPAYABLE"',
    });
    data.payments = (paymentsRes.data.BankTransactions || []);
    data.totalPayable = data.payments.reduce((sum, pmt) => sum + (pmt.Total || 0), 0);
  } catch (err) {
    console.error('Payments error:', err.response?.status, err.response?.data?.Detail);
  }

  try {
    const txRes = await fetchWithRetry(accessToken, tenantId, 'BankTransactions');
    data.bankTransactions = (txRes.data.BankTransactions || []).slice(0, 20);
  } catch (err) {
    console.error('Bank transactions error:', err.response?.status, err.response?.data?.Detail);
  }

  // P&L and Balance Sheet - these return Report XML, not standard objects
  try {
    const plRes = await fetchWithRetry(accessToken, tenantId, 'Reports/ProfitAndLoss');
    data.profitAndLoss = plRes.data;
    // Extract key metrics if available
    data.revenue = 0;
    data.expenses = 0;
    data.netIncome = 0;
  } catch (err) {
    console.error('P&L report error:', err.response?.status, err.response?.data?.Detail);
  }

  try {
    const bsRes = await fetchWithRetry(accessToken, tenantId, 'Reports/BalanceSheet');
    data.balanceSheet = bsRes.data;
    data.totalAssets = 0;
    data.totalLiabilities = 0;
    data.totalEquity = 0;
  } catch (err) {
    console.error('Balance sheet error:', err.response?.status, err.response?.data?.Detail);
  }

  return data;
}

export default async function handler(req, res) {
  try {
    let { accessToken, tenantId } = await getValidXeroAccessToken();

    const data = await fetchFinancialData(accessToken, tenantId);

    res.status(200).json({
      success: true,
      data: {
        ...data,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error.message === 'XERO_NOT_CONNECTED') {
      return res.status(401).json({ error: 'not_connected' });
    }
    console.error('Xero financials error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    const status = error.response?.status === 401 ? 401 : 500;
    res.status(status).json({
      error: 'Failed to fetch Xero data',
      details: error.response?.data?.Detail || error.message,
    });
  }
}
