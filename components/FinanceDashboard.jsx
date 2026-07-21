import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Info tooltip component
function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip" tabIndex={0}>
      <span className="info-icon">i</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  );
}

// Dashboard summary cards (large numbers in thousands)
function fmtCurrency(value) {
  if (value === 0 || value === '0') return '£0k';
  if (!value) return '—';
  return `£${(value / 1000).toFixed(1)}k`;
}

// Cash position and account balances (full precision in pounds)
function fmtAccountBalance(value) {
  if (value === 0 || value === '0') return '£0.00';
  if (!value) return '—';
  return `£${parseFloat(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Individual transaction amounts (actual pounds)
function fmtTransactionAmount(value) {
  if (value === 0 || value === '0') return '£0.00';
  if (!value) return '—';
  if (Math.abs(value) < 1) return `£${(value).toFixed(2)}`;
  return `£${Math.round(value)}`;
}

function fmtDate(dateValue) {
  if (!dateValue) return '—';
  // API sends ISO dates (YYYY-MM-DD), parse by components to avoid timezone issues
  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return d.toLocaleDateString('en-GB');
  }
  // Fallback if format is unexpected
  return '—';
}

export default function FinanceDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notConnected, setNotConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [dateRange, setDateRange] = useState('since-incorporation'); // 'since-incorporation', 'current-month', 'current-quarter', 'current-year', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getDateRangeParams = () => {
    const today = new Date();
    let startDate, endDate;

    if (dateRange === 'since-incorporation') {
      startDate = new Date(2025, 6, 15); // July 15, 2025
      endDate = today;
    } else if (dateRange === 'current-month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = today;
    } else if (dateRange === 'current-quarter') {
      const quarter = Math.floor(today.getMonth() / 3);
      startDate = new Date(today.getFullYear(), quarter * 3, 1);
      endDate = today;
    } else if (dateRange === 'current-year') {
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = today;
    } else if (dateRange === 'custom') {
      startDate = customStart ? new Date(customStart) : null;
      endDate = customEnd ? new Date(customEnd) : null;
    }

    // Format dates without timezone conversion (toISOString converts to UTC which shifts dates)
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : undefined;

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  };

  const fetchFinancials = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = getDateRangeParams();
      const response = await axios.get('/api/data/xero-financials', { params });
      if (response.data.success) {
        setData(response.data.data);
        setNotConnected(false);
        setLastUpdated(new Date().toLocaleTimeString('en-GB'));
      }
    } catch (err) {
      if (err.response?.data?.error === 'not_connected') {
        setNotConnected(true);
      } else {
        setError(err.response?.data?.details || err.response?.data?.error || 'Failed to fetch financials');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [dateRange, customStart, customEnd]);

  const xeroConnectUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_XERO_REDIRECT_URI)}&scope=offline_access%20accounting.invoices%20accounting.payments%20accounting.banktransactions%20accounting.reports.aged.read%20accounting.reports.balancesheet.read%20accounting.reports.banksummary.read%20accounting.reports.profitandloss.read%20accounting.contacts%20accounting.settings.read`;

  if (notConnected) {
    return (
      <div className="dashboard-content">
        <div className="connect-prompt">
          <p>Please authenticate with Xero to view financial data</p>
          <button className="connect-button" onClick={() => { window.location.href = xeroConnectUrl; }}>
            Connect Xero
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="dashboard-content">
        <div className="loading">Loading financial data...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <div className="section-title">Financial Overview</div>

      <div className="dashboard-toolbar">
        <div>
          {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}
          <a
            href={xeroConnectUrl}
            style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'underline' }}
          >
            Reconnect Xero (grants new permissions)
          </a>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <option value="since-incorporation">Since Incorporation (15 Jul 2025)</option>
            <option value="current-month">This Month</option>
            <option value="current-quarter">This Quarter</option>
            <option value="current-year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
              />
              <span style={{ color: 'var(--muted)' }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px',
                }}
              />
            </>
          )}
          <button className="refresh-button" onClick={fetchFinancials} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {error && <div className="error">Error: {error}</div>}

      {data && (
        <>
          {drilldown && (
            <div className="modal-overlay" onClick={() => setDrilldown(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setDrilldown(null)}>✕</button>
                <h2>{drilldown.title}</h2>
                <p className="modal-description">{drilldown.description}</p>
                <div className="drilldown-data">
                  {drilldown.type === 'accounts' && (
                    <table className="drilldown-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Code</th>
                          <th>Balance</th>
                          <th>Currency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldown.items?.length > 0 ? (
                          drilldown.items.map((acc, i) => (
                            <tr key={i}>
                              <td>{acc.name}</td>
                              <td className="code">{acc.code}</td>
                              <td className="amount">{fmtAccountBalance(acc.balance)}</td>
                              <td>{acc.currency}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>
                              No accounts to display
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  {drilldown.type === 'invoices' && (
                    <table className="drilldown-table">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Contact</th>
                          <th>Amount</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldown.items?.length > 0 ? (
                          drilldown.items.map((inv, i) => (
                            <tr key={i}>
                              <td>{inv.invoiceNumber}</td>
                              <td>{inv.contact}</td>
                              <td className="amount">{fmtCurrency(inv.amount)}</td>
                              <td>{fmtDate(inv.dueDate)}</td>
                              <td>{inv.status}</td>
                              <td>
                                {inv.invoiceId && (
                                  <a
                                    href={`https://go.xero.com/${drilldown.recordType === 'payable' ? 'AccountsPayable' : 'AccountsReceivable'}/View.aspx?InvoiceID=${inv.invoiceId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="view-in-xero-link"
                                    style={{ marginTop: 0 }}
                                  >
                                    View →
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                              No invoices to display
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  {drilldown.type === 'transactions' && (
                    <table className="drilldown-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Contact / Payee</th>
                          <th>Amount</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldown.items?.length > 0 ? (
                          drilldown.items.map((tx, i) => (
                            <tr key={i}>
                              <td>{fmtDate(tx.date)}</td>
                              <td>{tx.description}</td>
                              <td style={{ fontSize: '12px', color: 'var(--muted)' }}>{tx.contact || '—'}</td>
                              <td className="amount">{fmtTransactionAmount(tx.amount)}</td>
                              <td>{tx.type}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                              No transactions to display
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  {drilldown.type === 'summary' && (
                    <table className="drilldown-table">
                      <tbody>
                        {drilldown.summary.map((row, i) => (
                          <tr
                            key={i}
                            onClick={row.onClick}
                            style={row.onClick ? { cursor: 'pointer', opacity: 0.8 } : {}}
                            onMouseEnter={(e) => row.onClick && (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => row.onClick && (e.currentTarget.style.opacity = '0.8')}
                          >
                            <td>{row.label} {row.onClick && '→'}</td>
                            <td className="amount">{fmtCurrency(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {drilldown.xeroLink && drilldown.type !== 'invoices' && (
                  <a href={drilldown.xeroLink} target="_blank" rel="noopener noreferrer" className="view-in-xero-link">
                    Open Xero →
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="metric-grid">
            <button
              className="metric-card metric-card-clickable"
              onClick={() =>
                setDrilldown({
                  title: '💰 Cash Summary',
                  description: 'Bank accounts and current balances from Xero.',
                  type: 'accounts',
                  items: data.bankAccounts,
                  xeroLink: 'https://go.xero.com/',
                })
              }
            >
              <div className="metric-label">
                💰 Cash Position
                <InfoTooltip text="Total balance across all connected bank accounts" />
              </div>
              <div className="metric-value">{fmtAccountBalance(data.totalCash)}</div>
              <div className="metric-subtext">
                {data.bankAccounts?.length || 0} bank account{(data.bankAccounts?.length || 0) !== 1 ? 's' : ''}
              </div>
            </button>

            <button
              className="metric-card metric-card-clickable success"
              onClick={() =>
                setDrilldown({
                  title: '💰 Total Income',
                  description: 'Total invoiced income for the selected period.',
                  type: 'invoices',
                  recordType: 'receivable',
                  items: data.invoices,
                  xeroLink: 'https://go.xero.com/',
                })
              }
            >
              <div className="metric-label">
                💰 Total Income
                <InfoTooltip text="Sum of all invoiced income for the selected date range" />
              </div>
              <div className="metric-value">{fmtCurrency(data.totalIncome)}</div>
              <div className="metric-subtext">{data.invoices?.length || 0} invoice{(data.invoices?.length || 0) !== 1 ? 's' : ''}</div>
            </button>

            <button
              className="metric-card metric-card-clickable success"
              onClick={() =>
                setDrilldown({
                  title: '📊 Profit & Loss',
                  description: 'Income, expenses, and net income for the current period.',
                  type: 'summary',
                  summary: [
                    {
                      label: 'Revenue',
                      value: data.revenue,
                      onClick: () =>
                        setDrilldown({
                          title: '💰 Revenue Details',
                          description: 'All invoices contributing to revenue for the selected period.',
                          type: 'invoices',
                          recordType: 'receivable',
                          items: data.invoices,
                          xeroLink: 'https://go.xero.com/',
                        }),
                    },
                    {
                      label: 'Expenses',
                      value: data.expenses,
                      onClick: () =>
                        setDrilldown({
                          title: '📤 Expense Details',
                          description: 'All bills and payments contributing to expenses for the selected period.',
                          type: 'invoices',
                          recordType: 'payable',
                          items: data.payments,
                          xeroLink: 'https://go.xero.com/',
                        }),
                    },
                    { label: 'Net Income', value: data.netIncome },
                  ],
                  xeroLink: 'https://go.xero.com/',
                })
              }
            >
              <div className="metric-label">
                📊 P&L — Net Income
                <InfoTooltip text="Revenue minus expenses for the selected date range" />
              </div>
              <div className="metric-value">{fmtCurrency(data.netIncome)}</div>
              <div className="metric-subtext">
                Revenue: {fmtCurrency(data.revenue)} · Expenses: {fmtCurrency(data.expenses)}
              </div>
            </button>

            <button
              className="metric-card metric-card-clickable"
              onClick={() =>
                setDrilldown({
                  title: '📈 Balance Sheet',
                  description: 'Assets, liabilities, and equity as of today.',
                  type: 'summary',
                  summary: [
                    {
                      label: 'Total Assets',
                      value: data.totalAssets,
                      onClick: () =>
                        setDrilldown({
                          title: '💼 Assets Breakdown',
                          description: 'All bank accounts and asset accounts.',
                          type: 'accounts',
                          items: data.bankAccounts,
                          xeroLink: 'https://go.xero.com/',
                        }),
                    },
                    { label: 'Total Liabilities', value: data.totalLiabilities },
                    { label: 'Total Equity', value: data.totalEquity },
                  ],
                  xeroLink: 'https://go.xero.com/',
                })
              }
            >
              <div className="metric-label">
                📈 Balance Sheet — Assets
                <InfoTooltip text="Total value of company assets (current snapshot)" />
              </div>
              <div className="metric-value">{fmtCurrency(data.totalAssets)}</div>
              <div className="metric-subtext">
                Liabilities: {fmtCurrency(data.totalLiabilities)} · Equity: {fmtCurrency(data.totalEquity)}
              </div>
            </button>

            <button
              className="metric-card metric-card-clickable"
              onClick={() =>
                setDrilldown({
                  title: '📥 Invoices Outstanding',
                  description: 'Customer invoices not yet paid.',
                  type: 'invoices',
                  recordType: 'receivable',
                  items: data.invoices,
                  xeroLink: 'https://go.xero.com/',
                })
              }
            >
              <div className="metric-label">
                📥 Accounts Receivable
                <InfoTooltip text="Total value of unpaid customer invoices" />
              </div>
              <div className="metric-value">{fmtCurrency(data.totalReceivable)}</div>
              <div className="metric-subtext">{data.invoices?.length || 0} outstanding invoice{(data.invoices?.length || 0) !== 1 ? 's' : ''}</div>
            </button>

            <button
              className="metric-card metric-card-clickable"
              onClick={() =>
                setDrilldown({
                  title: '📤 Bills Payable',
                  description: 'Supplier bills awaiting payment.',
                  type: 'invoices',
                  recordType: 'payable',
                  items: data.payments,
                  xeroLink: 'https://go.xero.com/',
                })
              }
            >
              <div className="metric-label">
                📤 Accounts Payable
                <InfoTooltip text="Total value of unpaid supplier bills" />
              </div>
              <div className="metric-value">{fmtCurrency(data.totalPayable)}</div>
              <div className="metric-subtext">{data.payments?.length || 0} outstanding bill{(data.payments?.length || 0) !== 1 ? 's' : ''}</div>
            </button>

            <button
              className="metric-card metric-card-clickable"
              onClick={() =>
                setDrilldown({
                  title: '💳 Bank Transactions',
                  description: 'Recent transactions across all bank accounts.',
                  type: 'transactions',
                  items: data.bankTransactions,
                  xeroLink: 'https://go.xero.com/',
                })
              }
            >
              <div className="metric-label">
                💳 Recent Transactions
                <InfoTooltip text="Latest bank transactions across all accounts" />
              </div>
              <div className="metric-value">{data.bankTransactions?.length || 0}</div>
              <div className="metric-subtext">Latest activity across bank accounts</div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
