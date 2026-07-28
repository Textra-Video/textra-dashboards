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

const SECONDARY_DESCRIPTIONS = {
  followerGrowth30d: 'New followers gained in the last 30 days (organic + sponsored), regardless of the date range selected above.',
  followerGrowthVsLastMonth: 'Change in follower growth rate vs. the prior 30-day period. "new growth" means there was no prior-period data to compare against.',
  organicImpressions: 'Impressions from unpaid, organic reach only.',
  paidImpressions: 'Impressions from sponsored/paid promotion only.',
  pageViews: 'Total visits to your LinkedIn page (desktop + mobile) in the selected period.',
  uniqueVisitors: 'Distinct visitors. LinkedIn suppresses this field by default (requires a field-projection request we haven\'t implemented) - currently always 0, not a real count.',
};

const SECONDARY_LABELS = {
  followerGrowth30d: 'Follower Growth (30d)',
  followerGrowthVsLastMonth: 'Growth vs Last Month',
  organicImpressions: 'Organic Impressions',
  paidImpressions: 'Paid Impressions',
  pageViews: 'Page Views',
  uniqueVisitors: 'Unique Visitors',
};

const SECONDARY_ORDER = ['organicImpressions', 'paidImpressions', 'followerGrowth30d', 'followerGrowthVsLastMonth', 'pageViews', 'uniqueVisitors'];

function pct(part, whole) {
  if (!whole) return '—';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export default function LinkedInExplorer({ onMetricSelect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dateRange, setDateRange] = useState('last-year'); // 'last-year', 'last-90', 'last-30', 'custom'
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
    fetchLinkedInData();
  }, [dateRange, customStart, customEnd]);

  const fetchLinkedInData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = getDateRangeParams();
      const response = await axios.get('/api/data/linkedin-explorer', { params });
      if (response.data.success) {
        setData(response.data);
        setLastUpdated(new Date().toLocaleString('en-GB'));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch LinkedIn data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="loading">Fetching LinkedIn data...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          To connect LinkedIn, you'll need to:
          1. Register your app in LinkedIn Developers portal
          2. Request access to LinkedIn Analytics API
          3. Set your access token in environment variables
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="error">No data available</div>;
  }

  const s = data.summary || {};

  const primaryCards = [
    {
      key: 'followers',
      icon: '👥',
      label: 'Followers',
      value: s.followers,
      tooltip: 'Total follower count. May show 0 on small/new pages - LinkedIn masks low numbers below a privacy threshold, not a real zero.',
      drilldown: {
        title: '👥 Followers',
        description: 'Current followers and growth trends. Note: Total follower count may be privacy-masked by LinkedIn on smaller pages, but growth rates are always accurate.',
        rows: [
          { label: 'Current Total Followers', value: s.followers || '—' },
          { label: 'New Followers (last 30d)', value: s.followerGrowth30d },
          { label: 'Growth Rate vs Previous Month', value: s.followerGrowthVsLastMonth, tooltip: 'Change vs last month (+ = accelerating).' },
        ],
      },
    },
    {
      key: 'monthlyImpressions',
      icon: '👁️',
      label: 'Impressions',
      value: s.monthlyImpressions,
      tooltip: 'Total times your posts were shown in someone’s feed in the selected period (organic + sponsored, includes repeat views).',
      drilldown: {
        title: '👁️ Impressions',
        description: 'Breakdown of total impressions for the selected period. Total should equal Organic + Paid.',
        rows: (() => {
          const total = s.monthlyImpressions || 0;
          const organic = s.organicImpressions || 0;
          const paid = s.paidImpressions || 0;
          const calculated = organic + paid;
          const mismatch = total !== calculated && total > 0 && calculated > 0;
          return [
            {
              label: 'Total Impressions' + (mismatch ? ' ⚠️' : ''),
              value: total,
              ...(mismatch && { link: 'https://www.linkedin.com/company/108355800/admin/dashboard/' })
            },
            { label: 'Organic', value: organic },
            { label: 'Paid / Sponsored', value: paid },
            { label: 'Calculated Total (Organic + Paid)', value: calculated, tooltip: 'Should match Total Impressions above.' },
            { label: 'Unique Impressions', value: s.uniqueImpressions, tooltip: 'Distinct people (deduplicated).' },
          ];
        })(),
      },
    },
    {
      key: 'engagementRate',
      icon: '📊',
      label: 'Engagement Rate',
      value: s.engagementRate,
      tooltip: 'Percentage of people who saw your content and took an action on it (like, comment, repost, or click).',
      drilldown: {
        title: '📊 Engagement Rate',
        description: 'Breakdown of engagement actions and their rates for the selected period.',
        rows: [
          { label: 'Engagement Rate %', value: s.engagementRate },
          { label: 'Total Engagement Actions', value: (s.likes || 0) + (s.comments || 0) + (s.reposts || 0) + (s.clicks || 0) },
          { label: 'Likes', value: s.likes },
          { label: 'Likes per 1,000 Impressions', value: s.monthlyImpressions ? ((s.likes / s.monthlyImpressions) * 1000).toFixed(1) : '—' },
          { label: 'Comments', value: s.comments },
          { label: 'Comments per 1,000 Impressions', value: s.monthlyImpressions ? ((s.comments / s.monthlyImpressions) * 1000).toFixed(1) : '—' },
          { label: 'Reposts', value: s.reposts },
          { label: 'Reposts per 1,000 Impressions', value: s.monthlyImpressions ? ((s.reposts / s.monthlyImpressions) * 1000).toFixed(1) : '—' },
          { label: 'Clicks', value: s.clicks },
          { label: 'Clicks per 1,000 Impressions', value: s.monthlyImpressions ? ((s.clicks / s.monthlyImpressions) * 1000).toFixed(1) : '—' },
          { label: 'View Detailed Posts', value: '→', link: 'https://www.linkedin.com/company/108355800/admin/dashboard/' },
        ],
      },
    },
    {
      key: 'topPostReach',
      icon: '🎯',
      label: 'Top Post Reach',
      value: s.topPostReach,
      tooltip: 'Distinct people who saw a post at least once in the selected period (same as Unique Impressions).',
      drilldown: {
        title: '🎯 Top Post Reach',
        description: 'Reach vs. total impressions for the selected period.',
        rows: [
          { label: 'Unique Reach', value: s.topPostReach },
          { label: 'Total Impressions', value: s.monthlyImpressions },
          { label: 'Reach as % of Impressions', value: pct(s.topPostReach, s.monthlyImpressions), tooltip: 'Higher % = wider reach.' },
        ],
      },
    },
    {
      key: 'likes',
      icon: '👍',
      label: 'Likes',
      value: s.likes,
      tooltip: 'Total reactions (likes, praise, etc.) across your posts in the selected period.',
      drilldown: {
        title: '👍 Likes',
        description: 'Like engagement for the selected period. View individual posts and reactions in the LinkedIn Dashboard.',
        rows: [
          { label: 'Total Likes', value: s.likes },
          { label: 'Unique Impressions', value: s.uniqueImpressions },
          { label: 'Likes per 1,000 Impressions', value: s.monthlyImpressions ? ((s.likes / s.monthlyImpressions) * 1000).toFixed(1) : '—' },
          { label: 'Engagement Rate (Likes %)', value: s.monthlyImpressions ? `${((s.likes / s.monthlyImpressions) * 100).toFixed(2)}%` : '—' },
          { label: 'View Posts with Likes', value: '→', link: 'https://www.linkedin.com/company/108355800/admin/dashboard/' },
        ],
      },
    },
    {
      key: 'comments',
      icon: '💬',
      label: 'Comments',
      value: s.comments,
      tooltip: 'Total comments left on your posts in the selected period.',
      drilldown: {
        title: '💬 Comments',
        description: 'Comment engagement for the selected period. View individual posts and comments in the LinkedIn Dashboard.',
        rows: [
          { label: 'Total Comments', value: s.comments },
          { label: 'Unique Impressions', value: s.uniqueImpressions },
          { label: 'Comments per 1,000 Impressions', value: s.monthlyImpressions ? ((s.comments / s.monthlyImpressions) * 1000).toFixed(1) : '—' },
          { label: 'Engagement Rate (Comments %)', value: s.monthlyImpressions ? `${((s.comments / s.monthlyImpressions) * 100).toFixed(2)}%` : '—' },
          { label: 'View Posts with Comments', value: '→', link: 'https://www.linkedin.com/company/108355800/admin/dashboard/' },
        ],
      },
    },
    {
      key: 'reposts',
      icon: '🔁',
      label: 'Reposts',
      value: s.reposts,
      tooltip: 'Number of times someone reshared your content in the selected period.',
      drilldown: {
        title: '🔁 Reposts',
        description: 'Repost engagement for the selected period. View individual posts and reposts in the LinkedIn Dashboard.',
        rows: [
          { label: 'Total Reposts', value: s.reposts },
          { label: 'Unique Impressions', value: s.uniqueImpressions },
          { label: 'Reposts per 1,000 Impressions', value: s.monthlyImpressions ? ((s.reposts / s.monthlyImpressions) * 1000).toFixed(1) : '—' },
          { label: 'Engagement Rate (Reposts %)', value: s.monthlyImpressions ? `${((s.reposts / s.monthlyImpressions) * 100).toFixed(2)}%` : '—', tooltip: 'Key for reach amplification.' },
          { label: 'View Posts with Reposts', value: '→', link: 'https://www.linkedin.com/company/108355800/admin/dashboard/' },
        ],
      },
    },
    {
      key: 'clicks',
      icon: '🖱️',
      label: 'Clicks',
      value: s.clicks,
      tooltip: 'Number of clicks on your posts (links, "see more", etc.) in the selected period.',
      drilldown: {
        title: '🖱️ Clicks',
        description: 'Click-through performance for the selected period. View individual posts and click performance in the LinkedIn Dashboard.',
        rows: [
          { label: 'Total Clicks', value: s.clicks },
          { label: 'Total Impressions', value: s.monthlyImpressions },
          { label: 'Click-Through Rate', value: pct(s.clicks, s.monthlyImpressions) },
          { label: 'Engagement Rate (Clicks %)', value: s.monthlyImpressions ? `${((s.clicks / s.monthlyImpressions) * 100).toFixed(2)}%` : '—' },
          { label: 'View Posts with Clicks', value: '→', link: 'https://www.linkedin.com/company/108355800/admin/dashboard/' },
        ],
      },
    },
  ];

  const secondaryStats = SECONDARY_ORDER.filter((key) => s[key] !== undefined);

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="section-title" style={{ margin: 0 }}>
            LinkedIn Explorer
            <a href="https://www.linkedin.com/company/108355800/admin/dashboard/" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px', fontSize: '14px', color: '#667eea', textDecoration: 'none', fontWeight: 'normal' }}>
              (LinkedIn Dashboard)
            </a>
          </div>
          {lastUpdated && <p className="last-updated" style={{ margin: '4px 0 0 0' }}>Last updated: {lastUpdated}</p>}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <option value="last-30">Last 30 Days</option>
            <option value="last-90">Last 90 Days</option>
            <option value="last-year">Last 12 Months</option>
            <option value="custom">Custom Range</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', fontSize: '14px' }}
              />
              <span style={{ color: 'var(--muted)' }}>to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', fontSize: '14px' }}
              />
            </>
          )}
          <button className="refresh-button" onClick={fetchLinkedInData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {data.dateRange && (
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px 0' }}>
          Showing data from {data.dateRange.start} to {data.dateRange.end} - click any card below for more detail.
        </p>
      )}

      {/* Primary metrics - wraps cleanly instead of cutting off in a scroll row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '14px',
          marginBottom: '28px',
        }}
      >
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

      {/* Secondary stats - clearly grouped as a distinct, lighter section */}
      {secondaryStats.length > 0 && (
        <div style={{ border: '1px solid #e5e5e5', borderRadius: '8px', padding: '16px', marginBottom: '24px', background: '#fafafa' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '12px' }}>
            Additional Metrics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {secondaryStats.map((key) => (
              <div key={key} style={{ background: '#fff', border: '1px solid #eee', padding: '12px 14px', borderRadius: '6px' }}>
                <div style={{ fontSize: '17px', fontWeight: 600, color: '#333' }}>{s[key]}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {SECONDARY_LABELS[key]}
                  {SECONDARY_DESCRIPTIONS[key] && <InfoTooltip text={SECONDARY_DESCRIPTIONS[key]} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drilldown modal */}
      {drilldown && (
        <div className="modal-overlay" onClick={() => setDrilldown(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDrilldown(null)}>✕</button>
            <h2>{drilldown.title}</h2>
            <p className="modal-description">{drilldown.description}</p>
            <table className="drilldown-table">
              <tbody>
                {(() => {
                  const seen = new Set();
                  return drilldown.rows.filter((row) => {
                    const key = `${row.label}::${row.value}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }).map((row, i) => (
                    <tr key={i} style={{ cursor: row.link ? 'pointer' : 'default' }} onClick={() => row.link && window.open(row.link, '_blank')}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {row.label}
                        {row.tooltip && <InfoTooltip text={row.tooltip} />}
                      </td>
                      <td className="amount" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                        {row.value ?? '—'}
                        {row.link && <span style={{ fontSize: '12px', color: '#0077B5' }}>↗</span>}
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
