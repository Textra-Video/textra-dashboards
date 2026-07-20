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

  // Bank accounts and cash
  try {
    const accountsRes = await fetchWithRetry(accessToken, tenantId, 'Accounts', { where: 'Type=="BANK"' });
    data.bankAccounts = (accountsRes.data.Accounts || []).map((acc) => ({
      name: acc.Name,
      code: acc.Code,
      balance: acc.CurrentGeographicRegion?.indexOf('UK') >= 0 ? 0 : 0,
      currency: acc.CurrencyCode,
    }));
    data.totalCash = data.bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  } catch (err) {
    console.error('Bank accounts error:', err.response?.status);
    data.bankAccounts = [];
    data.totalCash = 0;
  }

  // Invoices (accounts receivable) - get all invoices and filter in code
  try {
    const invoicesRes = await fetchWithRetry(accessToken, tenantId, 'Invoices');
    const sampleInvoice = (invoicesRes.data.Invoices || [])[0];
    if (sampleInvoice) {
      console.log('Xero invoice sample:', { DueDate: sampleInvoice.DueDate, type: typeof sampleInvoice.DueDate });
    }
    data.invoices = (invoicesRes.data.Invoices || [])
      .filter((inv) => inv.Type === 'ACCREC' && inv.Status === 'AUTHORISED')
      .map((inv) => {
        let dueDate = inv.DueDate;
        // Parse Microsoft JSON date format on API side
        if (dueDate && typeof dueDate === 'string' && dueDate.startsWith('/Date(')) {
          const match = dueDate.match(/^\/Date\((\d+)/);
          if (match) {
            const d = new Date(parseInt(match[1]));
            dueDate = d.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
          }
        }
        return {
          invoiceNumber: inv.InvoiceNumber,
          contact: inv.Contact?.Name || 'Unknown',
          amount: inv.Total || 0,
          dueDate,
          status: inv.Status,
        };
      });
    data.totalReceivable = data.invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  } catch (err) {
    console.error('Invoices error:', err.response?.status, err.response?.data?.Detail);
    data.invoices = [];
    data.totalReceivable = 0;
  }

  // Bill payments (accounts payable) - get all invoices and filter in code
  try {
    const billsRes = await fetchWithRetry(accessToken, tenantId, 'Invoices');
    const sampleBill = (billsRes.data.Invoices || []).find((b) => b.Type === 'ACCPAY');
    if (sampleBill) {
      console.log('Xero bill sample:', { DueDate: sampleBill.DueDate, type: typeof sampleBill.DueDate });
    }
    data.payments = (billsRes.data.Invoices || [])
      .filter((bill) => bill.Type === 'ACCPAY' && bill.Status === 'AUTHORISED')
      .map((bill) => {
        let dueDate = bill.DueDate;
        // Parse Microsoft JSON date format on API side
        if (dueDate && typeof dueDate === 'string' && dueDate.startsWith('/Date(')) {
          const match = dueDate.match(/^\/Date\((\d+)/);
          if (match) {
            const d = new Date(parseInt(match[1]));
            dueDate = d.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
          }
        }
        return {
          invoiceNumber: bill.InvoiceNumber,
          contact: bill.Contact?.Name || 'Unknown',
          amount: bill.Total || 0,
          dueDate,
          status: bill.Status,
        };
      });
    data.totalPayable = data.payments.reduce((sum, bill) => sum + (bill.amount || 0), 0);
  } catch (err) {
    console.error('Bills error:', err.response?.status, err.response?.data?.Detail);
    data.payments = [];
    data.totalPayable = 0;
  }

  // Bank transactions
  try {
    const txRes = await fetchWithRetry(accessToken, tenantId, 'BankTransactions');
    data.bankTransactions = (txRes.data.BankTransactions || [])
      .slice(0, 20)
      .map((tx) => {
        let date = tx.DateString || tx.Date;
        // Parse Microsoft JSON date format if present
        if (date && typeof date === 'string' && date.startsWith('/Date(')) {
          const match = date.match(/^\/Date\((\d+)/);
          if (match) {
            const d = new Date(parseInt(match[1]));
            date = d.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
          }
        }
        return {
          date,
          description: tx.LineItems?.[0]?.Description || 'Transaction',
          amount: tx.Total || 0,
          type: tx.Type,
        };
      });
  } catch (err) {
    console.error('Bank transactions error:', err.response?.status);
    data.bankTransactions = [];
  }

  // P&L and Balance Sheet - skip for now (reports need special XML parsing)
  data.profitAndLoss = null;
  data.revenue = 0;
  data.expenses = 0;
  data.netIncome = 0;

  data.balanceSheet = null;
  data.totalAssets = 0;
  data.totalLiabilities = 0;
  data.totalEquity = 0;

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
      message: error.message,
    });
    const status = error.response?.status === 401 ? 401 : 500;
    res.status(status).json({
      error: 'Failed to fetch Xero data',
      details: error.message,
    });
  }
}
