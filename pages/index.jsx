import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Textra Video Operational Dashboards</h1>
      <p>Live analytics powered by Zoho CRM and Xero</p>
      <div style={{ marginTop: '30px' }}>
        <Link href="/dashboards">
          <button style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            View Dashboards
          </button>
        </Link>
      </div>
    </div>
  );
}
