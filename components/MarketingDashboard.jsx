import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GoogleAnalyticsExplorer from './explorers/GoogleAnalyticsExplorer';
import LinkedInExplorer from './explorers/LinkedInExplorer';
import ClarityExplorer from './explorers/ClarityExplorer';

export default function MarketingDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetrics, setSelectedMetrics] = useState({});
  const [snapshot, setSnapshot] = useState({ linkedin: null, analytics: null, clarity: null });
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
      axios.get('/api/data/clarity-explorer', { params: { numOfDays: '3' } }),
    ]).then(([linkedin, analytics, clarity]) => {
      if (cancelled) return;
      setSnapshot({
        linkedin: linkedin.status === 'fulfilled' && linkedin.value.data.success ? linkedin.value.data.summary : null,
        analytics: analytics.status === 'fulfilled' && analytics.value.data.success ? analytics.value.data.summary : null,
        clarity: clarity.status === 'fulfilled' && clarity.value.data.success ? clarity.value.data.summary : null,
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
          onClick={() => setActiveTab('clarity')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'clarity' ? '#2c5aa0' : 'transparent',
            color: activeTab === 'clarity' ? '#fff' : '#666',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
        >
          Microsoft Clarity
        </button>
      </div>

      {activeTab === 'overview' && (
        <div>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Snapshot of your marketing channels (last 30 days). Click a channel below for full detail.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div
              onClick={() => setActiveTab('analytics')}
              style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📈</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Google Analytics</div>
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
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>LinkedIn</div>
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
              onClick={() => setActiveTab('clarity')}
              style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👁️</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Microsoft Clarity</div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>User behavior, rage clicks, sessions (last 3 days)</div>
              {snapshotLoading ? (
                <div style={{ fontSize: '12px', color: '#999' }}>Loading…</div>
              ) : snapshot.clarity ? (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7b4fa3' }}>{snapshot.clarity.totalSessions}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Sessions</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7b4fa3' }}>{snapshot.clarity.distinctUsers}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Distinct Users</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#7b4fa3' }}>{snapshot.clarity.totalRageClicks}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Rage Clicks</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#999' }}>Not connected</div>
              )}
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

      {activeTab === 'clarity' && (
        <ClarityExplorer onMetricSelect={(metrics) => handleMetricSelection('clarity', metrics)} />
      )}
    </div>
  );
}
