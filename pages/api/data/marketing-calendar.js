export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // CSV export URL from the Google Sheet
    const SHEET_ID = '1Zim-xHINFCx9e4joL3aJCZbP2sDs_S16ROwJ_geiEr4';
    const GID = '0'; // First sheet
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    const response = await fetch(csvUrl, { timeout: 10000 });
    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`);
    }

    const csv = await response.text();
    const lines = csv.trim().split('\n');

    if (lines.length < 2) {
      return res.status(200).json({
        success: true,
        events: [],
      });
    }

    // Parse CSV header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const dateIdx = headers.indexOf('date');
    const campaignIdx = headers.indexOf('campaign');
    const typeIdx = headers.indexOf('type');
    const statusIdx = headers.indexOf('status');
    const notesIdx = headers.indexOf('notes');

    // Parse data rows
    const events = lines.slice(1)
      .filter(line => line.trim().length > 0)
      .map(line => {
        // Simple CSV parsing (handles quoted values)
        const regex = /(?:"([^"]*)"|([^,]*))/g;
        const cols = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          cols.push((match[1] || match[2] || '').trim());
        }

        return {
          date: cols[dateIdx] || '',
          campaign: cols[campaignIdx] || '',
          type: cols[typeIdx] || '',
          status: cols[statusIdx] || '',
          notes: cols[notesIdx] || '',
        };
      })
      .filter(e => e.campaign); // Filter out empty rows

    return res.status(200).json({
      success: true,
      events,
    });
  } catch (err) {
    console.error('Marketing calendar fetch error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch marketing calendar',
    });
  }
}
