import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import axios from 'axios';
import SalesDashboard from '../components/SalesDashboard';
import FinanceDashboard from '../components/FinanceDashboard';
import MarketingDashboard from '../components/MarketingDashboard';

export default function Dashboards() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('sales');
  const [loginLog, setLoginLog] = useState([]);
  const [oauthError, setOauthError] = useState(null);
  const [showLoginLog, setShowLoginLog] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const savedUser = localStorage.getItem('textraUser');
    if (!savedUser) {
      router.push('/');
      return;
    }
    setUser(savedUser);

    // Login log is shared (Redis-backed) - visible to every user/device.
    axios
      .get('/api/data/login-log')
      .then((res) => {
        if (res.data.success) setLoginLog(res.data.entries);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    // Handle OAuth callback from URL fragment. Both Zoho and Xero tokens
    // are stored server-side now (shared connections) - only a
    // success/error flag comes back in the fragment, never the token itself.
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const zohoError = params.get('zoho_error');
    const xeroError = params.get('xero_error');

    if (zohoError || xeroError) {
      setOauthError(`${zohoError ? `Zoho: ${zohoError}` : ''}${zohoError && xeroError ? ' | ' : ''}${xeroError ? `Xero: ${xeroError}` : ''}`);
    }

    if (zohoError || xeroError || params.get('zoho_connected') || params.get('xero_connected')) {
      window.history.replaceState({}, document.title, '/dashboards');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('textraUser');
    router.push('/');
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-logo">
          <Image
            src="/logos/textra-video-logo.png"
            alt="Textra Video"
            width={150}
            height={21}
            priority
          />
        </div>
        <div className="dashboard-nav">
          <button
            className={`nav-button ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            Sales Pipeline
          </button>
          <button
            className={`nav-button ${activeTab === 'finance' ? 'active' : ''}`}
            onClick={() => setActiveTab('finance')}
          >
            Finance
          </button>
          <button
            className={`nav-button ${activeTab === 'marketing' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketing')}
          >
            Marketing
          </button>
          <button className="logout-button" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="dashboard-container">
        {oauthError && (
          <div className="error">
            OAuth error: {oauthError}
            <button
              onClick={() => setOauthError(null)}
              style={{ marginLeft: '12px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'sales' && <SalesDashboard user={user} />}
        {activeTab === 'finance' && <FinanceDashboard user={user} />}
        {activeTab === 'marketing' && <MarketingDashboard user={user} />}

        <div className="chart-container login-log-card">
          <button className="login-log-toggle" onClick={() => setShowLoginLog((v) => !v)}>
            <span className="chart-title" style={{ marginBottom: 0 }}>
              Login Activity ({loginLog.length}) — shared across all users
            </span>
            <span className="login-log-caret">{showLoginLog ? '▲' : '▼'}</span>
          </button>
          {showLoginLog && (
            <div className="login-log-list">
              {loginLog.length === 0 && <p className="last-updated">No login activity recorded yet.</p>}
              {loginLog.map((entry, i) => (
                <div key={i} className="login-log-row">
                  <span>{entry.user}</span>
                  <span className="last-updated">{new Date(entry.timestamp).toLocaleString('en-GB')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
