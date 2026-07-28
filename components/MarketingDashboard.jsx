import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GoogleAnalyticsExplorer from './explorers/GoogleAnalyticsExplorer';
import LinkedInExplorer from './explorers/LinkedInExplorer';
import MarketingCalendar from './explorers/MarketingCalendar';

export default function MarketingDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetrics, setSelectedMetrics] = useState({});
  const [snapshot, setSnapshot] = useState({ linkedin: null, analytics: null, lastUpdated: null });
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  const handleMetricSelection = (source, metrics) => {
    setSelectedMetrics(prev => ({
      ...prev,
      [source]: metrics,
    }));
  };

  useEffect(() => {
    if (activeTab !== 'overview') return;

    let cancelled = false;
    setSnapshotLoading(true);

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const start30 = new Date(today);
    start30.setDate(start30.getDate() - 30);

    Promise.allSettled([
      axios.get('/api/data/linkedin-explorer', { params: { startDate: fmt(start30), endDate: fmt(today) } }),
      axios.get('/api/data/google-analytics-explorer'),
    ]).then(([linkedin, analytics]) => {
      if (cancelled) return;
      setSnapshot({
        linkedin: linkedin.status === 'fulfilled' && linkedin.value.data.success ? linkedin.value.data.summary : null,
        analytics: analytics.status === 'fulfilled' && analytics.value.data.success ? analytics.value.data.summary : null,
        lastUpdated: new Date().toLocaleString('en-GB'),
      });
      setSnapshotLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeTab]);

  return (
    <div className="dashboard-content">
      <div className="section-title">📊 Marketing Dashboard</div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #ddd', paddingBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'overview' ? '#2c5aa0' : 'transparent',
            color: activeTab === 'overview' ? '#fff' : '#666',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'analytics' ? '#2c5aa0' : 'transparent',
            color: activeTab === 'analytics' ? '#fff' : '#666',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
        >
          Google Analytics
        </button>
        <button
          onClick={() => setActiveTab('linkedin')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'linkedin' ? '#2c5aa0' : 'transparent',
            color: activeTab === 'linkedin' ? '#fff' : '#666',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
        >
          LinkedIn
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'calendar' ? '#2c5aa0' : 'transparent',
            color: activeTab === 'calendar' ? '#fff' : '#666',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
        >
          Marketing Calendar
        </button>
      </div>

      {activeTab === 'overview' && (
        <div>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Snapshot of your marketing channels (last 30 days). Click a channel below for full detail.
          </p>
          {snapshot.lastUpdated && (
            <p style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>
              Last updated: {snapshot.lastUpdated}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div
              onClick={() => setActiveTab('analytics')}
              style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📈</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                Google Analytics
                <a href="https://www.textra.video" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '6px', fontSize: '12px', color: '#667eea', textDecoration: 'none' }}>
                  (www.textra.video)
                </a>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Website traffic, conversions, user behavior</div>
              {snapshotLoading ? (
                <div style={{ fontSize: '12px', color: '#999' }}>Loading…</div>
              ) : snapshot.analytics ? (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5aa0' }}>{snapshot.analytics.totalUsers}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Users</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5aa0' }}>{snapshot.analytics.totalSessions}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Sessions</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5aa0' }}>{snapshot.analytics.engagementRate}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Engagement</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#999' }}>Not connected</div>
              )}
            </div>

            <div
              onClick={() => setActiveTab('linkedin')}
              style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💼</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                LinkedIn
                <a href="https://www.linkedin.com/company/108355800/admin/dashboard/" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '6px', fontSize: '12px', color: '#667eea', textDecoration: 'none' }}>
                  (Dashboard)
                </a>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Followers, engagement, reach, leads</div>
              {snapshotLoading ? (
                <div style={{ fontSize: '12px', color: '#999' }}>Loading…</div>
              ) : snapshot.linkedin ? (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0077B5' }}>{snapshot.linkedin.monthlyImpressions}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Impressions</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0077B5' }}>{snapshot.linkedin.engagementRate}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Engagement</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0077B5' }}>{snapshot.linkedin.clicks}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Clicks</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#999' }}>Not connected</div>
              )}
            </div>

            <div
              onClick={() => setActiveTab('calendar')}
              style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📅</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Marketing Calendar</div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Campaigns, content calendar, key dates</div>
              <div style={{ fontSize: '12px', color: '#999' }}>View full calendar →</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <GoogleAnalyticsExplorer onMetricSelect={(metrics) => handleMetricSelection('analytics', metrics)} />
      )}

      {activeTab === 'linkedin' && (
        <LinkedInExplorer onMetricSelect={(metrics) => handleMetricSelection('linkedin', metrics)} />
      )}

      {activeTab === 'calendar' && (
        <MarketingCalendar />
      )}
    </div>
  );
}
