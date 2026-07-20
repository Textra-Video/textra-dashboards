import React, { useState, useEffect } from 'react';
import axios from 'axios';

function fmtCurrency(value) {
  if (!value) return '—';
  return `£${(value / 1000).toFixed(1)}k`;
}

export default function FinanceDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notConnected, setNotConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [drilldown, setDrilldown] = useState(null);

  const fetchFinancials = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/data/xero-financials');
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
  }, []);

  if (notConnected) {
    return (
      <div className="dashboard-content">
        <div className="connect-prompt">
          <p>Please authenticate with Xero to view financial data</p>
          <button
            className="connect-button"
            onClick={() => {
              window.location.href = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_XERO_REDIRECT_URI)}&scope=offline_access%20accounting.invoices%20accounting.payments%20accounting.banktransactions%20accounting.reports.aged.read%20accounting.reports.balancesheet.read%20accounting.reports.profitandloss.read%20accounting.contacts%20accounting.settings.read`;
            }}
          >
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
        </div>
        <button className="refresh-button" onClick={fetchFinancials} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
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
                        {drilldown.items?.map((acc, i) => (
                          <tr key={i}>
                            <td>{acc.name}</td>
                            <td className="code">{acc.code}</td>
                            <td className="amount">{fmtCurrency(acc.balance)}</td>
                            <td>{acc.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {drilldown.type === 'report' && (
                    <pre className="report-data">{JSON.stringify(drilldown.items, null, 2)}</pre>
                  )}
                </div>
                {drilldown.xeroLink && (
                  <a href={drilldown.xeroLink} target="_blank" rel="noopener noreferrer" className="view-in-xero-link">
                    View in Xero →
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
                  xeroLink: 'https://go.xero.com/app/Settings/Bank',
                })
              }
            >
              <div className="metric-label">💰 Cash Position</div>
              <div className="metric-value">{fmtCurrency(data.totalCash)}</div>
              <div className="metric-subtext">
                {data.bankAccounts?.length || 0} bank account{(data.bankAccounts?.length || 0) !== 1 ? 's' : ''}
              </div>
            </button>

            <button
              className="metric-card metric-card-clickable success"
              onClick={() =>
                setDrilldown({
                  title: '📊 Profit & Loss',
                  description: 'Income, expenses, and net income for the current period.',
                  type: 'report',
                  items: data.profitAndLoss,
                  xeroLink: 'https://go.xero.com/app/Reports/ProfitandLoss',
                })
              }
            >
              <div className="metric-label">📊 P&L — Net Income</div>
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
                  type: 'report',
                  items: data.balanceSheet,
                  xeroLink: 'https://go.xero.com/app/Reports/BalanceSheet',
                })
              }
            >
              <div className="metric-label">📈 Balance Sheet — Assets</div>
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
                  type: 'accounts',
                  items: data.invoices,
                  xeroLink: 'https://go.xero.com/app/AccountsReceivable/ViewInvoicesList',
                })
              }
            >
              <div className="metric-label">📥 Accounts Receivable</div>
              <div className="metric-value">{fmtCurrency(data.totalReceivable)}</div>
              <div className="metric-subtext">{data.invoices?.length || 0} outstanding invoice{(data.invoices?.length || 0) !== 1 ? 's' : ''}</div>
            </button>

            <button
              className="metric-card metric-card-clickable"
              onClick={() =>
                setDrilldown({
                  title: '📤 Bills Payable',
                  description: 'Supplier bills awaiting payment.',
                  type: 'accounts',
                  items: data.payments,
                  xeroLink: 'https://go.xero.com/app/AccountsPayable/ViewPayablesList',
                })
              }
            >
              <div className="metric-label">📤 Accounts Payable</div>
              <div className="metric-value">{fmtCurrency(data.totalPayable)}</div>
              <div className="metric-subtext">{data.payments?.length || 0} outstanding bill{(data.payments?.length || 0) !== 1 ? 's' : ''}</div>
            </button>

            <button
              className="metric-card metric-card-clickable"
              onClick={() =>
                setDrilldown({
                  title: '💳 Bank Transactions',
                  description: 'Recent transactions across all bank accounts.',
                  type: 'accounts',
                  items: data.bankTransactions,
                  xeroLink: 'https://go.xero.com/app/Settings/Bank',
                })
              }
            >
              <div className="metric-label">💳 Recent Transactions</div>
              <div className="metric-value">{data.bankTransactions?.length || 0}</div>
              <div className="metric-subtext">Latest activity across bank accounts</div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
