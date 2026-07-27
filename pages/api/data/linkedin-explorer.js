// LinkedIn Analytics API Explorer
// Fetches follower/impression metrics for the Textra Video company page via
// LinkedIn's Pages Data Portability API (DMA).
// Requires: LINKEDIN_ACCESS_TOKEN in environment variables (r_dma_admin_pages_content scope)

const LINKEDIN_VERSION = '202605'; // confirmed active via LinkedIn's own changelog

const baseHeaders = (accessToken) => ({
  'Authorization': `Bearer ${accessToken}`,
  'Accept': 'application/json',
  'LinkedIn-Version': LINKEDIN_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
});

export default async function handler(req, res) {
  if (!process.env.LINKEDIN_ACCESS_TOKEN) {
    return res.status(401).json({
      error: 'LinkedIn not connected',
      message: 'Please configure LINKEDIN_ACCESS_TOKEN in environment variables',
    });
  }

  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const organizationUrn = 'urn:li:organization:108355800'; // Textra Video

  let followers = 0;
  let monthlyImpressions = 0;
  let engagementRate = '0%';
  let topPostReach = 0;

  try {
    // Step 1: resolve the organizationalPage URN from the organization URN.
    // pageEntity is a union type - must be wrapped as (organization:URN),
    // with the URN's own colons percent-encoded inside the structure.
    const pageEntityRes = await fetch(
      `https://api.linkedin.com/rest/dmaOrganizationalPageProfiles?q=pageEntity&pageEntity=(organization:${encodeURIComponent(organizationUrn)})`,
      { headers: baseHeaders(accessToken) }
    );
    const pageEntityData = await pageEntityRes.json();
    const organizationalPageUrn = pageEntityData.elements?.[0]?.entityUrn;

    if (!organizationalPageUrn) {
      throw new Error(`Could not resolve organizationalPage URN: ${JSON.stringify(pageEntityData)}`);
    }

    // Flat top-level URN query params must also be percent-encoded.
    const encodedPageUrn = encodeURIComponent(organizationalPageUrn);

    // Step 2: follower count via the trend finder (analyticsType=FOLLOWER).
    // Accept optional startDate/endDate (YYYY-MM-DD) query params; default
    // to the last 365 days if not provided.
    const { startDate, endDate } = req.query;
    const end = endDate ? new Date(endDate).getTime() : Date.now();
    const start = startDate ? new Date(startDate).getTime() : end - 365 * 24 * 60 * 60 * 1000;
    const timeIntervals = `(timeRange:(end:${end},start:${start}))`;

    const followerRes = await fetch(
      `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=trend&organizationalPage=${encodedPageUrn}&analyticsType=FOLLOWER&timeIntervals=${timeIntervals}`,
      { headers: baseHeaders(accessToken) }
    );
    const followerData = await followerRes.json();

    // Growth-based metrics don't need the (privacy-masked) total follower
    // baseline - they're derived from the per-bucket trend data itself.
    let followerGrowth30d = 0;
    let followerGrowthPrevPeriod = 0;
    let followerGrowthVsLastMonth = 'n/a';

    if (Array.isArray(followerData.elements)) {
      const dayMs = 24 * 60 * 60 * 1000;
      const last30Start = end - 30 * dayMs;
      const prev30Start = end - 60 * dayMs;

      for (const el of followerData.elements) {
        const v = el.value?.typeSpecificValue?.followerEdgeAnalyticsValue;
        const bucketGrowth = (v?.organicValue || 0) + (v?.sponsoredValue || 0);
        const bucketStart = el.timeIntervals?.timeRange?.start ?? 0;

        followers += bucketGrowth;
        if (bucketStart >= last30Start) {
          followerGrowth30d += bucketGrowth;
        } else if (bucketStart >= prev30Start) {
          followerGrowthPrevPeriod += bucketGrowth;
        }
      }

      if (followerGrowthPrevPeriod > 0) {
        const pct = ((followerGrowth30d - followerGrowthPrevPeriod) / followerGrowthPrevPeriod) * 100;
        followerGrowthVsLastMonth = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      } else if (followerGrowth30d > 0) {
        followerGrowthVsLastMonth = 'new growth (no prior period data)';
      }
    }

    // Step 3: page-level content analytics via the trend finder.
    // postGestures/postDimension require a specific post's URN
    // (sourcePostEntity) - we don't have individual post IDs. trend accepts
    // sourceEntity=organizationalPage URN directly for aggregate metrics.
    let likes = 0, comments = 0, reposts = 0, clicks = 0, uniqueImpressions = 0;
    let organicImpressions = 0, paidImpressions = 0;
    try {
      const metricTypes = 'List(IMPRESSIONS,UNIQUE_IMPRESSIONS,CLICKS,COMMENTS,REACTIONS,REPOSTS,ENGAGEMENT_RATE)';
      const contentRes = await fetch(
        `https://api.linkedin.com/rest/dmaOrganizationalPageContentAnalytics?q=trend&sourceEntity=${encodedPageUrn}&metricTypes=${metricTypes}&timeIntervals=${timeIntervals}`,
        { headers: baseHeaders(accessToken) }
      );
      const contentData = await contentRes.json();

      if (Array.isArray(contentData.elements)) {
        const totalsByType = {};
        let organicImpressionsTotal = 0;
        let paidImpressionsTotal = 0;

        const extract = (u) => {
          const v = u?.long ?? parseFloat(u?.bigDecimal);
          return Number.isFinite(v) ? v : 0;
        };

        for (const el of contentData.elements) {
          const val = el.metric?.value;
          const count = extract(val?.totalCount);
          totalsByType[el.type] = (totalsByType[el.type] || 0) + count;

          if (el.type === 'IMPRESSIONS') {
            const cv = val?.typeSpecificValue?.contentAnalyticsValue;
            organicImpressionsTotal += extract(cv?.organicValue);
            paidImpressionsTotal += extract(cv?.sponsoredValue);
          }
        }

        monthlyImpressions = totalsByType.IMPRESSIONS || 0;
        uniqueImpressions = totalsByType.UNIQUE_IMPRESSIONS || 0;
        clicks = totalsByType.CLICKS || 0;
        comments = totalsByType.COMMENTS || 0;
        likes = totalsByType.REACTIONS || 0;
        reposts = totalsByType.REPOSTS || 0;
        topPostReach = uniqueImpressions || monthlyImpressions;
        organicImpressions = organicImpressionsTotal;
        paidImpressions = paidImpressionsTotal;

        if (totalsByType.ENGAGEMENT_RATE !== undefined) {
          engagementRate = (totalsByType.ENGAGEMENT_RATE * 100).toFixed(1) + '%';
        }
      }
    } catch (contentErr) {
      console.log('[LinkedIn] Content analytics unavailable:', contentErr.message);
    }

    // Step 4: visitor/page-view stats via the same edge analytics endpoint,
    // analyticsType=VISITOR instead of FOLLOWER.
    let pageViews = 0, uniqueVisitors = 0;
    try {
      const visitorRes = await fetch(
        `https://api.linkedin.com/rest/dmaOrganizationalPageEdgeAnalytics?q=trend&organizationalPage=${encodedPageUrn}&analyticsType=VISITOR&timeIntervals=${timeIntervals}`,
        { headers: baseHeaders(accessToken) }
      );
      const visitorData = await visitorRes.json();
      if (Array.isArray(visitorData.elements)) {
        for (const el of visitorData.elements) {
          const v = el.value?.typeSpecificValue?.visitorEdgeAnalyticsValue;
          pageViews += (v?.desktopCount || 0) + (v?.mobileCount || 0);
          uniqueVisitors += (v?.uniqueCount || 0);
        }
      }
    } catch (visitorErr) {
      console.log('[LinkedIn] Visitor analytics unavailable:', visitorErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'LinkedIn Analytics - Available Metrics',
      dateRange: {
        start: new Date(start).toISOString().slice(0, 10),
        end: new Date(end).toISOString().slice(0, 10),
      },
      summary: {
        followers,
        followerGrowth30d,
        followerGrowthVsLastMonth,
        monthlyImpressions,
        organicImpressions,
        paidImpressions,
        engagementRate,
        topPostReach,
        likes,
        comments,
        reposts,
        clicks,
        uniqueImpressions,
        pageViews,
        uniqueVisitors,
      },
      // Remaining items LinkedIn's DMA product doesn't expose via any
      // documented endpoint (no per-post breakdown, no lead gen without
      // separate forms, no search-appearance data in this API surface).
      metrics: {
        contentMetrics: ['Top Performing Posts (requires per-post URNs, not available via aggregate page analytics)', 'Best Posting Times', 'Content by Type'],
        leadMetrics: ['Lead Gen Forms Opened', 'Lead Gen Forms Submitted', 'CTA Clicks (requires Lead Gen Forms API - separate integration)'],
      },
    });
  } catch (error) {
    console.error('LinkedIn explorer error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch LinkedIn data',
      message: error.message,
    });
  }
}
