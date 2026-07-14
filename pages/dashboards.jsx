import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import SalesDashboard from '../components/SalesDashboard';
import FinanceDashboard from '../components/FinanceDashboard';
import { isValidToken } from '../lib/tokenUtils';

export default function Dashboards() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('sales');
  const [zohoAccessToken, setZohoAccessToken] = useState(null);
  const [zohoApiDomain, setZohoApiDomain] = useState(null);
  const [zohoRefreshToken, setZohoRefreshToken] = useState(null);
  const [xeroAccessToken, setXeroAccessToken] = useState(null);
  const [xeroTenantId, setXeroTenantId] = useState(null);
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

    // Load tokens from localStorage
    const zohoToken = localStorage.getItem('zohoAccessToken');
    const zohoDomain = localStorage.getItem('zohoApiDomain');
    const zohoRefresh = localStorage.getItem('zohoRefreshToken');
    const xeroToken = localStorage.getItem('xeroAccessToken');
    const tenantId = localStorage.getItem('xeroTenantId');

    if (isValidToken(zohoToken)) {
      setZohoAccessToken(zohoToken);
    } else if (zohoToken) {
      localStorage.removeItem('zohoAccessToken');
    }
    if (isValidToken(zohoDomain)) {
      setZohoApiDomain(zohoDomain);
    } else if (zohoDomain) {
      localStorage.removeItem('zohoApiDomain');
    }
    if (isValidToken(zohoRefresh)) {
      setZohoRefreshToken(zohoRefresh);
    } else if (zohoRefresh) {
      localStorage.removeItem('zohoRefreshToken');
    }
    if (isValidToken(xeroToken)) setXeroAccessToken(xeroToken);
    if (isValidToken(tenantId)) setXeroTenantId(tenantId);

    // Load login log
    const log = JSON.parse(localStorage.getItem('textraLoginLog')) || [];
    setLoginLog(log);
  }, [router]);

  useEffect(() => {
    // Handle OAuth callback from URL fragment
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const zohoToken = params.get('zoho_token');
    const xeroToken = params.get('xero_token');
    const zohoError = params.get('zoho_error');
    const xeroError = params.get('xero_error');

    if (zohoError || xeroError) {
      setOauthError(`${zohoError ? `Zoho: ${zohoError}` : ''}${zohoError && xeroError ? ' | ' : ''}${xeroError ? `Xero: ${xeroError}` : ''}`);
      window.history.replaceState({}, document.title, '/dashboards');
    }

    if (isValidToken(zohoToken)) {
      localStorage.setItem('zohoAccessToken', zohoToken);
      setZohoAccessToken(zohoToken);
      const apiDomain = params.get('zoho_api_domain');
      if (isValidToken(apiDomain)) {
        localStorage.setItem('zohoApiDomain', apiDomain);
        setZohoApiDomain(apiDomain);
      }
      const refreshToken = params.get('zoho_refresh');
      if (isValidToken(refreshToken)) {
        localStorage.setItem('zohoRefreshToken', refreshToken);
        setZohoRefreshToken(refreshToken);
      }
      window.history.replaceState({}, document.title, '/dashboards');
    }

    if (xeroToken) {
      localStorage.setItem('xeroAccessToken', xeroToken);
      const tenantId = params.get('xero_tenant');
      if (tenantId) {
        localStorage.setItem('xeroTenantId', tenantId);
        setXeroTenantId(tenantId);
      }
      setXeroAccessToken(xeroToken);
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

        {activeTab === 'sales' && (
          <SalesDashboard
            zohoAccessToken={zohoAccessToken}
            zohoApiDomain={zohoApiDomain}
            zohoRefreshToken={zohoRefreshToken}
            user={user}
          />
        )}
        {activeTab === 'finance' && (
          <FinanceDashboard
            xeroAccessToken={xeroAccessToken}
            xeroTenantId={xeroTenantId}
            user={user}
          />
        )}

        <div className="chart-container login-log-card">
          <button className="login-log-toggle" onClick={() => setShowLoginLog((v) => !v)}>
            <span className="chart-title" style={{ marginBottom: 0 }}>
              Login Activity ({loginLog.length}) — this device
            </span>
            <span className="login-log-caret">{showLoginLog ? '▲' : '▼'}</span>
          </button>
          {showLoginLog && (
            <div className="login-log-list">
              {loginLog.length === 0 && <p className="last-updated">No login activity recorded yet.</p>}
              {loginLog
                .slice()
                .reverse()
                .map((entry, i) => (
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
