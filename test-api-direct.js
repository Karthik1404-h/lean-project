const https = require('https');
require('dotenv').config();

async function testApiDirect() {
    console.log('🔍 Testing Gemini API directly...');
    console.log('🔑 API Key:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    
    if (!process.env.GEMINI_API_KEY) {
        console.log('❌ No API key found.');
        return;
    }
    
    // Test with v1 API endpoint directly
    const model = 'gemini-1.5-flash-latest';
    const payload = JSON.stringify({
        contents: [{
            parts: [{
                text: "Say hello in one word"
            }]
        }]
    });
    
    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };
    
    return new Promise((resolve, reject) => {
        console.log(`🧪 Testing v1 API with ${model}...`);
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (res.statusCode === 200) {
                        console.log('✅ v1 API works!');
                        console.log('Response:', response.candidates[0].content.parts[0].text);
                        
                        // Test fallback model
                        testFallbackModel();
                    } else {
                        console.log(`❌ v1 API failed (${res.statusCode}):`, response);
                        
                        if (res.statusCode === 404) {
                            console.log('🔧 Model not found - trying gemini-1.5-flash...');
                            testFallbackModel();
                        } else if (res.statusCode === 401) {
                            console.log('🔧 API key authentication failed');
                        }
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
        
        req.write(payload);
        req.end();
    });
}

function testFallbackModel() {
    const model = 'gemini-1.5-flash';
    const payload = JSON.stringify({
        contents: [{
            parts: [{
                text: "Say hello in one word"
            }]
        }]
    });
    
    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };
    
    console.log(`🧪 Testing fallback model: ${model}...`);
    
    const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                
                if (res.statusCode === 200) {
                    console.log(`✅ ${model} works!`);
                    console.log('Response:', response.candidates[0].content.parts[0].text);
                    console.log(`🎯 SOLUTION: Use model "${model}" in your server.js`);
                } else {
                    console.log(`❌ ${model} failed (${res.statusCode}):`, response);
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

testApiDirect();