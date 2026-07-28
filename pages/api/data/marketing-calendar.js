import { google } from 'googleapis';

const SHEET_ID = '1Zim-xHINFCx9e4joL3aJCZbP2sDs_S16ROwJ_geiEr4';
const RANGE = 'Calendar!A:E';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
    return res.status(401).json({
      error: 'Google Sheets not connected',
      message: 'Missing GOOGLE_SHEETS_CREDENTIALS environment variable',
      setupInstructions: {
        step1: 'Create a service account in Google Cloud Console',
        step2: 'Download the JSON key and share the sheet with the service account email',
        step3: 'Encode the JSON as base64 and add as GOOGLE_SHEETS_CREDENTIALS environment variable',
      },
    });
  }

  try {
    const credentialsJson = Buffer.from(process.env.GOOGLE_SHEETS_CREDENTIALS, 'base64').toString('utf-8');
    const credentials = JSON.parse(credentialsJson);

    const sheets = google.sheets({ version: 'v4', auth: new google.auth.GoogleAuth({ credentials }) });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values || [];

    if (rows.length < 2) {
      return res.status(200).json({
        success: true,
        events: [],
      });
    }

    // Parse header row (columns: Date, Campaign, Type, Status, Notes)
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const dateIdx = headers.indexOf('date');
    const campaignIdx = headers.indexOf('campaign');
    const typeIdx = headers.indexOf('type');
    const statusIdx = headers.indexOf('status');
    const notesIdx = headers.indexOf('notes');

    // Parse data rows
    const events = rows.slice(1)
      .map(row => ({
        date: row[dateIdx] || '',
        campaign: row[campaignIdx] || '',
        type: row[typeIdx] || '',
        status: row[statusIdx] || '',
        notes: row[notesIdx] || '',
      }))
      .filter(e => e.campaign && e.campaign.trim()); // Filter out empty rows

    return res.status(200).json({
      success: true,
      events,
    });
  } catch (err) {
    console.error('Marketing calendar fetch error:', err.message);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch marketing calendar',
    });
  }
}
