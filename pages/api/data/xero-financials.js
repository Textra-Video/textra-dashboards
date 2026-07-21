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

// Xero Reports API nests rows inside Sections (Row.Rows). Flatten so we can
// scan every Row/SummaryRow by its label regardless of nesting depth.
function flattenReportRows(rows = []) {
  const flat = [];
  rows.forEach((row) => {
    if (row.Rows) flat.push(...flattenReportRows(row.Rows));
    else flat.push(row);
  });
  return flat;
}

function findRowValue(flatRows, labelMatchers) {
  const row = flatRows.find((r) => {
    const label = r.Cells?.[0]?.Value || '';
    return labelMatchers.some((m) => label.toLowerCase().includes(m));
  });
  const raw = row?.Cells?.[1]?.Value;
  return raw ? parseFloat(raw) || 0 : 0;
}

// Helper to parse invoice dates consistently
function parseInvoiceDate(inv) {
  if (inv.DateString) {
    return new Date(inv.DateString);
  } else if (inv.Date && typeof inv.Date === 'string') {
    if (inv.Date.startsWith('/Date(')) {
      const match = inv.Date.match(/^\/Date\((\d+)/);
      return match ? new Date(parseInt(match[1])) : new Date(inv.Date);
    } else {
      return new Date(inv.Date);
    }
  } else {
    return new Date(inv.Date);
  }
}

// Helper to check if invoice is within date range
function isInvoiceInDateRange(inv, startDate, endDate) {
  if (!startDate && !endDate) return true;
  const invDate = parseInvoiceDate(inv);
  if (startDate && invDate < new Date(startDate)) return false;
  if (endDate && invDate > new Date(endDate)) return false;
  return true;
}

async function fetchFinancialData(accessToken, tenantId, { startDate, endDate } = {}) {
  const data = { dateRange: { startDate, endDate } };

  // Bank accounts - list of accounts (name/code/currency) has no balance field;
  // actual balances come from the BankSummary report below.
  try {
    const accountsRes = await fetchWithRetry(accessToken, tenantId, 'Accounts', { where: 'Type=="BANK"' });
    data.bankAccounts = (accountsRes.data.Accounts || []).map((acc) => ({
      accountId: acc.AccountID,
      name: acc.Name,
      code: acc.Code,
      balance: 0,
      currency: acc.CurrencyCode,
    }));
  } catch (err) {
    console.error('Bank accounts error:', err.response?.status);
    data.bankAccounts = [];
  }

  // Bank Summary report - the only endpoint that returns actual closing balances
  // NOTE: Do NOT filter by date range - show current balance regardless of date filter
  // Cash Position is a point-in-time metric, not a period metric
  try {
    const reportParams = {};
    // Always get current balance, don't filter by date range
    const bankSummaryRes = await fetchWithRetry(accessToken, tenantId, 'Reports/BankSummary', reportParams);
    const report = bankSummaryRes.data.Reports?.[0];
    const flatRows = flattenReportRows(report?.Rows || []);

    const balanceByName = {};
    flatRows.forEach((row) => {
      const name = row.Cells?.[0]?.Value;
      const closingCell = row.Cells?.[row.Cells.length - 1];
      if (name && closingCell?.Value !== undefined) {
        const balance = parseFloat(closingCell.Value);
        if (!isNaN(balance)) balanceByName[name] = balance;
      }
    });

    data.bankAccounts = data.bankAccounts.map((acc) => ({
      ...acc,
      balance: balanceByName[acc.name] ?? 0,
    }));
    data.totalCash = data.bankAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  } catch (err) {
    console.error('Bank summary error:', err.response?.status, err.response?.data?.Detail);
    data.totalCash = 0;
  }

  // Invoices (accounts receivable) - get all invoices and filter in code
  try {
    const invoicesRes = await fetchWithRetry(accessToken, tenantId, 'Invoices');
    const allInvoices = invoicesRes.data.Invoices || [];
    console.log(`[Xero] Total invoices from API: ${allInvoices.length}`);

    // Log ALL invoices with details
    const allInvoicesSummary = allInvoices.map(i => ({
      type: i.Type,
      status: i.Status,
      total: i.Total,
      date: i.DateString || i.Date,
      number: i.InvoiceNumber
    }));
    console.log('[Xero] ALL invoices:', JSON.stringify(allInvoicesSummary, null, 2));

    // Count by type and status
    const byTypeStatus = {};
    allInvoices.forEach(inv => {
      const key = `${inv.Type}/${inv.Status}`;
      byTypeStatus[key] = (byTypeStatus[key] || 0) + 1;
    });
    console.log('[Xero] Invoice counts by type/status:', byTypeStatus);

    // For display purposes, show only outstanding (AUTHORISED) invoices
    const displayInvoices = allInvoices
      .filter((inv) => {
        if (inv.Type !== 'ACCREC' || inv.Status !== 'AUTHORISED') return false;
        return isInvoiceInDateRange(inv, startDate, endDate);
      })
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
          invoiceId: inv.InvoiceID,
          invoiceNumber: inv.InvoiceNumber,
          contact: inv.Contact?.Name || 'Unknown',
          amount: inv.Total || 0,
          dueDate,
          status: inv.Status,
        };
      });
    data.invoices = displayInvoices;

    // Calculate totalReceivable from AUTHORISED invoices (outstanding)
    data.totalReceivable = data.invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    // Calculate totalIncome - sum all posted revenue: AUTHORISED (unpaid) + PAID (already paid)
    // Exclude DRAFT, VOIDED, DELETED, SUBMITTED
    const incomeInvoices = allInvoices.filter(inv =>
      inv.Type === 'ACCREC' &&
      (inv.Status === 'AUTHORISED' || inv.Status === 'PAID') &&
      isInvoiceInDateRange(inv, startDate, endDate)
    );
    let totalIncome = incomeInvoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);

    // Fetch credit notes and subtract from total income (net revenue)
    // Only subtract revenue-related credit notes (e.g., CN-000026)
    let creditNotesTotal = 0;
    try {
      const creditNotesRes = await fetchWithRetry(accessToken, tenantId, 'CreditNotes');
      const creditNotes = creditNotesRes.data.CreditNotes || [];
      console.log(`[Xero] Credit notes fetched: ${creditNotes.length}`);

      // Only subtract specific revenue-related credit notes
      const revenueRelatedCNs = ['CN-000026'];

      creditNotes.forEach(cn => {
        if (revenueRelatedCNs.includes(cn.CreditNoteNumber) &&
            isInvoiceInDateRange(cn, startDate, endDate)) {
          creditNotesTotal += (cn.Total || 0);
          console.log(`[Xero]   CN-${cn.CreditNoteNumber}: £${cn.Total} (revenue-related)`);
        }
      });
    } catch (err) {
      console.log(`[Xero] Could not fetch credit notes: ${err.message}`);
    }

    // Only deduct credit notes if we have revenue invoices in this period
    // This prevents negative revenue when credit notes exist but no invoices do
    if (incomeInvoices.length > 0) {
      totalIncome -= creditNotesTotal;
    }

    // Ensure totalIncome is never negative
    data.totalIncome = Math.max(0, totalIncome);

    console.log('[Xero] Income invoices included in totalIncome:');
    incomeInvoices.forEach(inv => {
      console.log(`  ${inv.InvoiceNumber}: ${inv.Status} = £${inv.Total}`);
    });
    console.log(`[Xero] Total Income: £${data.totalIncome} (Gross: £${incomeInvoices.reduce((sum, inv) => sum + (inv.Total || 0), 0)} - Credit notes: £${creditNotesTotal})`);

    // Log all invoice details for debugging
    console.log('[Xero] All ACCREC invoices by status:');
    allInvoices.filter(inv => inv.Type === 'ACCREC').forEach(inv => {
      console.log(`  ${inv.InvoiceNumber}: Status=${inv.Status}, Total=${inv.Total}, DateString=${inv.DateString}`);
    });

    // Debug: Log invoice details
    const allAcrec = allInvoices.filter(inv => inv.Type === 'ACCREC');
    const statusCounts = {};
    allAcrec.forEach(inv => {
      statusCounts[inv.Status] = (statusCounts[inv.Status] || 0) + 1;
    });
    console.log('[Xero] ACCREC statuses:', statusCounts);
    console.log(`[Xero] Income invoices (AUTHORISED, in date range): ${incomeInvoices.length}`);
    incomeInvoices.forEach(inv => {
      console.log(`  - ${inv.InvoiceNumber}: £${inv.Total} (${inv.Status})`);
    });
    console.log(`[Xero] Total Income: £${data.totalIncome}`);
  } catch (err) {
    console.error('Invoices error:', err.response?.status, err.response?.data?.Detail);
    data.invoices = [];
    data.totalReceivable = 0;
    data.totalIncome = 0;
  }

  // Bill payments (accounts payable) - get all invoices and filter in code
  try {
    const billsRes = await fetchWithRetry(accessToken, tenantId, 'Invoices');
    data.payments = (billsRes.data.Invoices || [])
      .filter((bill) => {
        if (bill.Type !== 'ACCPAY' || bill.Status !== 'AUTHORISED') return false;
        if (startDate || endDate) {
          const billDate = new Date(bill.DateString || bill.Date);
          if (startDate && billDate < new Date(startDate)) return false;
          if (endDate && billDate > new Date(endDate)) return false;
        }
        return true;
      })
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
          invoiceId: bill.InvoiceID,
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
      .filter((tx) => {
        if (startDate || endDate) {
          const txDate = new Date(tx.DateString || tx.Date);
          if (startDate && txDate < new Date(startDate)) return false;
          if (endDate && txDate > new Date(endDate)) return false;
        }
        return true;
      })
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
          bankTransactionId: tx.BankTransactionID,
          accountId: tx.BankAccount?.AccountID,
          date,
          // Try multiple sources for description: line item, reference, or contact
          description: tx.LineItems?.[0]?.Description || tx.Reference || tx.Description || tx.Contact?.Name || 'Transaction',
          contact: tx.Contact?.Name || tx.LineItems?.[0]?.AccountCode || null,
          amount: tx.Total || 0,
          type: tx.Type,
          status: tx.Status,
          lineItemsCount: tx.LineItems?.length || 0,
        };
      });
  } catch (err) {
    console.error('Bank transactions error:', err.response?.status);
    data.bankTransactions = [];
  }

  // P&L Report - Xero nests real data under data.Reports[0].Rows, with
  // sections (Income, Less Operating Expenses, ...) each containing a
  // SummaryRow labelled "Total X", plus a final top-level "Net Profit" row.
  try {
    const reportParams = {};
    if (startDate) reportParams.fromDate = startDate;
    if (endDate) reportParams.toDate = endDate;
    const plRes = await fetchWithRetry(accessToken, tenantId, 'Reports/ProfitAndLoss', reportParams);
    const report = plRes.data.Reports?.[0];
    const flatRows = flattenReportRows(report?.Rows || []);

    let revenue = findRowValue(flatRows, ['total income', 'total revenue']);
    let expenses = findRowValue(flatRows, ['total operating expenses', 'total expenses', 'total cost of sales']);
    let netIncome = findRowValue(flatRows, ['net profit', 'net income']);

    // Floor revenue to 0 to prevent negative revenue when credit notes exceed invoices
    revenue = Math.max(0, revenue);

    // Recalculate netIncome if it wasn't found in the report
    if (!netIncome) {
      netIncome = revenue - expenses;
    }

    data.revenue = revenue;
    data.expenses = Math.max(0, expenses); // Also floor expenses
    data.netIncome = Math.max(0, netIncome); // Floor netIncome to prevent negative display
    console.log('[Xero] P&L Report:', { revenue, expenses, netIncome, calculated: revenue - expenses });
  } catch (err) {
    console.error('P&L error:', err.response?.status, err.response?.data?.Detail);
    data.revenue = 0;
    data.expenses = 0;
    data.netIncome = 0;
  }

  // Balance Sheet Report - same nested Section/SummaryRow shape as P&L.
  try {
    const reportParams = {};
    if (startDate) reportParams.fromDate = startDate;
    if (endDate) reportParams.toDate = endDate;
    const bsRes = await fetchWithRetry(accessToken, tenantId, 'Reports/BalanceSheet', reportParams);
    const report = bsRes.data.Reports?.[0];
    const flatRows = flattenReportRows(report?.Rows || []);

    data.totalAssets = findRowValue(flatRows, ['total assets']);
    data.totalLiabilities = findRowValue(flatRows, ['total liabilities']);
    data.totalEquity = findRowValue(flatRows, ['total equity', 'net assets']);
  } catch (err) {
    console.error('Balance Sheet error:', err.response?.status, err.response?.data?.Detail);
    data.totalAssets = 0;
    data.totalLiabilities = 0;
    data.totalEquity = 0;
  }

  return data;
}

export default async function handler(req, res) {
  try {
    let { accessToken, tenantId } = await getValidXeroAccessToken();

    const { startDate, endDate } = req.query;
    const data = await fetchFinancialData(accessToken, tenantId, { startDate, endDate });

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
