import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function FinanceDashboard({ xeroAccessToken, xeroTenantId, user }) {
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchFinancials = async () => {
    if (!xeroAccessToken || !xeroTenantId) {
      setError('Not authenticated with Xero');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/data/xero-financials', {
        accessToken: xeroAccessToken,
        tenantId: xeroTenantId,
      });

      if (response.data.success) {
        setFinancials(response.data.data);
        setLastUpdated(new Date().toLocaleTimeString('en-GB'));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch financials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (xeroAccessToken && xeroTenantId) {
      fetchFinancials();
    }
  }, [xeroAccessToken, xeroTenantId]);

  if (!xeroAccessToken || !xeroTenantId) {
    return (
      <div className="dashboard-content">
        <div className="connect-prompt">
          <p>Please authenticate with Xero to view financial data</p>
          <button
            className="connect-button"
            onClick={() => {
              const authUrl = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${process.env.NEXT_PUBLIC_XERO_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_XERO_REDIRECT_URI)}&scope=offline_access%20accounting`;
              window.location.href = authUrl;
            }}
          >
            Connect Xero
          </button>
        </div>
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

      {financials && (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Cash Balance</div>
              <div className="metric-value">£{(financials.cashBalance / 1000).toFixed(0)}k</div>
              <div className="metric-subtext">Current position</div>
            </div>
            <div className={`metric-card ${financials.runway < 3 ? 'alert' : ''}`}>
              <div className="metric-label">Runway</div>
              <div className="metric-value">{financials.runway.toFixed(1)} mo</div>
              <div className="metric-subtext">
                {financials.runway < 3 ? '⚠ Below 3-month threshold' : 'Stable'}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Monthly Burn</div>
              <div className="metric-value">£{(financials.monthlyBurn / 1000).toFixed(0)}k</div>
              <div className="metric-subtext">Average monthly</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">MRR</div>
              <div className="metric-value">£{(financials.mrrInvoiced / 1000).toFixed(1)}k</div>
              <div className="metric-subtext">Invoiced</div>
            </div>
          </div>

          <div className="section-title">Revenue vs. Target</div>
          <div className="chart-container">
            <div className="chart-title">Monthly Revenue Trend (£k)</div>
            <div className="chart-wrapper">
              <Line
                data={{
                  labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                  datasets: [
                    {
                      label: 'Actual',
                      data: [0, 5, 8, 12, 18, 22],
                      borderColor: '#4da89a',
                      backgroundColor: 'rgba(77, 168, 154, 0.08)',
                      tension: 0.4,
                      fill: true,
                    },
                    {
                      label: 'Y1 Target',
                      data: [62, 62, 62, 62, 62, 62],
                      borderColor: '#CCC',
                      borderDash: [5, 5],
                      fill: false,
                      tension: 0.4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true },
                  },
                }}
              />
            </div>
          </div>

          <div className="section-title">Cash Flow</div>
          <div className="chart-container">
            <div className="chart-title">YTD Cash Flow (£k)</div>
            <div className="chart-wrapper">
              <Bar
                data={{
                  labels: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                  datasets: [
                    {
                      label: 'Revenue',
                      data: [0, 5, 8, 12, 18, 22],
                      backgroundColor: '#0CA30C',
                    },
                    {
                      label: 'Burn',
                      data: [-115, -115, -115, -115, -115, -115],
                      backgroundColor: '#D03B3B',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { beginAtZero: true },
                  },
                }}
              />
            </div>
          </div>

          <div className="section-title">Unit Economics</div>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Gross Margin</div>
              <div className="metric-value">{(financials.grossMargin * 100).toFixed(0)}%</div>
              <div className="metric-subtext">Healthy SaaS range</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">CAC Payback</div>
              <div className="metric-value">8 mo</div>
              <div className="metric-subtext">Within acceptable range</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">LTV</div>
              <div className="metric-value">£72k</div>
              <div className="metric-subtext">LTV/CAC: 3.2x</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
