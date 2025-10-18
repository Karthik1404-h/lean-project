const https = require('https');
require('dotenv').config();

async function listAvailableModels() {
    console.log('🔍 Listing available models...');
    
    if (!process.env.GEMINI_API_KEY) {
        console.log('❌ No API key found.');
        return;
    }
    
    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1/models?key=${process.env.GEMINI_API_KEY}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ Available models:');
                        response.models.forEach(model => {
                            console.log(`  - ${model.name}`);
                            console.log(`    Display: ${model.displayName}`);
                            console.log(`    Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
                            
                            // Check if this model supports generateContent
                            if (model.supportedGenerationMethods?.includes('generateContent')) {
                                console.log(`    ✅ SUPPORTS IMAGE ANALYSIS`);
                            }
                            console.log('');
                        });
                        
                        // Find a model that supports generateContent
                        const workingModel = response.models.find(model => 
                            model.supportedGenerationMethods?.includes('generateContent')
                        );
                        
                        if (workingModel) {
                            console.log(`🎯 RECOMMENDED MODEL: ${workingModel.name}`);
                            testWorkingModel(workingModel.name);
                        }
                        
                    } else {
                        console.log(`❌ List models failed (${res.statusCode}):`, response);
                    }
                } catch (error) {
                    console.log('❌ JSON parse error:', error.message);
                    console.log('Raw response:', data);
                }
                resolve();
            });
        });
        
        req.on('error', (error) => {
            console.log('❌ Network error:', error.message);
            resolve();
        });
        
        req.end();
    });
}

function testWorkingModel(modelName) {
    console.log(`🧪 Testing working model: ${modelName}...`);
    
    const payload = JSON.stringify({
        contents: [{
            parts: [{
                text: "Say hello in one word"
            }]
        }]
    });
    
    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };
    
    const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                
                if (res.statusCode === 200) {
                    console.log(`✅ ${modelName} works!`);
                    console.log('Response:', response.candidates[0].content.parts[0].text);
                    console.log(`🎯 UPDATE YOUR SERVER.JS TO USE: "${modelName}"`);
                } else {
                    console.log(`❌ ${modelName} failed (${res.statusCode}):`, response);
                }
            } catch (error) {
                console.log('❌ JSON parse error:', error.message);
                console.log('Raw response:', data);
            }
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ Network error:', error.message);
    });
    
    req.write(payload);
    req.end();
}

listAvailableModels();