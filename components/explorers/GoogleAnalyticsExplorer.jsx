import React, { useState, useEffect } from 'react';
import axios from 'axios';

function InfoTooltip({ text }) {
  return (
    <span className="info-tooltip" tabIndex={0}>
      <span className="info-icon">i</span>
      <span className="info-tooltip-text">{text}</span>
    </span>
  );
}

export default function GoogleAnalyticsExplorer({ onMetricSelect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [dateRange, setDateRange] = useState('last-30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getDateRangeParams = () => {
    const today = new Date();
    let startDate, endDate = today;

    if (dateRange === 'last-year') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 365);
    } else if (dateRange === 'last-90') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 90);
    } else if (dateRange === 'last-30') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);
    } else if (dateRange === 'custom') {
      startDate = customStart ? new Date(customStart) : null;
      endDate = customEnd ? new Date(customEnd) : null;
    }

    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : undefined;

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, customStart, customEnd]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = getDateRangeParams();
      const response = await axios.get('/api/data/google-analytics-explorer', { params });
      if (response.data.success) {
        setData(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch Google Analytics data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="loading">Fetching Google Analytics data...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          To connect Google Analytics, you'll need to:
          1. Create a service account in Google Cloud Console
          2. Enable the Google Analytics Data API
          3. Set the credentials in your environment variables
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="error">No data available</div>;
  }

  const s = data.summary || {};
  const b = data.breakdowns || {};

  const rowsFromBreakdown = (items) =>
    (items || []).map((item) => ({ label: item.label, value: item.value }));

  const primaryCards = [
    {
      key: 'totalUsers',
      icon: '👤',
      label: 'Users',
      value: s.totalUsers,
      tooltip: 'Distinct people who visited your site in the selected period.',
      drilldown: {
        title: '👤 Users',
        description: 'User breakdown for the selected period.',
        rows: [
          { label: 'Total Users', value: s.totalUsers },
          { label: 'New Users', value: s.newUsers },
          { label: 'Returning Users', value: s.totalUsers - s.newUsers >= 0 ? s.totalUsers - s.newUsers : '—' },
        ],
      },
    },
    {
      key: 'totalSessions',
      icon: '📈',
      label: 'Sessions',
      value: s.totalSessions,
      tooltip: 'Total visits to your site in the selected period (a user can have multiple sessions).',
      drilldown: {
        title: '📈 Sessions by Channel',
        description: 'Where your sessions came from in the selected period (real data from Google Analytics).',
        rows: rowsFromBreakdown(b.channelBreakdown).length > 0
          ? rowsFromBreakdown(b.channelBreakdown)
          : [{ label: 'No channel data available', value: '' }],
      },
    },
    {
      key: 'pageViews',
      icon: '📄',
      label: 'Page Views',
      value: s.pageViews,
      tooltip: 'Total pages viewed in the selected period (includes repeat views of the same page).',
      drilldown: {
        title: '📄 Top Pages',
        description: 'Most-viewed pages in the selected period (real data from Google Analytics).',
        rows: rowsFromBreakdown(b.topPages).length > 0
          ? rowsFromBreakdown(b.topPages)
          : [{ label: 'No page data available', value: '' }],
      },
    },
    {
      key: 'engagementRate',
      icon: '🔥',
      label: 'Engagement Rate',
      value: s.engagementRate,
      tooltip: 'Percentage of sessions that lasted 10+ seconds, had a conversion event, or viewed 2+ pages.',
      drilldown: {
        title: '🔥 Engagement Rate',
        description: 'Engagement vs. bounce for the selected period.',
        rows: [
          { label: 'Engagement Rate', value: s.engagementRate },
          { label: 'Bounce Rate', value: s.bounceRate },
          { label: 'Avg. Session Duration', value: s.averageSessionDuration },
        ],
      },
    },
    {
      key: 'bounceRate',
      icon: '🚪',
      label: 'Bounce Rate',
      value: s.bounceRate,
      tooltip: 'Percentage of sessions that were NOT engaged (opposite of Engagement Rate).',
      drilldown: {
        title: '🚪 Bounce Rate',
        description: 'Bounce vs. engagement for the selected period.',
        rows: [
          { label: 'Bounce Rate', value: s.bounceRate },
          { label: 'Engagement Rate', value: s.engagementRate },
        ],
      },
    },
    {
      key: 'conversions',
      icon: '🎯',
      label: 'Conversions',
      value: s.conversions,
      tooltip: 'Total conversion events recorded in the selected period (as configured in your GA4 property).',
      drilldown: {
        title: '🎯 Conversions',
        description: 'Conversions relative to total sessions for the selected period.',
        rows: [
          { label: 'Conversions', value: s.conversions },
          { label: 'Total Sessions', value: s.totalSessions },
          { label: 'Conversion Rate', value: s.totalSessions ? `${((s.conversions / s.totalSessions) * 100).toFixed(2)}%` : '—' },
        ],
      },
    },
  ];

  const secondaryStats = [
    { key: 'averageSessionDuration', label: 'Avg. Session Duration', value: s.averageSessionDuration, tooltip: 'Average time spent per session in the selected period.' },
    { key: 'newUsers', label: 'New Users', value: s.newUsers, tooltip: 'First-time visitors in the selected period.' },
  ];

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="section-title" style={{ margin: 0 }}>Google Analytics Explorer</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '14px' }}
          >
            <option value="last-30">Last 30 Days</option>
            <option value="last-90">Last 90 Days</option>
            <option value="last-year">Last 12 Months</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', fontSize: '14px' }} />
              <span style={{ color: 'var(--muted)' }}>to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', fontSize: '14px' }} />
            </>
          )}
          <button className="refresh-button" onClick={fetchData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {data.dateRange && (
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px 0' }}>
          Showing data from {data.dateRange.startDate} to {data.dateRange.endDate} - click any card below for more detail.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {primaryCards.map((card) => (
          <button
            key={card.key}
            className="metric-card metric-card-clickable"
            style={{ padding: '18px 16px', minHeight: '120px' }}
            onClick={() => setDrilldown(card.drilldown)}
          >
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.9, lineHeight: 1.3 }}>
              <span>{card.icon}</span>
              <span>{card.label}</span>
              <InfoTooltip text={card.tooltip} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 'bold', marginTop: 'auto' }}>{card.value ?? '—'}</div>
          </button>
        ))}
      </div>

      <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', padding: '16px', marginBottom: '24px', background: '#fafafa' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '12px' }}>
          Additional Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          {secondaryStats.map((stat) => (
            <div key={stat.key} style={{ background: '#fff', border: '1px solid #eee', padding: '12px 14px', borderRadius: '6px' }}>
              <div style={{ fontSize: '17px', fontWeight: 600, color: '#333' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {stat.label}
                <InfoTooltip text={stat.tooltip} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {drilldown && (
        <div className="modal-overlay" onClick={() => setDrilldown(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDrilldown(null)}>✕</button>
            <h2>{drilldown.title}</h2>
            <p className="modal-description">{drilldown.description}</p>
            <table className="drilldown-table">
              <tbody>
                {drilldown.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.label}</td>
                    <td className="amount">{row.value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.unavailable?.length > 0 && (
        <div style={{ marginTop: '8px', padding: '12px', background: '#fff8e6', borderRadius: '4px', fontSize: '12px', color: '#8a6d1a' }}>
          ⚠️ Not available with this property's current setup: {data.unavailable.join(', ')}
        </div>
      )}
    </div>
  );
}
