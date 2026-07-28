export default function MarketingCalendar() {
  return (
    <div className="dashboard-content">
      <div style={{ marginBottom: '16px' }}>
        <div className="section-title" style={{ margin: 0 }}>📅 Marketing Calendar</div>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 16px 0' }}>
        Click cells to edit directly in Google Sheets. <a href="https://docs.google.com/spreadsheets/d/1Zim-xHINFCx9e4joL3aJCZbP2sDs_S16ROwJ_geiEr4/edit?usp=sharing" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Open in full view ↗</a>
      </p>

      <div style={{
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'hidden',
        height: '600px',
        marginBottom: '16px',
      }}>
        <iframe
          src="https://docs.google.com/spreadsheets/d/e/2PACX-1vS0DAAbfdAgQscdg_JllIbEIq8OoJO8kCpdpayE51g4yyuUZtaGojyOY2woZolRRXFm6UFdIVw8K1eN/pubhtml?widget=true&headers=false"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '8px',
          }}
          title="Marketing Calendar"
        />
      </div>

      <div style={{ fontSize: '12px', color: 'var(--muted)', padding: '12px', backgroundColor: 'var(--bg-alt)', borderRadius: '4px' }}>
        📋 Updates sync automatically from the Google Sheet. Refresh page to see latest changes.
      </div>
    </div>
  );
}
