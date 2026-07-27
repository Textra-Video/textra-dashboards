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

export default function ClarityExplorer({ onMetricSelect }) {
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
      const response = await axios.get('/api/data/clarity-explorer', { params });
      if (response.data.success) {
        setData(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch Clarity data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="loading">Fetching data...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="error">No data available</div>;
  }

  const s = data.summary || {};
  const b = data.breakdowns || {};

  const primaryCards = [
    {
      key: 'totalSessions',
      icon: '📈',
      label: 'Sessions',
      value: s.totalSessions,
      tooltip: 'Total visits to your site in the selected period.',
      drilldown: {
        title: '📈 Sessions by Device',
        description: 'Device breakdown for the selected period (real data from Google Analytics).',
        rows: (b.deviceBreakdown || []).length > 0
          ? b.deviceBreakdown.map((d) => ({ label: d.label, value: d.value }))
          : [{ label: 'No device data available', value: '' }],
      },
    },
    {
      key: 'uniqueUsers',
      icon: '👤',
      label: 'Unique Users',
      value: s.uniqueUsers,
      tooltip: 'Distinct people who visited in the selected period.',
      drilldown: {
        title: '👤 Unique Users',
        description: 'Users vs. sessions for the selected period.',
        rows: [
          { label: 'Unique Users', value: s.uniqueUsers },
          { label: 'Total Sessions', value: s.totalSessions },
          { label: 'Sessions per User', value: s.uniqueUsers ? (s.totalSessions / s.uniqueUsers).toFixed(2) : '—' },
        ],
      },
    },
    {
      key: 'bounceRate',
      icon: '🚪',
      label: 'Bounce Rate',
      value: s.bounceRate,
      tooltip: 'Percentage of sessions with no meaningful engagement.',
      drilldown: {
        title: '🚪 Bounce Rate',
        description: 'Bounce rate context for the selected period.',
        rows: [
          { label: 'Bounce Rate', value: s.bounceRate },
          { label: 'Pages per Session', value: s.pagesPerSession },
          { label: 'Avg. Session Length', value: s.avgSessionLength },
        ],
      },
    },
    {
      key: 'avgSessionLength',
      icon: '⏱️',
      label: 'Avg. Session Length',
      value: s.avgSessionLength,
      tooltip: 'Average time spent per session in the selected period.',
      drilldown: {
        title: '⏱️ Session Length',
        description: 'Session duration context for the selected period.',
        rows: [
          { label: 'Avg. Session Length', value: s.avgSessionLength },
          { label: 'Pages per Session', value: s.pagesPerSession },
        ],
      },
    },
  ];

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="section-title" style={{ margin: 0 }}>Microsoft Clarity</div>
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

      <div style={{ background: '#fff8e6', border: '1px solid #f0dca0', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#7a5c00' }}>
        ⚠️ <strong>This is not real Microsoft Clarity data.</strong> {data.dataSource || 'No genuine Clarity API/export integration exists yet'} —
        the numbers below are general website analytics (sessions, users, bounce rate) sourced from Google Analytics, standing in for Clarity.
        Actual Clarity-only features (heatmaps, rage clicks, session recordings) are not connected.
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
          ⚠️ Not available (needs a real Microsoft Clarity integration, not achievable via Google Analytics): {data.unavailable.join(', ')}
        </div>
      )}
    </div>
  );
}
