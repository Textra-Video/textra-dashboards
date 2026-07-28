import React, { useState, useEffect } from 'react';
import axios from 'axios';
import JiraExplorer from './explorers/JiraExplorer';

export default function OpsDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [snapshot, setSnapshot] = useState({ jira: null, lastUpdated: null });
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== 'overview') return;

    let cancelled = false;
    setSnapshotLoading(true);

    axios.get('/api/data/jira-explorer', { params: { project: 'BO' } }).then((jira) => {
      if (cancelled) return;
      setSnapshot({
        jira: jira.data.success ? jira.data.summary : null,
        lastUpdated: new Date().toLocaleString('en-GB'),
      });
      setSnapshotLoading(false);
    }).catch(() => {
      if (!cancelled) setSnapshotLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeTab]);

  return (
    <div className="dashboard-content">
      <div className="section-title">🔧 Operations Dashboard</div>

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
          onClick={() => setActiveTab('jira')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'jira' ? '#2c5aa0' : 'transparent',
            color: activeTab === 'jira' ? '#fff' : '#666',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            borderRadius: '4px',
          }}
        >
          Jira
        </button>
      </div>

      {activeTab === 'overview' && (
        <div>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Operations team backlog and priority tracking. Click a tool below for full detail.
          </p>
          {snapshot.lastUpdated && (
            <p style={{ fontSize: '12px', color: '#999', marginBottom: '16px' }}>
              Last updated: {snapshot.lastUpdated}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div
              onClick={() => setActiveTab('jira')}
              style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Jira</div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Tasks, issues, priorities</div>
              {snapshotLoading ? (
                <div style={{ fontSize: '12px', color: '#999' }}>Loading…</div>
              ) : snapshot.jira ? (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5aa0' }}>{snapshot.jira.openIssues}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Open</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5aa0' }}>{snapshot.jira.inProgress}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>In Progress</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c5aa0' }}>{snapshot.jira.openBugs}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>Open Bugs</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#999' }}>Not connected</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'jira' && (
        <JiraExplorer
          project="BO"
          boardUrl="https://textravideo.atlassian.net/jira/core/projects/BO/list?jql=project+%3D+BO+ORDER+BY+cf%5B10019%5D+ASC&atlOrigin=eyJpIjoiZjkwY2UyZjMzZmU5NDNlYzg3MjlkOWRiNTgzYTdhYTQiLCJwIjoiaiJ9"
          title="🔧 Jira"
        />
      )}
    </div>
  );
}
