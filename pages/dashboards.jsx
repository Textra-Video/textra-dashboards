import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import SalesDashboard from '../components/SalesDashboard';
import FinanceDashboard from '../components/FinanceDashboard';

export default function Dashboards() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('sales');
  const [zohoAccessToken, setZohoAccessToken] = useState(null);
  const [xeroAccessToken, setXeroAccessToken] = useState(null);
  const [xeroTenantId, setXeroTenantId] = useState(null);
  const [loginLog, setLoginLog] = useState([]);

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
    const xeroToken = localStorage.getItem('xeroAccessToken');
    const tenantId = localStorage.getItem('xeroTenantId');

    if (zohoToken) setZohoAccessToken(zohoToken);
    if (xeroToken) setXeroAccessToken(xeroToken);
    if (tenantId) setXeroTenantId(tenantId);

    // Load login log
    const log = JSON.parse(localStorage.getItem('textraLoginLog')) || [];
    setLoginLog(log);
  }, [router]);

  useEffect(() => {
    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state === 'zoho') {
      // Exchange Zoho code for token
      fetch('/api/auth/zoho/callback?code=' + code)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            localStorage.setItem('zohoAccessToken', data.accessToken);
            setZohoAccessToken(data.accessToken);
            window.history.replaceState({}, document.title, '/dashboards');
          }
        });
    }

    if (code && state === 'xero') {
      // Exchange Xero code for token
      fetch('/api/auth/xero/callback?code=' + code)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            localStorage.setItem('xeroAccessToken', data.accessToken);
            // Extract tenant ID from Xero connections
            localStorage.setItem('xeroTenantId', 'your-tenant-id');
            setXeroAccessToken(data.accessToken);
            window.history.replaceState({}, document.title, '/dashboards');
          }
        });
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

      {activeTab === 'sales' && <SalesDashboard zohoAccessToken={zohoAccessToken} user={user} />}
      {activeTab === 'finance' && (
        <FinanceDashboard
          xeroAccessToken={xeroAccessToken}
          xeroTenantId={xeroTenantId}
          user={user}
        />
      )}
    </div>
  );
}
