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

export default function JiraExplorer({ onMetricSelect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drilldown, setDrilldown] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/data/jira-explorer');
      if (response.data.success) {
        setData(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch Jira data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return <div className="loading">Fetching Jira data...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          To connect Jira, you'll need to:
          1. Generate an API token at id.atlassian.com/manage-profile/security/api-tokens
          2. Add JIRA_SITE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY to environment variables
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="error">No data available</div>;
  }

  const s = data.summary || {};
  const b = data.breakdowns || {};
  const links = data.links || {};

  const rowsFromBreakdown = (items) =>
    (items || []).map((item) => ({ label: item.label, value: item.value, url: item.url }));

  const primaryCards = [
    {
      key: 'openIssues',
      icon: '📋',
      label: 'Open Issues',
      value: s.openIssues,
      tooltip: 'Issues in "To Do" status - not yet started.',
      drilldown: {
        title: '📋 Open Issues',
        description: 'Backlog and open issue context.',
        rows: [
          { label: 'Open Issues (To Do)', value: s.openIssues },
          { label: 'Total Backlog (not Done)', value: s.totalBacklog },
          { label: 'In Progress', value: s.inProgress },
        ],
        jiraLink: links.openIssues,
      },
    },
    {
      key: 'inProgress',
      icon: '🔧',
      label: 'In Progress',
      value: s.inProgress,
      tooltip: 'Issues actively being worked on right now.',
      drilldown: {
        title: '🔧 In Progress',
        description: 'Active work vs. the rest of the backlog.',
        rows: [
          { label: 'In Progress', value: s.inProgress },
          { label: 'Open (To Do)', value: s.openIssues },
          { label: 'Done (Last 30 Days)', value: s.doneLast30Days },
        ],
        jiraLink: links.inProgress,
      },
    },
    {
      key: 'doneLast30Days',
      icon: '✅',
      label: 'Done (30 Days)',
      value: s.doneLast30Days,
      tooltip: 'Issues resolved in the last 30 days - throughput indicator.',
      drilldown: {
        title: '✅ Done (Last 30 Days)',
        description: 'Recent throughput vs. remaining backlog.',
        rows: [
          { label: 'Done (Last 30 Days)', value: s.doneLast30Days },
          { label: 'Total Backlog', value: s.totalBacklog },
        ],
        jiraLink: links.doneLast30Days,
      },
    },
    {
      key: 'openBugs',
      icon: '🐛',
      label: 'Open Bugs',
      value: s.openBugs,
      tooltip: 'Unresolved issues of type "Bug".',
      drilldown: {
        title: '🐛 Open Bugs',
        description: 'Bugs vs. other issue types in the open backlog (real data from Jira, click a row to view that filter in Jira).',
        rows: rowsFromBreakdown(b.typeBreakdown).length > 0
          ? rowsFromBreakdown(b.typeBreakdown)
          : [{ label: 'No type breakdown available', value: '' }],
        jiraLink: links.openBugs,
      },
    },
    {
      key: 'totalBacklog',
      icon: '📦',
      label: 'Total Backlog',
      value: s.totalBacklog,
      tooltip: 'All unresolved issues (To Do + In Progress) across the project.',
      drilldown: {
        title: '📦 Backlog by Priority',
        description: 'Open backlog broken down by priority (real data from Jira, click a row to view that filter in Jira).',
        rows: rowsFromBreakdown(b.priorityBreakdown).length > 0
          ? rowsFromBreakdown(b.priorityBreakdown)
          : [{ label: 'No priority breakdown available', value: '' }],
        jiraLink: links.totalBacklog,
      },
    },
    {
      key: 'oldestIssue',
      icon: '⏳',
      label: 'Oldest Unresolved',
      value: (b.oldestIssues || [])[0]?.value || '—',
      tooltip: 'Age of the longest-standing unresolved issue - a backlog health signal.',
      drilldown: {
        title: '⏳ Oldest Unresolved Issues',
        description: 'The 5 longest-standing unresolved issues (real data from Jira, click a row to open that issue).',
        rows: (b.oldestIssues || []).length > 0
          ? b.oldestIssues
          : [{ label: 'No unresolved issues', value: '' }],
        jiraLink: links.totalBacklog,
      },
    },
  ];

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="section-title" style={{ margin: 0 }}>Jira Explorer{data.project ? ` — ${data.project}` : ''}</div>
        <button className="refresh-button" onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px 0' }}>
        Click any card below for more detail.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {primaryCards.map((card) => (
          <button
            key={card.key}
            className="metric-card metric-card-clickable"
            style={{ padding: '18px 16px', minHeight: '120px' }}
            onClick={() => setDrilldown(card.drilldown)}
          >
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.9, lineHeight: 1.3 }}>
              <span>{card.icon}</span>
              <span>{card.label}</span>
              <InfoTooltip text={card.tooltip} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 'bold', marginTop: 'auto' }}>{card.value ?? '—'}</div>
          </button>
        ))}
      </div>

      {drilldown && (
        <div className="modal-overlay" onClick={() => setDrilldown(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDrilldown(null)}>✕</button>
            <h2>{drilldown.title}</h2>
            <p className="modal-description">{drilldown.description}</p>
            <table className="drilldown-table">
              <tbody>
                {drilldown.rows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                          {row.label} ↗
                        </a>
                      ) : (
                        row.label
                      )}
                    </td>
                    <td className="amount">{row.value ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drilldown.jiraLink && (
              <a href={drilldown.jiraLink} target="_blank" rel="noopener noreferrer" className="view-in-xero-link">
                Open in Jira →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
