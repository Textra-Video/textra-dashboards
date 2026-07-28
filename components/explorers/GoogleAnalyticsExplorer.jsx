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
  const [lastUpdated, setLastUpdated] = useState(null);
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
        setLastUpdated(new Date().toLocaleString('en-GB'));
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

  // Get first non-"Not Set" location for card display
  const getTopLocationLabel = () => {
    const cities = b.cityBreakdown || [];
    if (!cities || cities.length === 0) return '—';
    // Find first non-"Not Set" location
    const validCity = cities.find(c => c && c.label && c.label.trim() !== '' && c.label !== '(not set)' && c.label.toLowerCase() !== 'not set');
    if (validCity) return validCity.label;
    // If all are "Not Set", show the one with most activity
    return cities[0]?.label || '—';
  };

  const primaryCards = [
    {
      key: 'totalUsers',
      icon: '👤',
      label: 'Users',
      value: s.totalUsers,
      tooltip: 'Distinct people who visited your site in the selected period.',
      drilldown: {
        title: '👤 Users',
        description: 'User breakdown and first-touch acquisition source for the selected period (real data from Google Analytics). Total should equal New + Returning.',
        rows: (() => {
          const total = s.totalUsers || 0;
          const newUsers = s.newUsers || 0;
          const returning = Math.max(0, total - newUsers);
          const calculated = newUsers + returning;
          const mismatch = total !== calculated && total > 0 && calculated > 0;
          return [
            {
              label: 'Total Users' + (mismatch ? ' ⚠️' : ''),
              value: total,
            },
            { label: 'New Users', value: newUsers },
            { label: 'Returning Users', value: returning },
            { label: 'Calculated Total (New + Returning)', value: calculated, tooltip: 'Should match Total Users above.' },
            ...rowsFromBreakdown(b.firstUserSourceMedium).map((r) => ({ label: `First touch: ${r.label}`, value: r.value, tooltip: 'Acquisition channel.' })),
          ];
        })(),
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
        description: 'Most-viewed pages in the selected period (real data from Google Analytics). Click any page to visit it.',
        rows: rowsFromBreakdown(b.topPages).length > 0
          ? (b.topPages || []).map((page) => ({
              label: page.label,
              value: page.value,
              link: page.label.startsWith('/') ? `https://www.textra.video${page.label}` : `https://www.textra.video/${page.label}`,
            }))
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
        description: 'Session engagement metrics for the selected period. Engagement Rate and Bounce Rate are inverses.',
        rows: [
          { label: 'Engagement Rate', value: s.engagementRate },
          { label: 'Bounce Rate (inverse)', value: s.bounceRate, tooltip: 'Sessions that left without engaging (opposite of above).' },
          { label: 'Engaged Sessions vs Total', value: s.totalSessions ? `${((parseFloat(s.engagementRate) / 100) * s.totalSessions).toFixed(0)} of ${s.totalSessions}` : '—', tooltip: 'Count of engaged vs total sessions.' },
          { label: 'Avg. Time in Engaged Sessions', value: s.averageSessionDuration, tooltip: 'Average session duration for engaged visitors.' },
          { label: 'Conversion Rate', value: s.totalSessions ? `${((s.conversions / s.totalSessions) * 100).toFixed(2)}%` : '—', tooltip: 'Sessions that converted.' },
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
          { label: 'Engagement Rate', value: s.engagementRate, tooltip: 'Opposite of bounce rate.' },
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
          { label: 'Conversion Rate', value: s.totalSessions ? `${((s.conversions / s.totalSessions) * 100).toFixed(2)}%` : '—', tooltip: 'Conversions as % of sessions.' },
        ],
      },
    },
    {
      key: 'eventCount',
      icon: '⚡',
      label: 'Events',
      value: s.eventCount,
      tooltip: 'Total tracked events (page views, clicks, scrolls, etc.) in the selected period.',
      drilldown: {
        title: '⚡ Events & Session Sources',
        description: 'Event volume and where sessions actually came from for the selected period (real data from Google Analytics).',
        rows: [
          { label: 'Total Events', value: s.eventCount },
          { label: 'Avg. Engagement Time per User', value: s.avgEngagementTimePerUser },
          ...rowsFromBreakdown(b.sessionSourceMedium),
        ],
      },
    },
    {
      key: 'topLocations',
      icon: '📍',
      label: 'Top Locations',
      value: getTopLocationLabel(),
      tooltip: 'City with the most active users in the selected period.',
      drilldown: {
        title: '📍 Top Locations',
        description: 'Active users by city for the selected period (real data from Google Analytics). "Not Set" indicates sessions where location data was unavailable (users blocked location, direct traffic, bot traffic, etc.).',
        rows: rowsFromBreakdown(b.cityBreakdown).length > 0
          ? rowsFromBreakdown(b.cityBreakdown)
          : [{ label: 'No location data available', value: '' }],
      },
    },
  ];

  const secondaryStats = [
    { key: 'averageSessionDuration', label: 'Avg. Session Duration', value: s.averageSessionDuration, tooltip: 'Average time spent per session in the selected period.' },
    { key: 'newUsers', label: 'New Users', value: s.newUsers, tooltip: 'First-time visitors in the selected period.' },
    { key: 'avgEngagementTimePerUser', label: 'Avg. Engagement / User', value: s.avgEngagementTimePerUser, tooltip: 'Average total time each user actively engaged with the site in the selected period.' },
  ];

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="section-title" style={{ margin: 0 }}>
            Google Analytics Explorer
            <a href="https://www.textra.video" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', fontSize: '14px', color: '#667eea', textDecoration: 'none', fontWeight: 'normal' }}>
              (www.textra.video)
            </a>
          </div>
          {lastUpdated && <p className="last-updated" style={{ margin: '4px 0 0 0' }}>Last updated: {lastUpdated}</p>}
        </div>
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
                  <tr key={i} style={{ cursor: row.link ? 'pointer' : 'default' }} onClick={() => row.link && window.open(row.link, '_blank')}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {row.label}
                      {row.tooltip && <InfoTooltip text={row.tooltip} />}
                    </td>
                    <td className="amount" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {row.value ?? '—'}
                      {row.link && <span style={{ fontSize: '12px', color: '#667eea' }}>↗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
