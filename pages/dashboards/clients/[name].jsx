import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import axios from 'axios';

function fmtK(value) {
  return `£${(value / 1000).toFixed(0)}k`;
}

export default function ClientDetail() {
  const router = useRouter();
  const { name } = router.query;
  const [deals, setDeals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('textraUser');
    if (!savedUser) {
      router.push('/');
    }
  }, [router]);

  useEffect(() => {
    if (!name) return;

    setLoading(true);
    setError(null);

    axios
      .post('/api/data/zoho-deals')
      .then((response) => {
        if (response.data.success) {
          const clientDeals = response.data.data.deals.filter((d) => d.account === name);
          setDeals(clientDeals);
        }
      })
      .catch((err) => {
        if (err.response?.data?.error === 'not_connected') {
          setNotConnected(true);
        } else {
          setError(err.response?.data?.details || err.response?.data?.error || 'Failed to fetch client data');
        }
      })
      .finally(() => setLoading(false));
  }, [name]);

  const totalValue = deals ? deals.reduce((sum, d) => sum + d.value, 0) : 0;
  const openValue = deals ? deals.filter((d) => d.isOpen).reduce((sum, d) => sum + d.value, 0) : 0;
  const wonValue = deals ? deals.filter((d) => d.isWon).reduce((sum, d) => sum + d.value, 0) : 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-logo">
          <Image src="/logos/textra-video-logo.png" alt="Textra Video" width={150} height={21} priority />
        </div>
        <div className="dashboard-nav">
          <button className="nav-button" onClick={() => router.push('/dashboards')}>
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="dashboard-container">
        <div className="section-title">{name || 'Client'}</div>

        {notConnected && (
          <div className="connect-prompt">
            <p>Zoho CRM isn&apos;t connected yet.</p>
            <button className="connect-button" onClick={() => router.push('/dashboards')}>
              Go to Dashboard to Connect
            </button>
          </div>
        )}

        {error && <div className="error">Error: {error}</div>}
        {loading && <div className="loading">Loading client data...</div>}

        {deals && (
          <>
            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-label">Total Value</div>
                <div className="metric-value">{fmtK(totalValue)}</div>
                <div className="metric-subtext">{deals.length} deal{deals.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Open Pipeline</div>
                <div className="metric-value">{fmtK(openValue)}</div>
                <div className="metric-subtext">Active opportunities</div>
              </div>
              <div className="metric-card success">
                <div className="metric-label">Confirmed Bookings</div>
                <div className="metric-value">{fmtK(wonValue)}</div>
                <div className="metric-subtext">Closed Won</div>
              </div>
            </div>

            <div className="section-title">Deals</div>
            <div className="chart-container">
              <div className="deal-list">
                {deals.map((d) => (
                  <div key={d.id} className="deal-list-row">
                    <div className="deal-list-main">
                      <span className="deal-list-name">{d.name}</span>
                      <span className={`deal-list-stage ${d.isWon ? 'won' : ''}`}>{d.stage}</span>
                    </div>
                    <div className="deal-list-meta">
                      <span>{fmtK(d.value)}</span>
                      <span>Owner: {d.owner}</span>
                      <span>Probability: {d.probability}%</span>
                      {d.contact && <span>Contact: {d.contact}</span>}
                      {d.closeDate && <span>Close: {new Date(d.closeDate).toLocaleDateString('en-GB')}</span>}
                      {d.crmUrl && (
                        <a href={d.crmUrl} target="_blank" rel="noopener noreferrer" className="crm-link">
                          View in Zoho CRM ↗
                        </a>
                      )}
                    </div>
                    {d.nextStep && (
                      <div className="deal-list-nextstep">Next step: {d.nextStep}</div>
                    )}
                    {!d.isOpen && d.reasonForLoss && (
                      <div className="deal-list-nextstep">Lost reason: {d.reasonForLoss}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {deals && deals.length === 0 && (
          <div className="connect-prompt">
            <p>No deals found for &quot;{name}&quot;.</p>
          </div>
        )}
      </div>
    </div>
  );
}
