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
  const [lastUpdated, setLastUpdated] = useState(null);
  const [numOfDays, setNumOfDays] = useState('3');

  useEffect(() => {
    fetchData();
  }, [numOfDays]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/data/clarity-explorer', { params: { numOfDays } });
      if (response.data.success) {
        setData(response.data);
        setLastUpdated(new Date().toLocaleString('en-GB'));
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
      tooltip: 'Total sessions recorded by Clarity in the selected window.',
      drilldown: {
        title: '📈 Sessions by Device',
        description: 'Device breakdown for the selected window (real Clarity data).',
        rows: (b.deviceBreakdown || []).length > 0
          ? b.deviceBreakdown.map((d) => ({ label: d.label, value: d.value }))
          : [{ label: 'No device data available', value: '' }],
      },
    },
    {
      key: 'distinctUsers',
      icon: '👤',
      label: 'Distinct Users',
      value: s.distinctUsers,
      tooltip: 'Distinct visitors recorded by Clarity in the selected window.',
      drilldown: {
        title: '👤 Distinct Users',
        description: 'Users vs. sessions and bot traffic for the selected window.',
        rows: [
          { label: 'Distinct Users', value: s.distinctUsers },
          { label: 'Total Sessions', value: s.totalSessions },
          { label: 'Bot Sessions', value: s.botSessions },
        ],
      },
    },
    {
      key: 'totalRageClicks',
      icon: '😤',
      label: 'Rage Clicks',
      value: s.totalRageClicks,
      tooltip: 'Sessions with rapid repeated clicking on the same element - a frustration signal Clarity detects.',
      drilldown: {
        title: '😤 Rage Clicks',
        description: 'Frustration-signal counts for the selected window.',
        rows: [
          { label: 'Rage Clicks', value: s.totalRageClicks },
          { label: 'Dead Clicks', value: s.totalDeadClicks },
          { label: 'Script Errors', value: s.totalScriptErrors },
        ],
      },
    },
    {
      key: 'totalDeadClicks',
      icon: '💀',
      label: 'Dead Clicks',
      value: s.totalDeadClicks,
      tooltip: 'Clicks on elements that don\'t respond - often a sign of a broken or non-interactive UI element.',
      drilldown: {
        title: '💀 Dead Clicks',
        description: 'Dead clicks vs. other frustration signals for the selected window.',
        rows: [
          { label: 'Dead Clicks', value: s.totalDeadClicks },
          { label: 'Rage Clicks', value: s.totalRageClicks },
          { label: 'Avg. Pages per Session', value: s.avgPagesPerSession },
        ],
      },
    },
    {
      key: 'avgScrollDepth',
      icon: '📜',
      label: 'Avg. Scroll Depth',
      value: s.avgScrollDepth,
      tooltip: 'Average percentage of each page visitors scroll down, across all sessions in the selected window.',
      drilldown: {
        title: '📜 Scroll Depth',
        description: 'Scroll behavior context for the selected window.',
        rows: [
          { label: 'Avg. Scroll Depth', value: s.avgScrollDepth },
          { label: 'Avg. Pages per Session', value: s.avgPagesPerSession },
        ],
      },
    },
  ];

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="section-title" style={{ margin: 0 }}>Microsoft Clarity</div>
          {lastUpdated && <p className="last-updated" style={{ margin: '4px 0 0 0' }}>Last updated: {lastUpdated}</p>}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={numOfDays}
            onChange={(e) => setNumOfDays(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', cursor: 'pointer', fontSize: '14px' }}
          >
            <option value="1">Last 24 Hours</option>
            <option value="2">Last 48 Hours</option>
            <option value="3">Last 72 Hours</option>
          </select>
          <button className="refresh-button" onClick={fetchData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      <div style={{ background: '#e7f7ee', border: '1px solid #b8e6cc', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#1a6b3f' }}>
        ✅ <strong>Real Microsoft Clarity data</strong> via Clarity's Data Export API.{' '}
        Clarity's API itself only supports the last 1-3 days and caps projects at 10 requests/day - that's a Clarity limitation, not ours.
        Data is cached for 15 minutes to conserve quota.{data.cached ? ' (showing cached result)' : ''}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px 0' }}>
        Showing the last {data.numOfDays} day{data.numOfDays !== 1 ? 's' : ''} - click any card below for more detail.
      </p>

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
          ⚠️ Not available via any API (Clarity dashboard-only by design): {data.unavailable.join(', ')}
        </div>
      )}
    </div>
  );
}
