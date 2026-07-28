import React, { useState } from 'react';
import axios from 'axios';

const SUGGESTED_QUERIES = [
  'What\'s our total pipeline?',
  'Which deals close this month?',
  'What\'s our largest deal?',
  'Which source generates most revenue?',
  'Show deals by stage',
  'What\'s our average sales cycle?',
];

export default function AISalesQuery({ dashboardData }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await axios.post('/api/ai/query-sales-data', {
        query: query.trim(),
        dashboardData,
      });

      if (result.data.success) {
        setResponse(result.data.answer);
        setQuery('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process query');
      console.error('Query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (suggestion) => {
    setQuery(suggestion);
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.3s',
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
        }}
      >
        <span>✨</span>
        {isOpen ? 'Close AI Query' : 'Ask AI About Your Sales Data'}
      </button>

      {isOpen && (
        <div
          style={{
            marginTop: '12px',
            padding: '16px',
            background: 'var(--bg-alt)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <form onSubmit={handleSubmit} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
              Ask anything about your sales pipeline:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., What's our total pipeline?"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                style={{
                  padding: '10px 16px',
                  background: loading ? '#ccc' : '#667eea',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'default' : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'background 0.2s',
                }}
              >
                {loading ? 'Asking...' : 'Ask'}
              </button>
            </div>
          </form>

          {/* Suggested queries */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Quick suggestions:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SUGGESTED_QUERIES.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestion(suggestion)}
                  disabled={loading}
                  style={{
                    padding: '6px 10px',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text)',
                    cursor: loading ? 'default' : 'pointer',
                    fontSize: '12px',
                    transition: 'all 0.2s',
                    opacity: loading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => (e.target.style.background = 'var(--border)')}
                  onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Response */}
          {response && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: 'var(--bg)',
                borderLeft: '4px solid #667eea',
                borderRadius: '4px',
                fontSize: '14px',
                lineHeight: '1.6',
                color: 'var(--text)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>AI Answer:</div>
              {response}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                background: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#c33',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Error:</div>
              {error}
            </div>
          )}

          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
            💡 Powered by Groq • Tip: Ask specific questions about pipeline, deals, stages, sources, or trends.
          </div>
        </div>
      )}
    </div>
  );
}
