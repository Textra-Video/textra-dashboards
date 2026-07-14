import React, { useState, useEffect } from 'react';
import axios from 'axios';

const XERO_AUTH_URL = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_XERO_REDIRECT_URI)}&scope=accounting.banktransactions.read`;

export default function FinanceDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notConnected, setNotConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

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
              window.location.href = XERO_AUTH_URL;
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
      <div className="section-title">Financial Position</div>

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
          <div className="error" style={{ background: '#fff3cd', color: '#664d03', borderColor: '#ffe69c' }}>
            Xero is connected. Real financial metrics (cash balance, runway, burn, MRR) are being built next -
            the previous version of this dashboard showed fabricated numbers, which we&apos;ve removed rather
            than keep displaying. Below is what&apos;s confirmed live from your Xero organisation right now.
          </div>

          <div className="section-title">Connected Bank Accounts</div>
          <div className="chart-container">
            <div className="deal-list">
              {data.bankAccounts.map((acc) => (
                <div key={acc.code} className="deal-list-row">
                  <div className="deal-list-main">
                    <span className="deal-list-name">{acc.name}</span>
                    <span className="deal-list-stage">{acc.status}</span>
                  </div>
                  <div className="deal-list-meta">
                    <span>Code: {acc.code}</span>
                    <span>Currency: {acc.currency}</span>
                  </div>
                </div>
              ))}
              {data.bankAccounts.length === 0 && <p className="last-updated">No bank accounts found.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
