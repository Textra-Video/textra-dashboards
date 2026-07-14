import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
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

const ZOHO_AUTH_URL = `https://accounts.zoho.eu/oauth/v2/auth?scope=ZohoCRM.modules.READ,ZohoCRM.settings.READ&client_id=${process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI)}&access_type=offline&prompt=consent`;

const EMPTY_FILTERS = { stage: '', owner: '', source: '', dateFrom: '', dateTo: '' };

export default function SalesDashboard({ user }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notConnected, setNotConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Zoho auth is now a single shared, server-side connection (Redis) - no
  // token to pass, the API figures out who's connected and auto-refreshes.
  const fetchDeals = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post('/api/data/zoho-deals');
      if (response.data.success) {
        setData(response.data.data);
        setNotConnected(false);
        setLastUpdated(new Date().toLocaleTimeString('en-GB'));
      }
    } catch (err) {
      if (err.response?.data?.error === 'not_connected') {
        setNotConnected(true);
      } else {
        const errorMsg = err.response?.data?.details || err.response?.data?.error || 'Failed to fetch deals';
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const matchingClients = useMemo(() => {
    if (!data || !search.trim()) return [];
    const q = search.trim().toLowerCase();
    return data.clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [data, search]);

  const filterOptions = useMemo(() => {
    if (!data) return { stages: [], owners: [], sources: [] };
    return {
      stages: [...new Set(data.deals.map((d) => d.stage))].sort(),
      owners: [...new Set(data.deals.map((d) => d.owner))].sort(),
      sources: [...new Set(data.deals.map((d) => d.leadSource))].sort(),
    };
  }, [data]);

  const filteredDeals = useMemo(() => {
    if (!data) return [];
    return data.deals.filter((d) => {
      if (filters.stage && d.stage !== filters.stage) return false;
      if (filters.owner && d.owner !== filters.owner) return false;
      if (filters.source && d.leadSource !== filters.source) return false;
      if (filters.dateFrom && (!d.closeDate || new Date(d.closeDate) < new Date(filters.dateFrom))) return false;
      if (filters.dateTo && (!d.closeDate || new Date(d.closeDate) > new Date(filters.dateTo))) return false;
      return true;
    });
  }, [data, filters]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const goToClient = (name) => {
    if (!name) return;
    router.push(`/dashboards/clients/${encodeURIComponent(name)}`);
  };

  if (notConnected) {
    return (
      <div className="dashboard-content">
        <div className="connect-prompt">
          <p>Please authenticate with Zoho CRM to view sales data</p>
          <button
            className="connect-button"
            onClick={() => {
              window.location.href = ZOHO_AUTH_URL;
            }}
          >
            Connect Zoho CRM
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="dashboard-content">
        <div className="loading">Loading sales data...</div>
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
        <button className="refresh-button" onClick={fetchDeals} disabled={loading}>
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
              <div className="metric-subtext">Weighted forecast: {fmtK(data.weightedForecast)}</div>
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
            <div className="metric-card">
              <div className="metric-label">Avg Sales Cycle</div>
              <div className="metric-value">{data.avgSalesCycle !== null ? `${data.avgSalesCycle}d` : '—'}</div>
              <div className="metric-subtext">Based on Closed Won deals</div>
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

          <div className="section-title">Pipeline by Source</div>
          <div className="chart-container">
            <div className="chart-title">Open Pipeline Value by Lead Source (£k)</div>
            <div className="chart-wrapper">
              <Bar
                data={{
                  labels: Object.keys(data.bySource),
                  datasets: [
                    {
                      label: 'Pipeline Value',
                      data: Object.values(data.bySource).map((v) => v / 1000),
                      backgroundColor: '#1A71B1',
                      borderRadius: 6,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true } },
                }}
              />
            </div>
          </div>

          {Object.keys(data.lossReasons).length > 0 && (
            <>
              <div className="section-title">Why We Lose</div>
              <div className="chart-container">
                <div className="chart-title">Closed Lost Deals by Reason ({Object.values(data.lossReasons).reduce((a, b) => a + b, 0)})</div>
                <div className="chart-wrapper">
                  <Doughnut
                    data={{
                      labels: Object.keys(data.lossReasons),
                      datasets: [
                        {
                          data: Object.values(data.lossReasons),
                          backgroundColor: ['#d03b3b', '#b03434', '#e07a5f', '#f2a65a', '#273572', '#1A71B1', '#66bcad'],
                        },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              </div>
            </>
          )}

          <div className="section-title">Browse Deals</div>
          <div className="chart-container">
            <div className="filters-bar">
              <select
                className="filter-select"
                value={filters.stage}
                onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
              >
                <option value="">All Stages</option>
                {filterOptions.stages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                className="filter-select"
                value={filters.owner}
                onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
              >
                <option value="">All Owners</option>
                {filterOptions.owners.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <select
                className="filter-select"
                value={filters.source}
                onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
              >
                <option value="">All Sources</option>
                {filterOptions.sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="date"
                className="filter-select"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                title="Close date from"
              />
              <input
                type="date"
                className="filter-select"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                title="Close date to"
              />
              <select className="filter-select" disabled title="Add a Category field in Zoho CRM to enable this filter">
                <option>Category (coming soon)</option>
              </select>
              {hasActiveFilters && (
                <button className="filter-reset" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Reset
                </button>
              )}
            </div>

            <p className="last-updated" style={{ margin: '14px 0' }}>
              {filteredDeals.length} of {data.deals.length} deals
            </p>

            <div className="deal-list">
              {filteredDeals.map((d) => (
                <div key={d.id} className="deal-list-row deal-list-row-clickable" onClick={() => goToClient(d.account)}>
                  <div className="deal-list-main">
                    <span className="deal-list-name">{d.name} — {d.account}</span>
                    <span className={`deal-list-stage ${d.isWon ? 'won' : ''}`}>{d.stage}</span>
                  </div>
                  <div className="deal-list-meta">
                    <span>{fmtK(d.value)}</span>
                    <span>Owner: {d.owner}</span>
                    <span>Source: {d.leadSource}</span>
                    {d.closeDate && <span>Close: {new Date(d.closeDate).toLocaleDateString('en-GB')}</span>}
                  </div>
                </div>
              ))}
              {filteredDeals.length === 0 && <p className="last-updated">No deals match these filters.</p>}
            </div>
          </div>

          {(data.stuckDeals.length > 0 || data.staleDeals.length > 0) && (
            <>
              <div className="section-title">Alerts</div>

              {data.stuckDeals.length > 0 && (
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
              )}

              {data.staleDeals.length > 0 && (
                <div className="chart-container">
                  <div className="chart-title">⚠ No Activity in 30+ Days ({data.staleDeals.length})</div>
                  <div className="deal-chip-list">
                    {data.staleDeals.map((d) => (
                      <button
                        key={d.id}
                        className="deal-chip alert"
                        onClick={() => goToClient(d.account)}
                        title={`Owner: ${d.owner} · Value: ${fmtK(d.value)} · Stage: ${d.stage}`}
                      >
                        <span className="deal-chip-name">{d.name}</span>
                        <span className="deal-chip-meta">
                          {d.daysSinceActivity !== null ? `${d.daysSinceActivity}d since activity` : 'No activity recorded'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
