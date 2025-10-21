const tokenInput = document.getElementById('token-input');
const apiUrlInput = document.getElementById('api-url');
const audienceInput = document.getElementById('audience');
const verifyBtn = document.getElementById('verify-btn');
const demoBtn = document.getElementById('demo-btn');
const outputSection = document.getElementById('output');
const resultHeader = document.getElementById('result-header');
const resultBody = document.getElementById('result-body');

// Base64 URL decode
function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

// Decode JWT without verification
function decodeJWT(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
    }
    
    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    
    return { header, payload };
}

// Format JSON for display
function formatJSON(obj) {
    return JSON.stringify(obj, null, 2);
}

// Show result
function showResult(valid, data) {
    outputSection.style.display = 'block';
    
    if (valid) {
        resultHeader.className = 'result-header valid';
        resultHeader.textContent = '✅ Token is Valid';
        
        let html = '<h3>Decoded Header</h3>';
        html += `<pre>${formatJSON(data.header)}</pre>`;
        html += '<h3>Payload</h3>';
        html += `<pre>${formatJSON(data.payload)}</pre>`;
        
        resultBody.innerHTML = html;
    } else {
        resultHeader.className = 'result-header invalid';
        resultHeader.textContent = '❌ Token is Invalid';
        
        let html = '';
        if (data.error) {
            html += `<div class="error-message"><strong>Error:</strong> ${data.error}</div>`;
        }
        if (data.code) {
            html += `<div class="error-message"><strong>Code:</strong> ${data.code}</div>`;
        }
        
        // Try to decode anyway to show structure
        try {
            const decoded = decodeJWT(tokenInput.value.trim());
            html += '<h3>Decoded Header (unverified)</h3>';
            html += `<pre>${formatJSON(decoded.header)}</pre>`;
            html += '<h3>Payload (unverified)</h3>';
            html += `<pre>${formatJSON(decoded.payload)}</pre>`;
        } catch (e) {
            html += `<div class="error-message">Could not decode token: ${e.message}</div>`;
        }
        
        resultBody.innerHTML = html;
    }
    
    // Scroll to result
    outputSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Verify token
async function verifyToken() {
    const token = tokenInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();
    const audience = audienceInput.value.trim();
    
    console.log('🔐 Verifying token...');
    console.log('📡 API URL:', apiUrl);
    console.log('🎯 Audience:', audience || '(none)');
    console.log('📄 Token length:', token.length);
    
    if (!token) {
        alert('Please paste a token');
        return;
    }
    
    if (!apiUrl) {
        alert('Please enter API URL');
        return;
    }
    
    verifyBtn.classList.add('loading');
    verifyBtn.textContent = 'Verifying...';
    
    try {
        console.log('📤 Sending verification request...');
        
        const response = await fetch(`${apiUrl}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token,
                audience: audience || undefined
            })
        });
        
        console.log('📥 Response status:', response.status, response.statusText);
        
        const result = await response.json();
        console.log('📦 Verification result:', result);
        
        if (result.valid) {
            console.log('✅ Token is valid!');
            const decoded = decodeJWT(token);
            showResult(true, {
                header: decoded.header,
                payload: result.payload
            });
        } else {
            console.log('❌ Token is invalid:', result.error);
            showResult(false, result);
        }
        
    } catch (error) {
        console.error('❌ Verification error:', error);
        showResult(false, {
            error: error.message,
            code: 'NETWORK_ERROR'
        });
    } finally {
        verifyBtn.classList.remove('loading');
        verifyBtn.textContent = 'Verify Token';
    }
}

// Create demo token
async function createDemoToken() {
    const apiUrl = apiUrlInput.value.trim();
    
    console.log('🚀 Creating demo token...');
    console.log('📡 API URL:', apiUrl);
    
    if (!apiUrl) {
        alert('Please enter API URL');
        return;
    }
    
    demoBtn.classList.add('loading');
    demoBtn.textContent = 'Creating...';
    
    const requestBody = {
        user: 'did:example:alice',
        agent: 'demo-bot@playground',
        scope: 'pay:merchant',
        limit: {
            amount: 1000,
            currency: 'USD'
        },
        aud: 'merchant.example'
    };
    
    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
    
    try {
        console.log('📤 Sending request to:', `${apiUrl}/demo/create-token`);
        
        const response = await fetch(`${apiUrl}/demo/create-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Response status:', response.status, response.statusText);
        console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
        
        let result;
        try {
            result = await response.json();
            console.log('📦 Response body:', result);
        } catch (parseError) {
            console.error('❌ Failed to parse response JSON:', parseError);
            alert('Server returned invalid JSON. Check console for details.');
            return;
        }
        
        if (result.token) {
            console.log('✅ Token received, length:', result.token.length);
            console.log('🔑 Key ID:', result.kid);
            tokenInput.value = result.token;
            audienceInput.value = 'merchant.example';
            alert('Demo token created! Click "Verify Token" to validate it.');
        } else {
            console.error('❌ No token in response:', result);
            const errorMsg = result.error || 'Unknown error';
            const details = result.details ? '\n\nDetails: ' + result.details : '';
            const received = result.received ? '\n\nReceived fields: ' + JSON.stringify(result.received) : '';
            alert('Failed to create demo token: ' + errorMsg + details + received);
        }
        
    } catch (error) {
        console.error('❌ Network error:', error);
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
        });
        alert('Failed to create demo token: ' + error.message + '\n\nCheck browser console (F12) for details.');
    } finally {
        demoBtn.classList.remove('loading');
        demoBtn.textContent = 'Create Demo Token';
    }
}

// Event listeners
verifyBtn.addEventListener('click', verifyToken);
demoBtn.addEventListener('click', createDemoToken);

// Allow Enter key in audience field
audienceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        verifyToken();
    }
});

