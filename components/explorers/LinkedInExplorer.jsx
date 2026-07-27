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

const METRIC_DESCRIPTIONS = {
  followers: 'Total follower count. May show 0 on small/new pages - LinkedIn masks low numbers below a privacy threshold, not a real zero.',
  monthlyImpressions: 'Total times your posts were shown in someone’s feed in the selected period (organic + sponsored, includes repeat views).',
  engagementRate: 'Percentage of people who saw your content and took an action on it (like, comment, repost, or click).',
  topPostReach: 'Distinct people who saw a post at least once in the selected period (same as Unique Impressions).',
  likes: 'Total reactions (likes, praise, etc.) across your posts in the selected period.',
  comments: 'Total comments left on your posts in the selected period.',
  reposts: 'Number of times someone reshared your content in the selected period.',
  clicks: 'Number of clicks on your posts (links, "see more", etc.) in the selected period.',
  uniqueImpressions: 'Distinct people who saw your content at least once, not counting repeat views from the same person.',
};

const METRIC_LABELS = {
  followers: 'Followers',
  monthlyImpressions: 'Impressions',
  engagementRate: 'Engagement Rate',
  topPostReach: 'Top Post Reach',
  likes: 'Likes',
  comments: 'Comments',
  reposts: 'Reposts',
  clicks: 'Clicks',
  uniqueImpressions: 'Unique Impressions',
};

export default function LinkedInExplorer({ onMetricSelect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
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
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch LinkedIn data');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
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

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="section-title" style={{ margin: 0 }}>LinkedIn Explorer</div>
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
          Showing data from {data.dateRange.start} to {data.dateRange.end}
        </p>
      )}

      <div style={{ background: '#f0f4ff', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '13px' }}>
        💼 Available metrics from LinkedIn Analytics. Select which ones you'd like on your dashboard.
      </div>

      {/* Summary Stats */}
      {data.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Object.entries(data.summary).map(([key, value]) => (
            <div key={key} style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', textAlign: 'center', position: 'relative' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0077B5' }}>{value}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                {METRIC_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()}
                {METRIC_DESCRIPTIONS[key] && <InfoTooltip text={METRIC_DESCRIPTIONS[key]} />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data Sections */}
      {data.metrics && Object.entries(data.metrics).map(([section, items]) => {
        if (!items || items.length === 0) return null;

        const isExpanded = expandedSections[section];

        return (
          <div key={section} style={{ marginBottom: '16px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => toggleSection(section)}
              style={{
                width: '100%',
                padding: '16px',
                background: '#f9f9f9',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ textTransform: 'capitalize' }}>
                {section.replace(/([A-Z])/g, ' $1').trim()} ({items.length})
              </span>
              <span>{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div style={{ padding: '16px', background: '#fff', maxHeight: '400px', overflowY: 'auto' }}>
                {items.slice(0, 20).map((item, idx) => (
                  <div key={idx} style={{ padding: '8px 0', borderBottom: idx < Math.min(20, items.length - 1) ? '1px solid #eee' : 'none', fontSize: '13px' }}>
                    {typeof item === 'object' ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#333', fontSize: '11px' }}>
                        {JSON.stringify(item, null, 2).substring(0, 300)}...
                      </pre>
                    ) : (
                      <div>{item}</div>
                    )}
                  </div>
                ))}
                {items.length > 20 && (
                  <div style={{ padding: '8px 0', color: '#999', fontSize: '12px' }}>
                    +{items.length - 20} more items
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: '24px', padding: '12px', background: '#e7f3ff', borderRadius: '4px', fontSize: '13px' }}>
        💡 Track follower growth, engagement rates, post performance, reach, impressions, and lead generation metrics.
      </div>
    </div>
  );
}
