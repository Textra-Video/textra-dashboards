import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import SalesDashboard from '../components/SalesDashboard';
import FinanceDashboard from '../components/FinanceDashboard';

// localStorage.getItem returns the literal string "undefined" if a bad
// value was ever written, and that string is truthy - so guard for it.
function isValidToken(value) {
  return Boolean(value) && value !== 'undefined' && value !== 'null';
}

export default function Dashboards() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('sales');
  const [zohoAccessToken, setZohoAccessToken] = useState(null);
  const [zohoApiDomain, setZohoApiDomain] = useState(null);
  const [xeroAccessToken, setXeroAccessToken] = useState(null);
  const [xeroTenantId, setXeroTenantId] = useState(null);
  const [loginLog, setLoginLog] = useState([]);
  const [oauthError, setOauthError] = useState(null);

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
    localStorage.removeItem('textraLoginLog');
    router.push('/');
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-logo">Textra Video</div>
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
          <SalesDashboard zohoAccessToken={zohoAccessToken} zohoApiDomain={zohoApiDomain} user={user} />
        )}
        {activeTab === 'finance' && (
          <FinanceDashboard
            xeroAccessToken={xeroAccessToken}
            xeroTenantId={xeroTenantId}
            user={user}
          />
        )}
      </div>
    </div>
  );
}
