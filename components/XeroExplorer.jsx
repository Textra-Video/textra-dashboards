import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function XeroExplorer({ onDataSelect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [selectedMetrics, setSelectedMetrics] = useState({});

  useEffect(() => {
    fetchXeroData();
  }, []);

  const fetchXeroData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/data/xero-explorer');
      if (response.data.success) {
        setData(response.data);
        setExpandedSections({});
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch Xero data');
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

  const toggleMetricSelection = (metric) => {
    setSelectedMetrics(prev => ({
      ...prev,
      [metric]: !prev[metric],
    }));
    if (onDataSelect) {
      onDataSelect({ ...selectedMetrics, [metric]: !selectedMetrics[metric] });
    }
  };

  if (loading) {
    return <div className="dashboard-content"><div className="loading">Fetching Xero data...</div></div>;
  }

  if (error) {
    return <div className="dashboard-content"><div className="error">Error: {error}</div></div>;
  }

  if (!data) {
    return <div className="dashboard-content"><div className="error">No data available</div></div>;
  }

  return (
    <div className="dashboard-content">
      <div className="section-title">📊 Xero Data Explorer</div>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
        Below is all available data from your Xero account. Select what you'd like to display on your Finance dashboard.
      </p>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(data.summary || {}).map(([key, count]) => (
          <div key={key} style={{
            background: '#f5f5f5',
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2c5aa0' }}>{count}</div>
            <div style={{ fontSize: '12px', color: '#666', textTransform: 'capitalize' }}>
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
          </div>
        ))}
      </div>

      {/* Data Sections */}
      {Object.entries(data.data || {}).map(([section, items]) => {
        if (!Array.isArray(items) || items.length === 0) return null;

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
                {items.slice(0, 10).map((item, idx) => (
                  <div key={idx} style={{
                    padding: '8px 0',
                    borderBottom: idx < Math.min(10, items.length - 1) ? '1px solid #eee' : 'none',
                    fontSize: '13px',
                  }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#333' }}>
                      {JSON.stringify(item, null, 2).substring(0, 200)}...
                    </pre>
                  </div>
                ))}
                {items.length > 10 && (
                  <div style={{ padding: '8px 0', color: '#999', fontSize: '12px' }}>
                    +{items.length - 10} more items
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Errors */}
      {data.errors && data.errors.length > 0 && (
        <div style={{ marginTop: '24px', padding: '12px', background: '#fff3cd', borderRadius: '4px' }}>
          <strong>Endpoints that failed to fetch:</strong>
          <ul style={{ margin: '8px 0 0 20px', fontSize: '12px' }}>
            {data.errors.map((err, idx) => (
              <li key={idx}>{err.endpoint} (Status: {err.status})</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '12px', background: '#e7f3ff', borderRadius: '4px', fontSize: '13px' }}>
        ℹ️ Once you've reviewed the data above, let me know which metrics you'd like to display on your Finance dashboard.
      </div>
    </div>
  );
}
