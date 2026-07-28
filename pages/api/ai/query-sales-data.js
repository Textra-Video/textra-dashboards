import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(401).json({
      error: 'Gemini API not configured',
      message: 'Missing GEMINI_API_KEY environment variable',
      setupInstructions: {
        step1: 'Go to https://makersuite.google.com/app/apikey',
        step2: 'Create a new API key',
        step3: 'Add to environment variable: GEMINI_API_KEY',
      },
    });
  }

  try {
    const { query, dashboardData } = req.body;

    if (!query || !dashboardData) {
      return res.status(400).json({ error: 'Missing query or dashboardData' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Format the dashboard data for the prompt
    const dataContext = formatSalesData(dashboardData);

    const prompt = `You are a sales analytics assistant. Analyze this sales pipeline data and answer the user's question clearly and concisely.

SALES DATA:
${dataContext}

USER QUESTION: ${query}

Provide a direct, actionable answer. If relevant, cite specific numbers from the data. Keep response under 200 words unless the user asks for detailed analysis.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    return res.status(200).json({
      success: true,
      answer: responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Gemini query error:', err);
    return res.status(500).json({
      error: 'Failed to process query',
      message: err.message,
    });
  }
}

function formatSalesData(data) {
  if (!data) return 'No data available';

  const {
    summary = {},
    deals = [],
    stageBreakdown = [],
    sourceBreakdown = [],
    sizeBreakdown = [],
  } = data;

  let context = '### SUMMARY METRICS\n';
  if (summary.totalPipeline)
    context += `Total Pipeline: £${summary.totalPipeline}\n`;
  if (summary.confirmedBookings)
    context += `Confirmed Bookings (all-time): £${summary.confirmedBookings}\n`;
  if (summary.thisMonthClose)
    context += `This Month Close (forecast): £${summary.thisMonthClose}\n`;
  if (summary.monthlyRunRate)
    context += `Monthly Run Rate: £${summary.monthlyRunRate}\n`;
  if (summary.avgSalesCycle)
    context += `Average Sales Cycle: ${summary.avgSalesCycle}\n`;

  if (stageBreakdown && stageBreakdown.length > 0) {
    context += '\n### DEALS BY STAGE\n';
    stageBreakdown.forEach(s => {
      context += `${s.label}: £${s.value || 0}\n`;
    });
  }

  if (sourceBreakdown && sourceBreakdown.length > 0) {
    context += '\n### DEALS BY SOURCE\n';
    sourceBreakdown.forEach(s => {
      context += `${s.label}: £${s.value || 0}\n`;
    });
  }

  if (sizeBreakdown && sizeBreakdown.length > 0) {
    context += '\n### DEALS BY SIZE\n';
    sizeBreakdown.forEach(s => {
      context += `${s.label}: £${s.value || 0}\n`;
    });
  }

  if (deals && deals.length > 0 && deals.length <= 10) {
    context += '\n### RECENT DEALS\n';
    deals.slice(0, 5).forEach(deal => {
      context += `${deal.name}: £${deal.amount} (${deal.stage})\n`;
    });
  }

  return context;
}
