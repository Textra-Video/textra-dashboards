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

    // List available models via REST API to find the correct ones
    let modelsToTry = [];
    try {
      const listResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + process.env.GEMINI_API_KEY
      );
      const { models: availableModels } = await listResponse.json();
      const modelNames = availableModels.map(m => m.name);
      console.log('Available models:', modelNames);

      // Priority order for model selection
      const modelPriority = [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-pro',
      ];

      for (const preferredName of modelPriority) {
        const model = availableModels.find(m => {
          const name = m.name.split('/').pop();
          return name === preferredName && m.supportedGenerationMethods?.includes('generateContent');
        });
        if (model) {
          modelsToTry.push(model.name.split('/').pop());
        }
      }

      // Fallback: add any model that supports generateContent
      if (modelsToTry.length === 0) {
        const fallback = availableModels.find(m =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          m.name.includes('gemini')
        );
        if (fallback) {
          modelsToTry.push(fallback.name.split('/').pop());
        }
      }

      if (modelsToTry.length === 0) {
        throw new Error('No suitable Gemini text models found. Available: ' + modelNames.join(', '));
      }

      console.log('Models to try in order:', modelsToTry);
    } catch (err) {
      console.error('Error listing models:', err.message);
      modelsToTry = ['gemini-pro'];
    }

    // Format the dashboard data for the prompt
    const dataContext = formatSalesData(dashboardData);

    const prompt = `You are a sales analytics assistant. Analyze this sales pipeline data and answer the user's question clearly and concisely.

SALES DATA:
${dataContext}

USER QUESTION: ${query}

Provide a direct, actionable answer. If relevant, cite specific numbers from the data. Keep response under 200 words unless the user asks for detailed analysis.`;

    // Try each model in priority order, falling back on quota/rate limit errors
    let lastError;
    for (const modelName of modelsToTry) {
      try {
        console.log('Trying model:', modelName);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return res.status(200).json({
          success: true,
          answer: responseText,
          timestamp: new Date().toISOString(),
          model: modelName,
        });
      } catch (err) {
        lastError = err;
        const errorMessage = err.message || '';
        const is429 = err.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota');

        if (is429) {
          console.warn(`Model ${modelName} hit quota limit, trying next model...`);
          continue; // Try next model
        } else if (errorMessage.includes('no longer available')) {
          console.warn(`Model ${modelName} is no longer available, trying next model...`);
          continue; // Try next model
        } else {
          // Other errors should stop retrying
          throw err;
        }
      }
    }

    // All models failed
    throw lastError || new Error('All models exhausted');
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
