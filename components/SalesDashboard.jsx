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

function isSameMonth(dateStr, now) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip" tabIndex={0}>
      <span className="info-icon">i</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  );
}

const ZOHO_AUTH_URL = `https://accounts.zoho.eu/oauth/v2/auth?scope=ZohoCRM.modules.READ,ZohoCRM.settings.READ&client_id=${process.env.NEXT_PUBLIC_ZOHO_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.NEXT_PUBLIC_ZOHO_REDIRECT_URI)}&access_type=offline&prompt=consent`;

const EMPTY_FILTERS = { stage: '', owner: '', source: '', dateFrom: '', dateTo: '' };

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'clients', label: 'Find a Client' },
  { id: 'byStage', label: 'Pipeline by Stage' },
  { id: 'bySize', label: 'Pipeline by Deal Size' },
  { id: 'bySource', label: 'Pipeline by Source' },
  { id: 'lossReasons', label: 'Why We Lose' },
  { id: 'browse', label: 'Browse Deals' },
  { id: 'alerts', label: 'Alerts' },
];

const METRIC_INFO = {
  pipeline: {
    title: 'Total Pipeline — Open Deals',
    description: 'Sum of every open deal (not yet Closed Won or Closed Lost) currently in Zoho CRM.',
  },
  bookings: {
    title: 'Confirmed Bookings — Closed Won',
    description: 'Sum of every deal marked Closed Won in Zoho, all-time - no date cutoff applied.',
  },
  thisMonth: {
    title: 'This Month Close — Forecast',
    description: 'Sum of open deals whose expected close date falls in the current calendar month. A forecast, not yet confirmed revenue.',
  },
  runRate: {
    title: 'Monthly Run Rate — Closed Won This Month',
    description: 'Sum of deals marked Closed Won with a close date in the current calendar month.',
  },
  salesCycle: {
    title: 'Avg Sales Cycle — Closed Won Deals',
    description: 'Average of Zoho’s Sales Cycle Duration field (days from deal creation to close) across Closed Won deals that have a recorded value.',
  },
};

export default function SalesDashboard({ user }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notConnected, setNotConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activeSection, setActiveSection] = useState('overview');
  const [activeMetric, setActiveMetric] = useState(null);

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

  const metricDeals = useMemo(() => {
    if (!data) return {};
    const now = new Date();
    return {
      pipeline: data.deals.filter((d) => d.isOpen),
      bookings: data.deals.filter((d) => d.isWon),
      thisMonth: data.deals.filter((d) => d.isOpen && isSameMonth(d.closeDate, now)),
      runRate: data.deals.filter((d) => d.isWon && isSameMonth(d.closeDate, now)),
      salesCycle: data.deals.filter((d) => d.isWon && d.salesCycleDuration !== null),
    };
  }, [data]);

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
        <div className="sales-layout">
          <nav className="sales-sidebar">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`sales-sidebar-link ${activeSection === s.id ? 'active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="sales-content">
            {activeSection === 'overview' && (
              <div className="metric-grid">
                <button className="metric-card metric-card-clickable" onClick={() => setActiveMetric('pipeline')}>
                  <div className="metric-label">
                    Total Pipeline
                    <InfoTooltip text={METRIC_INFO.pipeline.description} />
                  </div>
                  <div className="metric-value">{fmtK(data.totalPipeline)}</div>
                  <div className="metric-subtext">Weighted forecast: {fmtK(data.weightedForecast)}</div>
                </button>
                <button className="metric-card metric-card-clickable success" onClick={() => setActiveMetric('bookings')}>
                  <div className="metric-label">
                    Confirmed Bookings
                    <InfoTooltip text={METRIC_INFO.bookings.description} />
                  </div>
                  <div className="metric-value">{fmtK(data.confirmedBookings)}</div>
                  <div className="metric-subtext">All-time, Closed Won</div>
                </button>
                <button className="metric-card metric-card-clickable" onClick={() => setActiveMetric('thisMonth')}>
                  <div className="metric-label">
                    This Month Close
                    <InfoTooltip text={METRIC_INFO.thisMonth.description} />
                  </div>
                  <div className="metric-value">{fmtK(data.thisMonthClose)}</div>
                  <div className="metric-subtext">Forecast to close this month</div>
                </button>
                <button className="metric-card metric-card-clickable success" onClick={() => setActiveMetric('runRate')}>
                  <div className="metric-label">
                    Monthly Run Rate
                    <InfoTooltip text={METRIC_INFO.runRate.description} />
                  </div>
                  <div className="metric-value">{fmtK(data.monthlyRunRate)}</div>
                  <div className="metric-subtext">Closed Won this month</div>
                </button>
                <button className="metric-card metric-card-clickable" onClick={() => setActiveMetric('salesCycle')}>
                  <div className="metric-label">
                    Avg Sales Cycle
                    <InfoTooltip text={METRIC_INFO.salesCycle.description} />
                  </div>
                  <div className="metric-value">{data.avgSalesCycle !== null ? `${data.avgSalesCycle}d` : '—'}</div>
                  <div className="metric-subtext">Based on Closed Won deals</div>
                </button>
              </div>
            )}

            {activeSection === 'clients' && (
              <div className="chart-container">
                <div className="chart-title">
                  Find a Client
                  <InfoTooltip text="Search by Zoho Account Name. Click a result to see every deal tied to that client." />
                </div>
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
            )}

            {activeSection === 'byStage' && (
              <div className="chart-container">
                <div className="chart-title">
                  Deal Flow — Full Funnel (£k)
                  <InfoTooltip text="Total value of all deals at each Zoho pipeline stage, including Closed Won/Lost for context on the full funnel." />
                </div>
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
                      scales: { y: { beginAtZero: true } },
                    }}
                  />
                </div>
              </div>
            )}

            {activeSection === 'bySize' && (
              <div className="chart-container">
                <div className="chart-title">
                  Open Pipeline Value Distribution
                  <InfoTooltip text="Open pipeline deals split into Micro (<£10k), SME (£10k-50k) and Enterprise (>£50k) buckets by deal value." />
                </div>
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
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              </div>
            )}

            {activeSection === 'bySource' && (
              <div className="chart-container">
                <div className="chart-title">
                  Open Pipeline Value by Lead Source (£k)
                  <InfoTooltip text="Open pipeline value grouped by Zoho's Lead Source field - which channels are generating live pipeline right now." />
                </div>
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
            )}

            {activeSection === 'lossReasons' && (
              <div className="chart-container">
                <div className="chart-title">
                  Closed Lost Deals by Reason ({Object.values(data.lossReasons).reduce((a, b) => a + b, 0)})
                  <InfoTooltip text="Count of Closed Lost deals grouped by Zoho's Reason for Loss field." />
                </div>
                {Object.keys(data.lossReasons).length > 0 ? (
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
                ) : (
                  <p className="last-updated">No Closed Lost deals recorded.</p>
                )}
              </div>
            )}

            {activeSection === 'browse' && (
              <div className="chart-container">
                <div className="chart-title">
                  Browse Deals
                  <InfoTooltip text="Filter every deal by stage, owner, source, or close-date range. Click any row to open that client's page." />
                </div>
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
            )}

            {activeSection === 'alerts' && (
              <>
                {data.stuckDeals.length === 0 && data.staleDeals.length === 0 && (
                  <div className="chart-container">
                    <p className="last-updated">No alerts right now - nothing overdue, everything has recent activity.</p>
                  </div>
                )}

                {data.stuckDeals.length > 0 && (
                  <div className="chart-container">
                    <div className="chart-title">
                      ⚠ Deals {'>'}60 Days Overdue ({data.stuckDeals.length})
                      <InfoTooltip text="Open deals whose expected close date has passed by more than 60 days." />
                    </div>
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
                    <div className="chart-title">
                      ⚠ No Activity in 30+ Days ({data.staleDeals.length})
                      <InfoTooltip text="Open deals with no recorded activity in the last 30+ days, or none ever recorded - a stronger signal than an overdue close date." />
                    </div>
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
          </div>
        </div>
      )}

      {activeMetric && data && (
        <div className="modal-overlay" onClick={() => setActiveMetric(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{METRIC_INFO[activeMetric].title}</h3>
              <button className="modal-close" onClick={() => setActiveMetric(null)}>&times;</button>
            </div>
            <p className="modal-description">{METRIC_INFO[activeMetric].description}</p>
            <p className="last-updated" style={{ marginBottom: '12px' }}>{metricDeals[activeMetric].length} deals</p>
            <div className="deal-list">
              {metricDeals[activeMetric].map((d) => (
                <div key={d.id} className="deal-list-row deal-list-row-clickable" onClick={() => goToClient(d.account)}>
                  <div className="deal-list-main">
                    <span className="deal-list-name">{d.name} — {d.account}</span>
                    <span className={`deal-list-stage ${d.isWon ? 'won' : ''}`}>{d.stage}</span>
                  </div>
                  <div className="deal-list-meta">
                    <span>{fmtK(d.value)}</span>
                    <span>Owner: {d.owner}</span>
                    {activeMetric === 'pipeline' && <span>Weighted: {fmtK(d.expectedRevenue)}</span>}
                    {activeMetric === 'salesCycle' && <span>{d.salesCycleDuration} days</span>}
                    {d.closeDate && <span>Close: {new Date(d.closeDate).toLocaleDateString('en-GB')}</span>}
                  </div>
                </div>
              ))}
              {metricDeals[activeMetric].length === 0 && <p className="last-updated">No deals in this bucket.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
