import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import { refreshZohoToken } from '../lib/tokenUtils';
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

function fmtK(value) {
  return `£${(value / 1000).toFixed(0)}k`;
}

export default function SalesDashboard({ zohoAccessToken, zohoApiDomain, zohoRefreshToken, onAuthExpired, user }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');

  const fetchDeals = async (tokenOverride, domainOverride, isRetry = false) => {
    const token = tokenOverride || zohoAccessToken;
    const domain = domainOverride || zohoApiDomain;

    if (!token) {
      setError('Not authenticated with Zoho');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/data/zoho-deals', {
        accessToken: token,
        apiDomain: domain,
      });

      if (response.data.success) {
        setData(response.data.data);
        setLastUpdated(new Date().toLocaleTimeString('en-GB'));
      }
    } catch (err) {
      // Access token expired (Zoho tokens last ~1hr) - silently renew with
      // the refresh token and retry once, instead of forcing a reconnect.
      if (err.response?.status === 401 && !isRetry) {
        if (zohoRefreshToken) {
          try {
            const { accessToken: newToken, apiDomain: newDomain } = await refreshZohoToken(zohoRefreshToken);
            await fetchDeals(newToken, newDomain, true);
            return;
          } catch (refreshErr) {
            // Refresh token itself is dead (revoked, or predates this
            // feature) - clear everything so the Connect button reappears
            // instead of getting stuck retrying a token that can never work.
            onAuthExpired?.();
            setError('Your Zoho session expired. Click "Connect Zoho CRM" to reconnect.');
            setLoading(false);
            return;
          }
        }
        onAuthExpired?.();
        setError('Your Zoho session expired. Click "Connect Zoho CRM" to reconnect.');
        setLoading(false);
        return;
      }
      const errorMsg = err.response?.data?.details || err.response?.data?.error || 'Failed to fetch deals';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (zohoAccessToken) {
      fetchDeals();
    }
  }, [zohoAccessToken]);

  const matchingClients = useMemo(() => {
    if (!data || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    return data.clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [data, search]);

  const goToClient = (name) => {
    if (!name) return;
    router.push(`/dashboards/clients/${encodeURIComponent(name)}`);
  };

  if (!zohoAccessToken) {
    return (
      <div className="dashboard-content">
        {error && <div className="error">{error}</div>}
        <div className="connect-prompt">
          <p>Please authenticate with Zoho CRM to view sales data</p>
          <button
            className="connect-button"
            onClick={() => {
              // Textra's Zoho account is on the EU datacenter (crmplus.zoho.eu) -
              // auth codes issued here are only redeemable at accounts.zoho.eu.
              const authUrl = `https://accounts.zoho.eu/oauth/v2/auth?scope=ZohoCRM.modules.READ,ZohoCRM.settings.READ&client_id=${process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI)}&prompt=consent`;
              window.location.href = authUrl;
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

      <div className="dashboard-toolbar">
        <div>
          {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}
        </div>
        <button className="refresh-button" onClick={() => fetchDeals()} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {error && <div className="error">Error: {error}</div>}

      {data && (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Total Pipeline</div>
              <div className="metric-value">{fmtK(data.totalPipeline)}</div>
              <div className="metric-subtext">Est. conversion (20%): {fmtK(data.totalPipeline * 0.2)}</div>
            </div>
            <div className="metric-card success">
              <div className="metric-label">Confirmed Bookings</div>
              <div className="metric-value">{fmtK(data.confirmedBookings)}</div>
              <div className="metric-subtext">All-time, Closed Won</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">This Month Close</div>
              <div className="metric-value">{fmtK(data.thisMonthClose)}</div>
              <div className="metric-subtext">Forecast to close this month</div>
            </div>
            <div className="metric-card success">
              <div className="metric-label">Monthly Run Rate</div>
              <div className="metric-value">{fmtK(data.monthlyRunRate)}</div>
              <div className="metric-subtext">Closed Won this month</div>
            </div>
          </div>

          <div className="section-title">Find a Client</div>
          <div className="chart-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search by client name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.trim() && (
              <div className="search-results">
                {matchingClients.length === 0 && (
                  <div className="search-empty">No clients match &quot;{search}&quot;</div>
                )}
                {matchingClients.map((c) => (
                  <div
                    key={c.name}
                    className="search-result-row"
                    onClick={() => goToClient(c.name)}
                    title={`${c.dealCount} deal${c.dealCount !== 1 ? 's' : ''} · Total ${fmtK(c.totalValue)} · Open ${fmtK(c.openValue)}`}
                  >
                    <span className="search-result-name">{c.name}</span>
                    <span className="search-result-meta">
                      {c.dealCount} deal{c.dealCount !== 1 ? 's' : ''} · {fmtK(c.totalValue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section-title">Pipeline by Stage</div>
          <div className="chart-container">
            <div className="chart-title">Deal Flow — Full Funnel (£k)</div>
            <div className="chart-wrapper">
              <Bar
                data={{
                  labels: Object.keys(data.byStage),
                  datasets: [
                    {
                      label: 'Pipeline Value',
                      data: Object.values(data.byStage).map((v) => v / 1000),
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
            <div className="chart-title">Open Pipeline Value Distribution</div>
            <div className="chart-wrapper">
              <Doughnut
                data={{
                  labels: ['Micro (<£10k)', 'SME (£10-50k)', 'Enterprise (>£50k)'],
                  datasets: [
                    {
                      data: [
                        data.bySize.micro / 1000,
                        data.bySize.sme / 1000,
                        data.bySize.enterprise / 1000,
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

          {data.stuckDeals.length > 0 && (
            <>
              <div className="section-title">Alerts</div>
              <div className="chart-container">
                <div className="chart-title">⚠ Deals {'>'}60 Days Overdue ({data.stuckDeals.length})</div>
                <div className="deal-chip-list">
                  {data.stuckDeals.map((d) => (
                    <button
                      key={d.id}
                      className="deal-chip alert"
                      onClick={() => goToClient(d.account)}
                      title={`Owner: ${d.owner} · Value: ${fmtK(d.value)} · Probability: ${d.probability}%`}
                    >
                      <span className="deal-chip-name">{d.name}</span>
                      <span className="deal-chip-meta">{d.stage}: {d.daysOverdue}d</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
