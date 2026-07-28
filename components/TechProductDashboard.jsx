import React, { useState, useEffect } from 'react';
import axios from 'axios';
import JiraExplorer from './explorers/JiraExplorer';

export default function TechProductDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [snapshot, setSnapshot] = useState({ jira: null });
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== 'overview') return;

    let cancelled = false;
    setSnapshotLoading(true);

    axios.get('/api/data/jira-explorer').then((jira) => {
      if (cancelled) return;
      setSnapshot({
        jira: jira.data.success ? jira.data.summary : null,
      });
      setSnapshotLoading(false);
    }).catch(() => {
      if (!cancelled) setSnapshotLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeTab]);

  return (
    <div className="dashboard-content">
      <div className="section-title">🛠️ Tech + Product Dashboard</div>

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
            Snapshot of engineering and product delivery. Click a tool below for full detail.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div
              onClick={() => setActiveTab('jira')}
              style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Jira</div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>Sprints, backlog, bugs, throughput</div>
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

      {activeTab === 'jira' && <JiraExplorer />}
    </div>
  );
}
