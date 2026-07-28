// Jira Explorer - real data via Jira Cloud REST API v3
// Auth: Basic (email + API token) - appropriate for a single internal
// Jira site, not a multi-tenant OAuth app. Generate a token at
// https://id.atlassian.com/manage-profile/security/api-tokens
//
// Requires: JIRA_SITE_URL (e.g. yourcompany.atlassian.net), JIRA_EMAIL,
// JIRA_API_TOKEN, JIRA_PROJECT_KEY

function authHeader() {
  const token = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  return `Basic ${token}`;
}

async function jqlCount(baseUrl, jql) {
  // The 'total' field on /search/jql is unreliable (returns 0 even when
  // matching issues exist - a known issue with this endpoint since the
  // 2025 /search deprecation). Fetch actual issues and count them instead.
  // Capped at 100 - fine for a small team's backlog; would need pagination
  // (nextPageToken) if any single category exceeds that.
  const url = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=summary`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira search failed (${res.status}) for JQL "${jql}": ${body.substring(0, 300)}`);
  }
  const data = await res.json();
  return (data.issues || []).length;
}

async function jqlIssues(baseUrl, jql, fields, maxResults = 50) {
  const url = `${baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${fields.join(',')}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira search failed (${res.status}) for JQL "${jql}": ${body.substring(0, 300)}`);
  }
  const data = await res.json();
  return data.issues || [];
}

export default async function handler(req, res) {
  const { JIRA_SITE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;

  if (!JIRA_SITE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
    return res.status(401).json({
      error: 'Jira not connected',
      message: 'Missing JIRA_SITE_URL, JIRA_EMAIL, JIRA_API_TOKEN, or JIRA_PROJECT_KEY',
      setupInstructions: {
        step1: 'Generate an API token at id.atlassian.com/manage-profile/security/api-tokens',
        step2: 'Add JIRA_SITE_URL (e.g. yourcompany.atlassian.net), JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY to environment variables',
      },
    });
  }

  const baseUrl = `https://${JIRA_SITE_URL.replace(/^https?:\/\//, '')}`;
  const project = JIRA_PROJECT_KEY;

  try {
    const [
      openCount,
      inProgressCount,
      doneLast30Count,
      bugsOpenCount,
      backlogCount,
    ] = await Promise.all([
      jqlCount(baseUrl, `project = ${project} AND statusCategory = "To Do"`),
      jqlCount(baseUrl, `project = ${project} AND statusCategory = "In Progress"`),
      jqlCount(baseUrl, `project = ${project} AND statusCategory = Done AND resolved >= -30d`),
      jqlCount(baseUrl, `project = ${project} AND issuetype = Bug AND statusCategory != Done`),
      jqlCount(baseUrl, `project = ${project} AND statusCategory != Done`),
    ]);

    // Oldest unresolved issues (backlog aging)
    let oldestIssues = [];
    try {
      const issues = await jqlIssues(
        baseUrl,
        `project = ${project} AND statusCategory != Done ORDER BY created ASC`,
        ['summary', 'created', 'status'],
        5
      );
      oldestIssues = issues.map((i) => {
        const ageDays = Math.floor((Date.now() - new Date(i.fields.created).getTime()) / (1000 * 60 * 60 * 24));
        return { label: `${i.key}: ${i.fields.summary}`.substring(0, 80), value: `${ageDays}d old` };
      });
    } catch (e) {
      console.log('[Jira] Oldest issues unavailable:', e.message);
    }

    // Priority breakdown (real data)
    let priorityBreakdown = [];
    try {
      const priorities = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
      const counts = await Promise.all(
        priorities.map((p) => jqlCount(baseUrl, `project = ${project} AND priority = "${p}" AND statusCategory != Done`))
      );
      priorityBreakdown = priorities
        .map((label, i) => ({ label, value: counts[i] }))
        .filter((p) => p.value > 0);
    } catch (e) {
      console.log('[Jira] Priority breakdown unavailable:', e.message);
    }

    // Issue type breakdown (real data)
    let typeBreakdown = [];
    try {
      const types = ['Bug', 'Story', 'Task', 'Epic', 'Sub-task'];
      const counts = await Promise.all(
        types.map((t) => jqlCount(baseUrl, `project = ${project} AND issuetype = "${t}" AND statusCategory != Done`))
      );
      typeBreakdown = types
        .map((label, i) => ({ label, value: counts[i] }))
        .filter((t) => t.value > 0);
    } catch (e) {
      console.log('[Jira] Type breakdown unavailable:', e.message);
    }

    res.status(200).json({
      success: true,
      message: 'Jira Explorer - real data via Jira Cloud REST API',
      project,
      summary: {
        openIssues: openCount,
        inProgress: inProgressCount,
        doneLast30Days: doneLast30Count,
        openBugs: bugsOpenCount,
        totalBacklog: backlogCount,
      },
      breakdowns: {
        priorityBreakdown,
        typeBreakdown,
        oldestIssues,
      },
    });
  } catch (error) {
    console.error('Jira explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch Jira data',
      message: error.message,
    });
  }
}
