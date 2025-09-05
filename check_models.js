// check_models.js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    console.log("Fetching available models for your API key...");
    const modelInfo = await genAI.listModels();

    console.log("--- Models Supporting 'generateContent' (Vision) ---");
    for (const m of modelInfo) {
      if (m.supportedGenerationMethods.includes("generateContent") && m.name.includes("vision")) {
        console.log(`- ${m.name}`);
      }
    }
    console.log("\n--- All Available Models ---");
    for (const m of modelInfo) {
        console.log(`- ${m.name}`);
    }

  } catch (error) {
    console.error("Error fetching models:", error);
  }
}

listModels();