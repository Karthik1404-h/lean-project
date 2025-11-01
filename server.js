// This is the backend file. It runs on Node.js.

// Import necessary packages
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config(); // To load environment variables from a .env file

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000; // The port the server will run on

// --- Middleware ---
app.use(express.json({ limit: '10mb' })); 
app.use(express.static('public')); 

// --- Gemini API Setup ---
// Configure for v1 API endpoint - use correct initialization for SDK v0.24.1+
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Preferred models (try lightweight/flash-lite first, then fallbacks)
let MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
let model = null;
let modelFallbackIndex = 0;
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash'];

console.log(`🔑 API Key configured: ${Boolean(process.env.GEMINI_API_KEY)}`);
console.log(`🔑 API Key (first 10 chars): ${process.env.GEMINI_API_KEY?.substring(0, 10)}...`);

// Helper to pick a supported model from the provider list
async function chooseModelAndInit() {
  const preferred = [
    process.env.GEMINI_MODEL, // allow explicit override via env
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash'
  ].filter(Boolean);

  // Note: listModels is not available in this SDK version, skip model discovery
  MODEL_ID = preferred[0] || 'gemini-2.5-flash';
  console.log(`🤖 Using preferred model: ${MODEL_ID}`);

  // Create generative model with tuned config
  model = genAI.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 16,
      maxOutputTokens: 1024
    }
  });

  console.log(`✅ Model initialized: ${MODEL_ID}`);
}

async function fallbackToNextModel() {
  if (modelFallbackIndex < MODELS.length - 1) {
    modelFallbackIndex++;
    console.log(`🔄 Falling back to model: ${MODELS[modelFallbackIndex]}`);
    MODEL_ID = MODELS[modelFallbackIndex];
    
    // Re-initialize model with new ID
    model = genAI.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 16,
        maxOutputTokens: 1024
      }
    });
    
    console.log(`✅ Fallback model initialized: ${MODEL_ID}`);
    return true;
  }
  return false;
}

// --- Healthcheck ---
app.get('/health', (req, res) => {
  const ok = Boolean(process.env.GEMINI_API_KEY) && Boolean(MODEL_ID);
  res.status(ok ? 200 : 500).json({
    status: ok ? 'ok' : 'error',
    model: MODEL_ID,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    port
  });
});

// --- List Available Models ---
app.get('/api/list-models', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(401).json({ error: 'GEMINI_API_KEY not configured' });
    }
    
    console.log('Fetching available models...');
    const models = await genAI.listModels();
    
    const modelInfo = models.map(model => ({
      name: model.name,
      displayName: model.displayName,
      supportedMethods: model.supportedGenerationMethods,
      inputTokenLimit: model.inputTokenLimit,
      outputTokenLimit: model.outputTokenLimit
    }));
    
    console.log('Available models:', modelInfo.length);
    res.json({ models: modelInfo, currentModel: MODEL_ID });
    
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ 
      error: 'Failed to list models', 
      details: error.message 
    });
  }
});

/**
 * Converts a base64 encoded image string to a GoogleGenerativeAI.Part object.
 */
function base64ToGenerativePart(base64Image) {
  const match = base64Image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid base64 image string');
  }
  return {
    inlineData: {
      data: match[2],
      mimeType: match[1],
    },
  };
}

/**
 * A robust function to parse JSON from the model's text response.
 */
function parseJsonResponse(text) {
    // Remove any markdown code blocks
    let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');

    let jsonString;

    if (firstBracket !== -1 && lastBracket !== -1) {
        jsonString = cleanText.substring(firstBracket, lastBracket + 1);
    } else if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = cleanText.substring(firstBrace, lastBrace + 1);
    } else {
        // Try to parse the entire cleaned text
        try {
            return JSON.parse(cleanText);
        } catch (e) {
            throw new Error("No valid JSON found in response");
        }
    }
    return JSON.parse(jsonString);
}


// --- API Endpoints ---

// Helper function to retry API calls with exponential backoff and model fallback
async function retryWithBackoff(apiCall, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.status, error.statusText);
      
      // For 503 errors, try fallback model after first attempt
      if (error.status === 503 && attempt === 1) {
        console.log(`🔄 Model ${MODEL_ID} overloaded, trying fallback...`);
        if (await fallbackToNextModel()) {
          console.log(`🔄 Retrying with ${MODEL_ID}...`);
          continue; // Try again with new model
        }
      }
      
      // If it's the last attempt or not a retryable error, throw
      if (attempt === maxRetries || (error.status !== 503 && error.status !== 429)) {
        throw error;
      }
      
      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// === NEW AI INSIGHTS ENDPOINTS ===

// Daily insights endpoint
app.post('/api/ai-insights/daily', async (req, res) => {
  try {
    const { todayData, goals, userProfile } = req.body;
    
    if (!todayData) {
      return res.status(400).json({ error: 'Today\'s nutrition data is required.' });
    }

    const prompt = `As a nutrition AI assistant, analyze today's eating data and provide personalized daily insights.

USER PROFILE:
- Age: ${userProfile?.age || 'Unknown'}
- Gender: ${userProfile?.gender || 'Unknown'}
- Activity Level: ${userProfile?.activityLevel || 'Unknown'}
- Goal: ${userProfile?.goal || 'Unknown'}

TODAY'S DATA:
- Calories: ${todayData.totals?.calories || 0}/${goals?.calories || 2000}
- Protein: ${todayData.totals?.protein || 0}g/${goals?.protein || 120}g
- Carbs: ${todayData.totals?.carbs || 0}g
- Fat: ${todayData.totals?.fat || 0}g
- Meals logged: ${Object.keys(todayData.meals || {}).filter(meal => todayData.meals[meal]?.length > 0).length}

FOODS CONSUMED:
${Object.entries(todayData.meals || {}).map(([meal, foods]) => 
  `${meal}: ${foods.map(f => f.name).join(', ')}`
).join('\n')}

Provide insights as JSON:
{
  "calorieStatus": "on-track|under|over",
  "proteinStatus": "excellent|good|needs-improvement",
  "mealTiming": "Comment on meal distribution",
  "nutritionBalance": "Assessment of macro balance",
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "nextMealSuggestion": "Specific suggestion for next meal",
  "healthScore": number_0_to_100
}

Keep recommendations specific and actionable. Focus on helping achieve their goals.`;

    const result = await retryWithBackoff(() => model.generateContent([prompt]), 3, 500);
    const text = result.response.text();
    console.log('Daily Insights Response:', text);

    res.json(parseJsonResponse(text));
  } catch (error) {
    console.error('Error in daily insights:', error);
    res.status(500).json({ error: 'Failed to generate daily insights' });
  }
});

// Weekly analysis endpoint
app.post('/api/ai-insights/weekly', async (req, res) => {
  try {
    const { weeklyData, goals, userProfile } = req.body;
    
    if (!weeklyData || !Array.isArray(weeklyData)) {
      return res.status(400).json({ error: 'Weekly nutrition data array is required.' });
    }

    const totalDays = weeklyData.length;
    const avgCalories = weeklyData.reduce((sum, day) => sum + (day.totals?.calories || 0), 0) / totalDays;
    const avgProtein = weeklyData.reduce((sum, day) => sum + (day.totals?.protein || 0), 0) / totalDays;
    const daysOnTrack = weeklyData.filter(day => {
      const calories = day.totals?.calories || 0;
      const goal = goals?.calories || 2000;
      return calories >= goal * 0.8 && calories <= goal * 1.2;
    }).length;

    const prompt = `Analyze this week's nutrition patterns and provide insights.

USER PROFILE:
- Goal: ${userProfile?.goal || 'Unknown'}
- Target daily calories: ${goals?.calories || 2000}
- Target daily protein: ${goals?.protein || 120}g

WEEKLY SUMMARY:
- Days logged: ${totalDays}/7
- Average calories: ${Math.round(avgCalories)}
- Average protein: ${Math.round(avgProtein)}g  
- Days on track: ${daysOnTrack}/${totalDays}

DAILY BREAKDOWN:
${weeklyData.map((day, i) => 
  `Day ${i+1}: ${day.totals?.calories || 0}cal, ${day.totals?.protein || 0}g protein`
).join('\n')}

Provide analysis as JSON:
{
  "consistencyScore": number_0_to_100,
  "trendDirection": "improving|stable|declining",
  "strongestDay": "day_name_or_number",
  "weakestDay": "day_name_or_number", 
  "patterns": ["pattern1", "pattern2"],
  "weeklyGoalStatus": "excellent|good|needs-work",
  "improvementAreas": ["area1", "area2"],
  "nextWeekFocus": "specific_focus_area",
  "motivationalMessage": "encouraging_message"
}`;

    const result = await retryWithBackoff(() => model.generateContent([prompt]), 3, 500);
    const text = result.response.text();
    console.log('Weekly Analysis Response:', text);

    res.json(parseJsonResponse(text));
  } catch (error) {
    console.error('Error in weekly analysis:', error);
    res.status(500).json({ error: 'Failed to generate weekly analysis' });
  }
});

// Monthly trends endpoint
app.post('/api/ai-insights/monthly', async (req, res) => {
  try {
    const { monthlyData, bodyMetrics, goals, userProfile } = req.body;
    
    if (!monthlyData) {
      return res.status(400).json({ error: 'Monthly nutrition data is required.' });
    }

    const totalDays = Object.keys(monthlyData).length;
    const totalCalories = Object.values(monthlyData).reduce((sum, day) => sum + (day.totals?.calories || 0), 0);
    const avgDaily = totalCalories / totalDays;
    
    const weightChange = bodyMetrics?.weightChange30d || 0;
    const weightTrend = weightChange > 0.5 ? 'gaining' : weightChange < -0.5 ? 'losing' : 'stable';

    const prompt = `Analyze long-term nutrition trends and provide comprehensive monthly insights.

USER PROFILE & GOALS:
- Primary goal: ${userProfile?.goal || 'Unknown'}
- Target weight: ${userProfile?.targetWeight || 'Unknown'}
- Current weight trend: ${weightTrend} (${weightChange}kg change)

MONTHLY STATISTICS:
- Days logged: ${totalDays}
- Average daily calories: ${Math.round(avgDaily)}
- Target daily calories: ${goals?.calories || 2000}
- Weight change: ${weightChange}kg

GOAL ALIGNMENT:
${userProfile?.goal === 'lose-weight' ? 'Should be in caloric deficit' :
  userProfile?.goal === 'gain-weight' ? 'Should be in caloric surplus' :
  'Should maintain caloric balance'}

Provide comprehensive analysis as JSON:
{
  "overallProgress": "excellent|good|fair|needs-improvement",
  "calorieConsistency": number_0_to_100,
  "goalAlignment": "on-track|slightly-off|needs-adjustment",
  "weightTrendAnalysis": "analysis_of_weight_changes",
  "nutritionQuality": "assessment_of_food_choices",
  "longestStreak": number_of_consecutive_days,
  "monthlyHighlights": ["highlight1", "highlight2"],
  "areasForImprovement": ["area1", "area2"],
  "nextMonthStrategy": "strategic_recommendations",
  "motivationBoost": "encouraging_long_term_perspective"
}`;

    const result = await retryWithBackoff(() => model.generateContent([prompt]), 3, 500);
    const text = result.response.text();
    console.log('Monthly Trends Response:', text);

    res.json(parseJsonResponse(text));
  } catch (error) {
    console.error('Error in monthly trends:', error);
    res.status(500).json({ error: 'Failed to generate monthly trends' });
  }
});

// Personalized recommendations endpoint
app.post('/api/ai-insights/recommendations', async (req, res) => {
  try {
    const { recentData, bodyMetrics, goals, userProfile, preferences } = req.body;

    const prompt = `Generate personalized nutrition recommendations based on comprehensive user data.

USER PROFILE:
- Age: ${userProfile?.age}, Gender: ${userProfile?.gender}
- Goal: ${userProfile?.goal}
- Activity level: ${userProfile?.activityLevel}
- Current weight: ${bodyMetrics?.currentWeight}kg
- Target weight: ${bodyMetrics?.targetWeight}kg

CURRENT PERFORMANCE:
- Average daily calories: ${recentData?.avgCalories || 0}
- Average protein: ${recentData?.avgProtein || 0}g
- Consistency score: ${recentData?.consistencyScore || 0}%

FOOD PREFERENCES:
${preferences?.culturalPreference ? `Cultural preference: ${preferences.culturalPreference}` : ''}
${preferences?.dietaryRestrictions ? `Restrictions: ${preferences.dietaryRestrictions}` : ''}

Generate recommendations as JSON:
{
  "macroRecommendations": {
    "calories": "specific_calorie_guidance",
    "protein": "protein_intake_advice", 
    "carbs": "carbohydrate_guidance",
    "fats": "healthy_fats_advice"
  },
  "mealTimingAdvice": "when_and_how_to_eat",
  "foodSuggestions": {
    "highProtein": ["food1", "food2", "food3"],
    "nutrientDense": ["food1", "food2", "food3"],
    "goalAligned": ["food1", "food2", "food3"]
  },
  "habitChanges": ["small_habit1", "small_habit2"],
  "supplementSuggestions": ["suggestion1", "suggestion2"],
  "mealPrepTips": ["tip1", "tip2"],
  "progressOptimization": "how_to_accelerate_results"
}

Keep suggestions practical, culturally appropriate, and goal-specific.`;

    const result = await retryWithBackoff(() => model.generateContent([prompt]), 3, 500);
    const text = result.response.text();
    console.log('Recommendations Response:', text);

    res.json(parseJsonResponse(text));
  } catch (error) {
    console.error('Error in recommendations:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// === END NEW AI INSIGHTS ENDPOINTS ===

// Endpoint for text/natural-language meal description analysis
app.post('/api/analyze-text', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Description text is required.' });
    }

    const prompt = `You are a nutrition parsing assistant.
Given a short natural-language meal description, extract one or more food items with estimated nutrition.
Return ONLY a minified JSON array, no extra text.
Format:
[{"foodName":"FOOD_NAME","portionGrams":GRAMS,"unit":"g","gramsPerPiece":OPTIONAL_NUMBER,"nutrients":{"calories":NUM,"proteinGrams":NUM,"carbsGrams":NUM,"fatGrams":NUM}}]
Rules:
- Convert volumes/pieces to grams when reasonable; include gramsPerPiece if it’s a countable food.
- Keep array concise and realistic.
- If ambiguous, choose the most common interpretation.
Description: ${description}`;

    const startTime = Date.now();
    const result = await retryWithBackoff(() => model.generateContent([prompt]), 3, 500);
    const duration = Date.now() - startTime;
    console.log(`⏱️ /api/analyze-text completed in ${duration}ms`);

    const text = result.response.text();
    console.log(`[Model: ${MODEL_ID}] Analyze-Text Raw Response:`, text);

    res.json(parseJsonResponse(text));
  } catch (error) {
    console.error(`Error in /api/analyze-text [model=${MODEL_ID}]:`, error);
    const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : error?.status === 503 ? 503 : 500;
    const message =
      status === 401 ? 'Invalid or missing API key.' :
      status === 429 ? 'Rate limit exceeded. Please try again later.' :
      status === 503 ? 'AI service is temporarily overloaded. Please try again in a moment.' :
      'An error occurred during description analysis.';
    res.status(status).json({ error: message, details: error?.statusText || undefined });
  }
});

// Endpoint for initial image analysis
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    const prompt = `Analyze this food image and return nutrition data as JSON:
[{"foodName":"FOOD_NAME","portionGrams":GRAMS,"unit":"g","nutrients":{"calories":NUM,"proteinGrams":NUM,"carbsGrams":NUM,"fatGrams":NUM}}]
Return only the JSON array, no other text.`;

    const imagePart = base64ToGenerativePart(image);
    
    // Add timing for performance monitoring
    const startTime = Date.now();
    console.log('🚀 Starting API request to Gemini...');
    
  // Call model with short retry logic for transient errors
  const result = await retryWithBackoff(() => model.generateContent([prompt, imagePart]), 3, 500);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`⏱️ API request completed in ${duration}ms`);
    
    const text = result.response.text();
    console.log(`[Model: ${MODEL_ID}] Initial Analysis Raw Response:`, text);

    res.json(parseJsonResponse(text));

  } catch (error) {
    console.error(`Error in /analyze-image [model=${MODEL_ID}]:`, error);
    const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : error?.status === 503 ? 503 : 500;
    const message =
      status === 401 ? 'Invalid or missing API key.' :
      status === 429 ? 'Rate limit exceeded. Please try again later.' :
      status === 503 ? 'AI service is temporarily overloaded. Please try again in a moment.' :
      'An error occurred during analysis.';
    res.status(status).json({ error: message, details: error?.statusText || undefined });
  }
});

// NEW Endpoint for refining the analysis with user feedback
app.post('/api/refine-image', async (req, res) => {
    try {
        const { image, correction } = req.body;
        if (!image || !correction) {
            return res.status(400).json({ error: 'Image and correction text are required.' });
        }

        const prompt = `
            You are a world-class nutritionist. Your initial analysis of the attached image may have been incorrect. A user has provided a correction.
            
            **User's Correction:** "${correction}"

            Now, re-analyze the image with this new information. Provide an updated, highly accurate JSON array of all food items, paying close attention to the user's feedback.
            
            - For EACH item, you MUST provide a foodName, an estimate for all four nutritional values, a default unit, and "gramsPerPiece" if it's a countable item.
            - The format for your response MUST be a single, minified JSON array like this:
            [{"foodName":"Paneer Butter Masala","portionGrams":150,"unit":"g","gramsPerPiece":150,"nutrients":{"calories":350,"proteinGrams":18,"carbsGrams":12,"fatGrams":25}}]
        `;

        const imagePart = base64ToGenerativePart(image);
        
        // Use retry mechanism for the API call
        const result = await retryWithBackoff(async () => {
          return await model.generateContent([prompt, imagePart]);
        });
        
        const text = result.response.text();
        console.log(`[Model: ${MODEL_ID}] Refined Analysis Raw Response:`, text);
        
        res.json(parseJsonResponse(text));

    } catch (error) {
        console.error(`Error in /refine-image [model=${MODEL_ID}]:`, error);
        const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : error?.status === 503 ? 503 : 500;
        const message =
          status === 401 ? 'Invalid or missing API key.' :
          status === 429 ? 'Rate limit exceeded. Please try again later.' :
          status === 503 ? 'AI service is temporarily overloaded. Please try again in a moment.' :
          'An error occurred during refinement.';
        res.status(status).json({ error: message, details: error?.statusText || undefined });
    }
});


// --- Start Server (initialize model first) ---
(async () => {
  try {
    await chooseModelAndInit();
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error('Fatal error during server initialization:', err);
    // Still attempt to start server so it can respond with errors
    app.listen(port, () => {
      console.log(`Server started (model may be uninitialized) at http://localhost:${port}`);
    });
  }
})();