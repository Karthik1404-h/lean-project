const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function testAPI() {
    console.log('🔍 Testing Gemini API...');
    console.log('🔑 API Key:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    
    if (!process.env.GEMINI_API_KEY) {
        console.log('❌ No API key found. Please check your .env file.');
        return;
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Test different models
    const modelsToTest = ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    
    for (const modelName of modelsToTest) {
        try {
            console.log(`🧪 Testing ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say "Hello" in one word');
            const response = result.response.text();
            console.log(`✅ ${modelName} works! Response: ${response}`);
            
            // If this model works, test with image
            if (modelName.includes('vision') || modelName.includes('1.5')) {
                console.log(`🖼️  Testing ${modelName} with image...`);
                // Create a simple test image (1x1 pixel red PNG)
                const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
                const imagePart = {
                    inlineData: {
                        data: testImage.split(',')[1],
                        mimeType: 'image/png',
                    },
                };
                const imageResult = await model.generateContent(['Describe this image briefly', imagePart]);
                const imageResponse = imageResult.response.text();
                console.log(`✅ ${modelName} image works! Response: ${imageResponse}`);
            }
            break; // If we find a working model, stop testing
            
        } catch (error) {
            console.log(`❌ ${modelName} failed:`, error.message);
            if (error.status === 401) {
                console.log('🔧 Authentication error - API key might be invalid');
                return;
            } else if (error.status === 403) {
                console.log('🔧 Permission error - API key might lack permissions');
                return;
            }
        }
    }
}

testAPI();