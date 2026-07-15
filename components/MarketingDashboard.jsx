import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GoogleAnalyticsExplorer from './explorers/GoogleAnalyticsExplorer';
import LinkedInExplorer from './explorers/LinkedInExplorer';
import ClarityExplorer from './explorers/ClarityExplorer';

export default function MarketingDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetrics, setSelectedMetrics] = useState({});

  const handleMetricSelection = (source, metrics) => {
    setSelectedMetrics(prev => ({
      ...prev,
      [source]: metrics,
    }));
  };

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
            Explore data from your marketing channels below. Select which metrics you'd like to display on your dashboard.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📈</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Google Analytics</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Website traffic, conversions, user behavior</div>
            </div>

            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>💼</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>LinkedIn</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Followers, engagement, reach, leads</div>
            </div>

            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👁️</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Microsoft Clarity</div>
              <div style={{ fontSize: '12px', color: '#666' }}>User behavior, heatmaps, sessions</div>
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
