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
// Configure for v1 API endpoint with base URL override
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
  baseUrl: 'https://generativelanguage.googleapis.com/v1'
});
// Use gemini-2.5-flash which is confirmed available with the current API key
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
console.log(`🤖 Using Gemini model: ${MODEL_ID}`);
console.log(`🔑 API Key configured: ${Boolean(process.env.GEMINI_API_KEY)}`);
console.log(`🔑 API Key (first 10 chars): ${process.env.GEMINI_API_KEY?.substring(0, 10)}...`);

// Configure model with specific options
const model = genAI.getGenerativeModel({ 
  model: MODEL_ID,
  generationConfig: {
    temperature: 0.1,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 2048,
  }
});

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
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    let jsonString;

    if (firstBracket !== -1 && lastBracket !== -1) {
        jsonString = text.substring(firstBracket, lastBracket + 1);
    } else if (firstBrace !== -1 && lastBrace !== -1) {
        jsonString = text.substring(firstBrace, lastBrace + 1);
    } else {
        throw new Error("No valid JSON found in response");
    }
    return JSON.parse(jsonString);
}


// --- API Endpoints ---

// Endpoint for initial image analysis
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'No image provided.' });
    }

    const prompt = `
      You are an expert nutritionist. Analyze the image of the meal.
      - First, determine if the image contains a composite dish (like 'Egg Fried Rice') or separate, distinct items (like 'an egg, a bowl of rice').
      - If it is a composite dish, identify it as a SINGLE item.
      - If they are separate items, identify ALL distinct food items.
      - For EACH item, you MUST provide an estimate for all four nutritional values: calories, proteinGrams, carbsGrams, and fatGrams. Also, provide a default unit ('g', 'ml', or 'pcs').
      - If the item is countable (like a dosa or an egg), you MUST also provide a "gramsPerPiece" field with the estimated weight of a single piece.
      - If a value is negligible but not zero, estimate it as a small number (e.g., 0.5). Do not omit any fields.
      - Respond ONLY with a single, minified JSON array.
      - The format for each object MUST be:
        {"foodName": "...", "portionGrams": ..., "unit": "...", "gramsPerPiece": ..., "nutrients": {"calories": ..., "proteinGrams": ..., "carbsGrams": ..., "fatGrams": ...}}
      - If the image does not contain any identifiable food, respond with:
        {"error": "Could not identify any food items in the image."}
    `;

    const imagePart = base64ToGenerativePart(image);
  const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();
  console.log(`[Model: ${MODEL_ID}] Initial Analysis Raw Response:`, text);

    res.json(parseJsonResponse(text));

  } catch (error) {
    console.error(`Error in /analyze-image [model=${MODEL_ID}]:`, error);
    const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : 500;
    const message =
      status === 401 ? 'Invalid or missing API key.' :
      status === 429 ? 'Rate limit exceeded. Please retry later.' :
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
  const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();
  console.log(`[Model: ${MODEL_ID}] Refined Analysis Raw Response:`, text);
        
        res.json(parseJsonResponse(text));

  } catch (error) {
    console.error(`Error in /refine-image [model=${MODEL_ID}]:`, error);
    const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : 500;
    const message =
      status === 401 ? 'Invalid or missing API key.' :
      status === 429 ? 'Rate limit exceeded. Please retry later.' :
      'An error occurred during refinement.';
    res.status(status).json({ error: message, details: error?.statusText || undefined });
  }
});


// --- Start Server ---
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});