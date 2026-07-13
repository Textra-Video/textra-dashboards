import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function SalesDashboard({ zohoAccessToken, user }) {
  const [deals, setDeals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDeals = async () => {
    if (!zohoAccessToken) {
      setError('Not authenticated with Zoho');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/data/zoho-deals', {
        accessToken: zohoAccessToken,
      });

      if (response.data.success) {
        setDeals(response.data.data);
        setLastUpdated(new Date().toLocaleTimeString('en-GB'));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch deals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zohoAccessToken) {
      fetchDeals();
    }
  }, [zohoAccessToken]);

  if (!zohoAccessToken) {
    return (
      <div className="dashboard-content">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Please authenticate with Zoho CRM to view sales data</p>
          <button
            onClick={() => {
              const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=ZohoCRM.modules.READ&client_id=${process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI)}`;
              window.location.href = authUrl;
            }}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#273572',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              marginTop: '1rem',
            }}
          >
            Connect Zoho CRM
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      <div className="section-title">Sales Pipeline & Revenue</div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          {lastUpdated && <p style={{ fontSize: '12px', color: '#999' }}>Last updated: {lastUpdated}</p>}
        </div>
        <button
          onClick={fetchDeals}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            background: '#4da89a',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {error && <p style={{ color: '#D03B3B', marginBottom: '1rem' }}>Error: {error}</p>}

      {deals && (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Total Pipeline</div>
              <div className="metric-value">£{(deals.totalPipeline / 1000).toFixed(0)}k</div>
              <div className="metric-subtext">
                Est. conversion: £{(deals.totalPipeline * 0.2 / 1000).toFixed(0)}k
              </div>
            </div>
            <div className="metric-card success">
              <div className="metric-label">Deal Count</div>
              <div className="metric-value">{deals.deals.length}</div>
              <div className="metric-subtext">Active opportunities</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg Deal Size</div>
              <div className="metric-value">
                £{(deals.totalPipeline / deals.deals.length / 1000).toFixed(0)}k
              </div>
              <div className="metric-subtext">Across all stages</div>
            </div>
          </div>

          <div className="section-title">Pipeline by Stage</div>
          <div className="chart-container">
            <div className="chart-title">Deal Flow — Prospect → Won (£k)</div>
            <div className="chart-wrapper">
              <Bar
                data={{
                  labels: Object.keys(deals.byStage),
                  datasets: [
                    {
                      label: 'Pipeline Value',
                      data: Object.values(deals.byStage).map((v) => v / 1000),
                      backgroundColor: '#273572',
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    y: { beginAtZero: true },
                  },
                }}
              />
            </div>
          </div>

          <div className="section-title">Pipeline by Deal Size</div>
          <div className="chart-container">
            <div className="chart-title">Value Distribution</div>
            <div className="chart-wrapper">
              <Doughnut
                data={{
                  labels: ['Micro (<£10k)', 'SME (£10-50k)', 'Enterprise (>£50k)'],
                  datasets: [
                    {
                      data: [
                        deals.bySize.micro / 1000,
                        deals.bySize.sme / 1000,
                        deals.bySize.enterprise / 1000,
                      ],
                      backgroundColor: ['#4da89a', '#273572', '#1A71B1'],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </div>
          </div>

          {deals.stuckDeals.length > 0 && (
            <>
              <div className="section-title">Alerts</div>
              <div className="metric-grid">
                <div className="metric-card alert">
                  <div className="metric-label">⚠ Deals {`>`}60 Days in Stage</div>
                  <div className="metric-value">{deals.stuckDeals.length}</div>
                  <div className="metric-subtext">
                    {deals.stuckDeals.map((d) => d.name).join(', ')}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
