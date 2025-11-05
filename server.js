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
 * Simple function to parse food detection JSON arrays.
 */
function parseSimpleJsonArray(text) {
    console.log('🔍 Parsing simple JSON array, length:', text?.length, 'characters');
    console.log('🔍 Raw response start:', text?.substring(0, 200) + '...');
    
    // Remove any markdown code blocks
    let cleanText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
    
    // For simple arrays, try direct parsing first
    try {
        const parsed = JSON.parse(cleanText);
        console.log('✅ Direct JSON parse successful:', parsed);
        return parsed;
    } catch (e) {
        console.log('❌ Direct parse failed:', e.message);
        
        // Find array boundaries
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        
        if (firstBracket === -1 || lastBracket === -1 || firstBracket >= lastBracket) {
            console.log('❌ No valid JSON array found');
            throw new Error("No valid JSON array found in response");
        }
        
        const arrayString = cleanText.substring(firstBracket, lastBracket + 1);
        
        try {
            const parsed = JSON.parse(arrayString);
            console.log('✅ Array extraction successful:', parsed);
            return parsed;
        } catch (arrayError) {
            console.log('❌ Array extraction failed:', arrayError.message);
            throw new Error("Invalid JSON array in response");
        }
    }
}

/**
 * A robust function to parse JSON from the model's text response.
 */
function parseJsonResponse(text) {
    console.log('🔍 Raw API response length:', text?.length, 'characters');
    console.log('🔍 Raw API response start:', text?.substring(0, 300) + '...');
    
    // Remove any markdown code blocks and clean the text
    let cleanText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
    
    // Find JSON boundaries more carefully
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
        console.log('❌ No valid JSON object found in response');
        throw new Error("No valid JSON found in response");
    }
    
    let jsonString = cleanText.substring(firstBrace, lastBrace + 1);
    
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.log('❌ Initial JSON parse failed:', e.message);
        console.log('❌ Problematic JSON substring:', jsonString.substring(0, 500) + '...');
        
        // Advanced JSON repair attempts
        try {
            let fixedJson = jsonString;
            
            // Remove control characters and fix encoding issues
            fixedJson = fixedJson.replace(/[\x00-\x1F\x7F]/g, '');
            
            // Fix truncated strings by finding incomplete quotes and closing them
            const lines = fixedJson.split('\n');
            const repairedLines = [];
            let inString = false;
            let braceCount = 0;
            let bracketCount = 0;
            
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                let repairedLine = '';
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    
                    if (char === '"' && (j === 0 || line[j-1] !== '\\')) {
                        inString = !inString;
                    } else if (!inString) {
                        if (char === '{') braceCount++;
                        else if (char === '}') braceCount--;
                        else if (char === '[') bracketCount++;
                        else if (char === ']') bracketCount--;
                    }
                    
                    repairedLine += char;
                }
                
                // If we're in a string at the end of a line and it's not the last line, close it
                if (inString && i < lines.length - 1) {
                    repairedLine += '"';
                    inString = false;
                    // Add a comma if needed
                    if (!repairedLine.trim().endsWith(',') && !repairedLine.trim().endsWith('{') && !repairedLine.trim().endsWith('[')) {
                        repairedLine += ',';
                    }
                }
                
                repairedLines.push(repairedLine);
            }
            
            fixedJson = repairedLines.join('\n');
            
            // Close any unclosed arrays or objects
            while (bracketCount > 0) {
                fixedJson += ']';
                bracketCount--;
            }
            while (braceCount > 0) {
                fixedJson += '}';
                braceCount--;
            }
            
            // Remove trailing commas
            fixedJson = fixedJson
                .replace(/,(\s*[\]}])/g, '$1')
                .replace(/,\s*$/, '');
            
            console.log('🔧 Attempting advanced JSON repair...');
            console.log('🔧 Repaired JSON start:', fixedJson.substring(0, 300) + '...');
            
            return JSON.parse(fixedJson);
            
        } catch (fixError) {
            console.log('❌ Advanced JSON repair failed:', fixError.message);
            
            // Last resort: try to extract what we can field by field
            try {
                console.log('🔧 Attempting field-by-field extraction...');
                const result = {};
                
                // Extract simple fields
                const extractField = (fieldName, defaultValue = null) => {
                    const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, 'i');
                    const match = jsonString.match(regex);
                    return match ? match[1] : defaultValue;
                };
                
                const extractNumberField = (fieldName, defaultValue = 0) => {
                    const regex = new RegExp(`"${fieldName}"\\s*:\\s*(\\d+)`, 'i');
                    const match = jsonString.match(regex);
                    return match ? parseInt(match[1]) : defaultValue;
                };
                
                result.calorieStatus = extractField('calorieStatus', 'unknown');
                result.proteinStatus = extractField('proteinStatus', 'unknown');
                result.mealTiming = extractField('mealTiming', 'Unable to determine meal timing');
                result.nutritionBalance = extractField('nutritionBalance', 'Unable to assess nutrition balance');
                result.nextMealSuggestion = extractField('nextMealSuggestion', 'Focus on balanced nutrition');
                result.healthScore = extractNumberField('healthScore', 50);
                
                // For arrays and objects, provide defaults
                result.recommendations = ['Focus on meeting your calorie goals', 'Increase protein intake', 'Maintain consistent meal timing'];
                result.mealRecommendations = {
                    breakfast: 'Include protein-rich foods',
                    lunch: 'Balance carbs and protein',
                    dinner: 'Lean protein with vegetables',
                    snack: 'Healthy protein snack'
                };
                result.specificInsights = ['Unable to extract specific insights due to parsing error'];
                
                console.log('✅ Field-by-field extraction successful');
                return result;
                
            } catch (extractError) {
                console.log('❌ Field extraction failed:', extractError.message);
                throw new Error("Complete JSON parsing failure");
            }
        }
    }
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

    const prompt = `As a nutrition AI assistant, analyze today's eating data and provide highly personalized daily insights using SPECIFIC DATA from the user's actual consumption.

USER PROFILE:
- Age: ${userProfile?.age || 'Unknown'}
- Gender: ${userProfile?.gender || 'Unknown'}
- Activity Level: ${userProfile?.activityLevel || 'Unknown'}
- Goal: ${userProfile?.goal || 'Unknown'}

TODAY'S ACTUAL DATA:
- Calories consumed: ${todayData.totals?.calories || 0} out of ${goals?.calories || 2000} goal (${Math.round(((todayData.totals?.calories || 0) / (goals?.calories || 2000)) * 100)}%)
- Protein consumed: ${todayData.totals?.protein || 0}g out of ${goals?.protein || 120}g goal (${Math.round(((todayData.totals?.protein || 0) / (goals?.protein || 120)) * 100)}%)
- Carbs: ${todayData.totals?.carbs || 0}g, Fat: ${todayData.totals?.fat || 0}g
- Meals logged: ${Object.keys(todayData.meals || {}).filter(meal => todayData.meals[meal]?.length > 0).length}/4

SPECIFIC FOODS CONSUMED TODAY:
${Object.entries(todayData.meals || {}).map(([meal, foods]) => 
  `${meal.charAt(0).toUpperCase() + meal.slice(1)}: ${foods.length > 0 ? foods.map(f => `${f.name} (${f.calories || 0} cal, ${f.protein || 0}g protein)`).join(', ') : 'No foods logged'}`
).join('\n')}

INSTRUCTIONS: 
- Reference SPECIFIC foods, numbers, and percentages from today's data
- Make meal recommendations based on what they've actually eaten
- Use their actual calorie/protein numbers in insights
- Mention specific foods they consumed today
- Base recommendations on their actual eating patterns
- IMPORTANT: Keep all text fields CONCISE (under 100 characters each)
- Ensure proper JSON formatting with escaped quotes

Provide concise insights as valid JSON:
{
  "calorieStatus": "on-track|under|over",
  "proteinStatus": "excellent|good|needs-improvement", 
  "mealTiming": "Brief comment on meal distribution",
  "nutritionBalance": "Brief assessment with actual numbers",
  "recommendations": [
    "Short recommendation 1 with data",
    "Short recommendation 2 with data", 
    "Short recommendation 3 with data"
  ],
  "nextMealSuggestion": "Brief meal suggestion",
  "healthScore": number_0_to_100,
  "mealRecommendations": {
    "breakfast": "Brief breakfast suggestion",
    "lunch": "Brief lunch suggestion",
    "dinner": "Brief dinner suggestion",
    "snack": "Brief snack suggestion"
  },
  "specificInsights": [
    "Brief insight about food eaten",
    "Brief insight about numbers",
    "Brief insight about pattern"
  ]
}

Keep recommendations highly personalized using their actual data. Always reference specific foods, calories, or percentages.`;

    try {
      // Add specific generation config to limit response length
      const generationConfig = {
        maxOutputTokens: 800, // Limit response length
        temperature: 0.3,     // Lower temperature for more consistent JSON
      };
      
      const result = await retryWithBackoff(() => 
        model.generateContent([prompt], { generationConfig }), 3, 500);
      const text = result.response.text();
      console.log('Daily Insights Response:', text);

      const insights = parseJsonResponse(text);
      
      // Validate that we have the required fields
      if (!insights || typeof insights !== 'object') {
        throw new Error('Invalid insights object received');
      }
      
      // Ensure we have all required fields with defaults
      const validatedInsights = {
        calorieStatus: insights.calorieStatus || 'unknown',
        proteinStatus: insights.proteinStatus || 'unknown',
        mealTiming: insights.mealTiming || `You've logged ${Object.keys(todayData.meals || {}).filter(meal => todayData.meals[meal]?.length > 0).length} meals today.`,
        nutritionBalance: insights.nutritionBalance || `You've consumed ${todayData.totals?.calories || 0} calories and ${todayData.totals?.protein || 0}g protein.`,
        recommendations: Array.isArray(insights.recommendations) ? insights.recommendations : [
          `You have ${Math.max(0, (goals?.calories || 2000) - (todayData.totals?.calories || 0))} calories remaining today`,
          `Add ${Math.max(0, (goals?.protein || 120) - (todayData.totals?.protein || 0))}g more protein to reach your goal`,
          'Focus on balanced meals with protein, carbs, and healthy fats'
        ],
        nextMealSuggestion: insights.nextMealSuggestion || 'Include a lean protein source with vegetables and complex carbs',
        healthScore: typeof insights.healthScore === 'number' ? insights.healthScore : 50,
        mealRecommendations: insights.mealRecommendations || {
          breakfast: "Greek yogurt with berries and nuts",
          lunch: "Grilled chicken salad with quinoa",
          dinner: "Salmon with roasted vegetables",
          snack: "Handful of almonds or protein smoothie"
        },
        specificInsights: Array.isArray(insights.specificInsights) ? insights.specificInsights : [
          `Today you consumed ${todayData.totals?.calories || 0} calories`,
          `Your protein intake is ${todayData.totals?.protein || 0}g`,
          `You logged ${Object.keys(todayData.meals || {}).filter(meal => todayData.meals[meal]?.length > 0).length} meals`
        ]
      };
      
      res.json(validatedInsights);
    } catch (parseError) {
      console.log('⚠️ AI response parsing failed, providing fallback insights');
      
      // Generate fallback insights based on the data
      const calorieGoal = goals?.calories || 2000;
      const currentCalories = todayData.totals?.calories || 0;
      const proteinGoal = goals?.protein || 120;
      const currentProtein = todayData.totals?.protein || 0;
      
      const fallbackInsights = {
        calorieStatus: currentCalories < calorieGoal * 0.8 ? 'under' : 
                     currentCalories > calorieGoal * 1.2 ? 'over' : 'on-track',
        proteinStatus: currentProtein >= proteinGoal * 0.9 ? 'excellent' :
                      currentProtein >= proteinGoal * 0.7 ? 'good' : 'needs-improvement',
        mealTiming: `You've logged ${Object.keys(todayData.meals || {}).filter(meal => todayData.meals[meal]?.length > 0).length} meals today out of 4 possible meals.`,
        nutritionBalance: `You've consumed ${currentCalories} calories (${Math.round((currentCalories/calorieGoal)*100)}% of goal) and ${currentProtein}g protein (${Math.round((currentProtein/proteinGoal)*100)}% of goal).`,
        recommendations: [
          `You need ${Math.max(0, calorieGoal - currentCalories)} more calories to reach your ${calorieGoal} calorie goal`,
          `Add ${Math.max(0, proteinGoal - currentProtein)}g more protein to hit your ${proteinGoal}g target`,
          'Focus on whole foods and balanced meals for optimal nutrition'
        ],
        nextMealSuggestion: currentProtein < proteinGoal * 0.7 ? 
          'Include a high-protein food like chicken, fish, eggs, or Greek yogurt in your next meal' :
          'Add some vegetables and complex carbs to balance your nutrition',
        healthScore: Math.min(100, Math.max(20, Math.round((currentCalories / calorieGoal) * 50 + (currentProtein / proteinGoal) * 30 + 20))),
        mealRecommendations: {
          breakfast: "Greek yogurt with berries and nuts for protein and antioxidants",
          lunch: "Grilled chicken salad with mixed vegetables and quinoa",
          dinner: "Salmon with roasted vegetables and sweet potato",
          snack: currentProtein < proteinGoal ? "Protein smoothie or handful of almonds" : "Fresh fruit or vegetable sticks"
        },
        specificInsights: [
          `Today you've eaten ${currentCalories} calories, which is ${currentCalories < calorieGoal ? 'below' : currentCalories > calorieGoal ? 'above' : 'on track with'} your goal`,
          `Your protein intake of ${currentProtein}g is ${currentProtein >= proteinGoal ? 'meeting' : 'below'} your target`,
          `You've logged food for ${Object.keys(todayData.meals || {}).filter(meal => todayData.meals[meal]?.length > 0).length} out of 4 meal times`
        ]
      };
      
      res.json(fallbackInsights);
    }
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

    const prompt = `Analyze this week's nutrition patterns and provide insights using SPECIFIC DATA from the user's weekly consumption.

USER PROFILE:
- Goal: ${userProfile?.goal || 'Unknown'}
- Target daily calories: ${goals?.calories || 2000}
- Target daily protein: ${goals?.protein || 120}g

WEEKLY ACTUAL DATA:
- Days logged: ${totalDays}/7 days
- Average calories: ${Math.round(avgCalories)} (target: ${goals?.calories || 2000})
- Average protein: ${Math.round(avgProtein)}g (target: ${goals?.protein || 120}g)  
- Days meeting calorie goals: ${daysOnTrack}/${totalDays} (${Math.round((daysOnTrack/totalDays)*100)}%)
- Total weekly calories: ${Math.round(avgCalories * totalDays)}
- Weekly protein total: ${Math.round(avgProtein * totalDays)}g

DAILY BREAKDOWN WITH SPECIFIC FOODS:
${weeklyData.map((day, i) => {
  const dayMeals = day.meals || {};
  const allFoods = Object.values(dayMeals).flat().map(f => f.name).slice(0, 3);
  return `Day ${i+1}: ${day.totals?.calories || 0}cal, ${day.totals?.protein || 0}g protein - Foods: ${allFoods.join(', ') || 'No foods logged'}`;
}).join('\n')}

INSTRUCTIONS:
- Reference specific numbers from their weekly data
- Mention actual foods they consumed
- Use their exact calorie and protein numbers
- Compare to their specific goals
- Keep all text fields CONCISE (under 80 characters each)

Provide concise analysis as valid JSON:
{
  "consistencyScore": number_0_to_100,
  "trendDirection": "improving|stable|declining",
  "strongestDay": "Brief day description with numbers",
  "weakestDay": "Brief day description with numbers", 
  "patterns": ["Brief pattern 1", "Brief pattern 2"],
  "weeklyGoalStatus": "excellent|good|needs-work",
  "improvementAreas": ["Brief area 1", "Brief area 2"],
  "nextWeekFocus": "Brief focus with data",
  "motivationalMessage": "Brief encouraging message with numbers",
  "weeklyHighlights": ["Brief highlight 1", "Brief highlight 2"],
  "actualDataInsights": [
    "Brief insight about calories",
    "Brief insight about goals met",
    "Brief insight about foods"
  ]
}`;

    try {
      // Add specific generation config to limit response length
      const generationConfig = {
        maxOutputTokens: 600, // Limit response length for weekly
        temperature: 0.3,     // Lower temperature for more consistent JSON
      };
      
      const result = await retryWithBackoff(() => 
        model.generateContent([prompt], { generationConfig }), 3, 500);
      const text = result.response.text();
      console.log('Weekly Analysis Response:', text);

      const insights = parseJsonResponse(text);
      
      // Validate and ensure required fields
      const validatedInsights = {
        consistencyScore: typeof insights.consistencyScore === 'number' ? insights.consistencyScore : Math.round((daysOnTrack / totalDays) * 100),
        trendDirection: insights.trendDirection || 'stable',
        strongestDay: insights.strongestDay || `Day with highest calories`,
        weakestDay: insights.weakestDay || `Day with lowest calories`,
        patterns: Array.isArray(insights.patterns) ? insights.patterns : [`${daysOnTrack}/${totalDays} days met calorie goals`],
        weeklyGoalStatus: insights.weeklyGoalStatus || (daysOnTrack >= totalDays * 0.7 ? 'good' : 'needs-work'),
        improvementAreas: Array.isArray(insights.improvementAreas) ? insights.improvementAreas : ['Consistency', 'Protein intake'],
        nextWeekFocus: insights.nextWeekFocus || 'Focus on hitting daily goals consistently',
        motivationalMessage: insights.motivationalMessage || `You averaged ${Math.round(avgCalories)} calories this week!`,
        weeklyHighlights: Array.isArray(insights.weeklyHighlights) ? insights.weeklyHighlights : [`${daysOnTrack} days on track`, `${Math.round(avgCalories)} average calories`],
        actualDataInsights: Array.isArray(insights.actualDataInsights) ? insights.actualDataInsights : [
          `You averaged ${Math.round(avgCalories)} calories this week`,
          `${daysOnTrack} out of ${totalDays} days met your goals`,
          `Your average protein was ${Math.round(avgProtein)}g`
        ]
      };
      
      res.json(validatedInsights);
    } catch (parseError) {
      console.log('⚠️ Weekly AI response parsing failed, providing fallback insights');
      
      const consistencyScore = Math.round((daysOnTrack / totalDays) * 100);
      const avgCalorieGoal = goals?.calories || 2000;
      const isImproving = avgCalories >= avgCalorieGoal * 0.8;
      
      const fallbackInsights = {
        consistencyScore: consistencyScore,
        trendDirection: isImproving ? 'improving' : 'needs-work',
        strongestDay: weeklyData.length > 0 ? `Day ${weeklyData.findIndex(d => (d.totals?.calories || 0) === Math.max(...weeklyData.map(d => d.totals?.calories || 0))) + 1}` : 'Day 1',
        weakestDay: weeklyData.length > 0 ? `Day ${weeklyData.findIndex(d => (d.totals?.calories || 0) === Math.min(...weeklyData.map(d => d.totals?.calories || 0))) + 1}` : 'Day 1',
        patterns: ['Tracking patterns will become clearer with more data'],
        weeklyGoalStatus: consistencyScore >= 80 ? 'excellent' : consistencyScore >= 60 ? 'good' : 'needs-work',
        improvementAreas: ['Maintain consistent daily tracking', 'Focus on meeting calorie goals'],
        nextWeekFocus: 'Aim for more consistent daily nutrition tracking',
        motivationalMessage: `You tracked ${totalDays} days this week! Keep building this healthy habit.`
      };
      
      res.json(fallbackInsights);
    }
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

    try {
      const result = await retryWithBackoff(() => model.generateContent([prompt]), 3, 500);
      const text = result.response.text();
      console.log('Monthly Trends Response:', text);

      const insights = parseJsonResponse(text);
      res.json(insights);
    } catch (parseError) {
      console.log('⚠️ Monthly AI response parsing failed, providing fallback insights');
      
      const avgCalorieGoal = goals?.calories || 2000;
      const calorieConsistency = Math.round((avgDaily / avgCalorieGoal) * 100);
      const trackingConsistency = Math.round((totalDays / 30) * 100);
      
      const fallbackInsights = {
        overallProgress: trackingConsistency >= 80 ? 'good' : trackingConsistency >= 60 ? 'fair' : 'needs-improvement',
        calorieConsistency: Math.min(100, calorieConsistency),
        goalAlignment: Math.abs(avgDaily - avgCalorieGoal) <= avgCalorieGoal * 0.1 ? 'on-track' : 'slightly-off',
        weightTrendAnalysis: `Your weight trend is ${weightTrend} with a ${Math.abs(weightChange)}kg change this month.`,
        nutritionQuality: 'Continue focusing on balanced, nutritious meals',
        longestStreak: Math.min(totalDays, 7),
        monthlyHighlights: [
          `Tracked nutrition for ${totalDays} days this month`,
          `Maintained an average of ${Math.round(avgDaily)} calories daily`
        ],
        areasForImprovement: [
          'Increase tracking consistency',
          'Focus on meeting daily nutrition goals'
        ],
        nextMonthStrategy: 'Aim for more consistent daily tracking and balanced nutrition',
        motivationBoost: `You've made great progress tracking ${totalDays} days this month! Consistency is key to reaching your goals.`
      };
      
      res.json(fallbackInsights);
    }
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

    res.json(parseSimpleJsonArray(text));
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

    res.json(parseSimpleJsonArray(text));

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