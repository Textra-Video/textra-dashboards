import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function GoogleAnalyticsExplorer({ onMetricSelect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    fetchGoogleAnalyticsData();
  }, []);

  const fetchGoogleAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/data/google-analytics-explorer');
      if (response.data.success) {
        setData(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch Google Analytics data');
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

  if (loading) {
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

  return (
    <div className="dashboard-content">
      <div className="section-title">Google Analytics Explorer</div>

      <div style={{ background: '#f0f4ff', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '13px' }}>
        📊 Available metrics from Google Analytics API. Select which ones you'd like on your dashboard.
      </div>

      {/* Summary Stats */}
      {data.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Object.entries(data.summary).map(([key, value]) => (
            <div key={key} style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c5aa0' }}>{value}</div>
              <div style={{ fontSize: '12px', color: '#666', textTransform: 'capitalize', marginTop: '4px' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
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
        💡 Use these metrics to build marketing performance charts, conversion funnels, traffic sources, and user behavior analysis.
      </div>
    </div>
  );
}
