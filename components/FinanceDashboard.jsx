import React, { useState, useEffect } from 'react';
import axios from 'axios';
import XeroExplorer from './XeroExplorer';

// Using Xero scopes that work - from the team account deployment
// https://developer.xero.com/documentation/guides/oauth2/scopes/
const XERO_AUTH_URL = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_XERO_REDIRECT_URI)}&scope=offline_access%20accounting.transactions%20accounting.reports.read%20accounting.contacts.read`;

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
        <XeroExplorer onDataSelect={(selectedMetrics) => {
          console.log('Selected metrics for dashboard:', selectedMetrics);
          // This callback can be used to save user preferences
        }} />
      )}
    </div>
  );
}
