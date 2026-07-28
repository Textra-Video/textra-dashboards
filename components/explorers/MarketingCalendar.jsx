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

export default function MarketingCalendar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/data/marketing-calendar');
      if (response.data.success) {
        setData(response.data);
        setLastUpdated(new Date().toLocaleString('en-GB'));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch calendar data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="loading">Fetching marketing calendar...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Make sure the Google Sheet is accessible and configured in the backend.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="error">No calendar data available</div>;
  }

  const events = data.events || [];

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="section-title" style={{ margin: 0, marginBottom: '6px' }}>📅 Marketing Calendar</div>
          {lastUpdated && (
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Last updated: {lastUpdated}</div>
          )}
        </div>
        <button className="refresh-button" onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px 0' }}>
        Upcoming campaigns and key marketing dates.
      </p>

      {events.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>Campaign/Event</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px', color: 'var(--text)' }}>{event.date}</td>
                  <td style={{ padding: '12px', color: 'var(--text)', fontWeight: 500 }}>{event.campaign}</td>
                  <td style={{ padding: '12px', color: 'var(--muted)', fontSize: '13px' }}>{event.type}</td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: event.status === 'Live' ? '#d4edda' : event.status === 'Upcoming' ? '#fff3cd' : '#e2e3e5',
                      color: event.status === 'Live' ? '#155724' : event.status === 'Upcoming' ? '#856404' : '#383d41',
                    }}>
                      {event.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--muted)', fontSize: '12px' }}>{event.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
          No calendar events available
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'var(--bg-alt)', borderRadius: '4px', fontSize: '12px', color: 'var(--muted)' }}>
        <p style={{ margin: '0 0 8px 0' }}>
          📊 Data source: <a href="https://docs.google.com/spreadsheets/d/1Zim-xHINFCx9e4joL3aJCZbP2sDs_S16ROwJ_geiEr4" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Marketing Calendar Google Sheet</a>
        </p>
      </div>
    </div>
  );
}
