// Microsoft Clarity Data Export API
// Real Clarity data (not a Google Analytics stand-in). Requires CLARITY_API_TOKEN
// (Settings -> Data Export -> Generate new API token, project admin only).
//
// Hard limitations from Clarity's own API (not our choice):
// - Max 10 requests per project per day
// - Only the last 1-3 days of data - no historical range, no custom dates
// - Max 3 dimensions per request, response capped at 1,000 rows, no pagination

// Simple in-memory cache to avoid burning the 10/day quota on every page
// load/refresh. Only helps within a warm serverless instance, not across
// cold starts, but meaningfully reduces repeat calls during active use.
let cache = { data: null, numOfDays: null, fetchedAt: 0 };
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function findMetric(rows, name) {
  return rows.find((m) => m.metricName === name)?.information || [];
}

function sumField(info, field) {
  return info.reduce((sum, row) => sum + (parseInt(row[field]) || 0), 0);
}

export default async function handler(req, res) {
  if (!process.env.CLARITY_API_TOKEN) {
    return res.status(401).json({
      error: 'Microsoft Clarity not connected',
      message: 'Missing CLARITY_API_TOKEN',
      setupInstructions: {
        step1: 'In Clarity, open your project and go to Settings -> Data Export',
        step2: 'Generate new API token (project admin only)',
        step3: 'Add it as CLARITY_API_TOKEN in environment variables',
      },
    });
  }

  const numOfDays = ['1', '2', '3'].includes(req.query.numOfDays) ? req.query.numOfDays : '3';

  if (cache.data && cache.numOfDays === numOfDays && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const response = await fetch(
      `https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=${numOfDays}&dimension1=Device`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.CLARITY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 429) {
      return res.status(429).json({
        error: 'Clarity API daily quota exceeded',
        message: 'Clarity allows only 10 requests per project per day. Try again after the quota resets.',
      });
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Clarity API returned ${response.status}: ${body}`);
    }

    const rows = await response.json();

    const traffic = findMetric(rows, 'Traffic');
    const scrollDepth = findMetric(rows, 'ScrollDepth');
    const engagementTime = findMetric(rows, 'EngagementTime');
    const deadClicks = findMetric(rows, 'DeadClickCount');
    const rageClicks = findMetric(rows, 'RageClickCount');
    const quickback = findMetric(rows, 'QuickbackClick');
    const scriptErrors = findMetric(rows, 'ScriptErrorCount');

    const totalSessions = sumField(traffic, 'totalSessionCount');
    const totalBotSessions = sumField(traffic, 'totalBotSessionCount');
    const distinctUsers = sumField(traffic, 'distinctUserCount') || sumField(traffic, 'distantUserCount');
    const avgPagesPerSession = traffic.length
      ? (traffic.reduce((sum, r) => sum + (parseFloat(r.PagesPerSessionPercentage) || 0), 0) / traffic.length).toFixed(2)
      : '0';

    const deviceBreakdown = traffic.map((r) => ({
      label: r.Device || 'Unknown',
      value: parseInt(r.totalSessionCount) || 0,
    }));

    const summary = {
      totalSessions,
      distinctUsers,
      botSessions: totalBotSessions,
      avgPagesPerSession,
      totalDeadClicks: sumField(deadClicks, 'DeadClickCount') || deadClicks.length,
      totalRageClicks: sumField(rageClicks, 'RageClickCount') || rageClicks.length,
      totalScriptErrors: sumField(scriptErrors, 'ScriptErrorCount') || scriptErrors.length,
    };

    const result = {
      success: true,
      message: 'Microsoft Clarity - real data via Clarity Data Export API',
      dataSource: 'Microsoft Clarity Data Export API (genuine, not Google Analytics)',
      numOfDays: parseInt(numOfDays),
      summary,
      breakdowns: {
        deviceBreakdown,
      },
      // Clarity's API returns aggregated counts only - not achievable via
      // any API, Clarity or otherwise: actual heatmap images and session
      // recording playback remain dashboard-only by design.
      unavailable: ['Heatmap Images', 'Session Recording Playback'],
    };

    cache = { data: result, numOfDays, fetchedAt: Date.now() };

    res.status(200).json(result);
  } catch (error) {
    console.error('Clarity explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch Clarity data',
      message: error.message,
    });
  }
}
