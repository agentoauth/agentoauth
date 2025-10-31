const tokenInput = document.getElementById('token-input');
const apiUrlInput = document.getElementById('api-url');
const audienceInput = document.getElementById('audience');
const verifyBtn = document.getElementById('verify-btn');
const demoBtn = document.getElementById('demo-btn');
const revokeBtn = document.getElementById('revoke-btn');
const sampleDropdown = document.getElementById('sample-tokens');
const outputSection = document.getElementById('output');
const resultHeader = document.getElementById('result-header');
const resultBody = document.getElementById('result-body');

// Store current jti for revocation
let currentJti = null;

// Inline notification system
function showInlineNotification(message, type = 'info', duration = 3000) {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) return;
    
    // Clear existing notifications
    notificationArea.innerHTML = '';
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationArea.appendChild(notification);
    
    // Auto-hide after duration
    if (duration > 0) {
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
    
    // Scroll to notification
    notificationArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

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

// Format JSON for display (pretty print)
function formatJSON(obj) {
    return JSON.stringify(obj, null, 2);
}

// Copy to clipboard
function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
        alert(`✅ ${label} copied to clipboard!`);
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('❌ Failed to copy');
    });
}

// Show result
function showResult(valid, data) {
    outputSection.style.display = 'block';
    
    if (valid) {
        resultHeader.className = 'result-header valid';
        resultHeader.textContent = '✅ Token is Valid';
        
        // Store jti for revocation
        if (data.payload && data.payload.jti) {
            currentJti = data.payload.jti;
        }
        
        let html = '';
        
        // JTI Display (v0.2)
        if (data.payload && data.payload.jti) {
            html += '<div class="jti-display">';
            html += `<strong>🆔 Token ID (jti):</strong> ${data.payload.jti}`;
            html += '</div>';
        }
        
        // Copy buttons
        html += '<div class="copy-buttons">';
        html += '<button class="btn-copy" onclick="copyToClipboard(tokenInput.value, \'Token\')">📋 Copy Token</button>';
        html += `<button class="btn-copy" onclick="copyToClipboard('${JSON.stringify(data.header).replace(/'/g, "\\'")}', 'Header')">📋 Copy Header</button>`;
        html += `<button class="btn-copy" onclick="copyToClipboard('${JSON.stringify(data.payload).replace(/'/g, "\\'")}', 'Payload')">📋 Copy Payload</button>`;
        html += '</div>';
        
        html += '<h3>Decoded Header</h3>';
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

// Revoke token
async function revokeToken() {
    if (!currentJti) {
        alert('No token to revoke. Verify a token first to get its jti.');
        return;
    }
    
    const apiUrl = apiUrlInput.value.trim();
    
    if (!confirm(`Revoke token with jti: ${currentJti}?`)) {
        return;
    }
    
    revokeBtn.classList.add('loading');
    revokeBtn.textContent = 'Revoking...';
    
    console.log('🚫 Revoking token:', currentJti);
    
    try {
        const response = await fetch(`${apiUrl}/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ jti: currentJti })
        });
        
        const result = await response.json();
        console.log('📦 Revoke response:', result);
        
        if (result.success) {
            alert(`✅ Token revoked!\n\nJTI: ${result.jti}\nRevoked at: ${result.revokedAt}\n\nTry verifying again - it should fail with REVOKED.`);
        } else {
            alert('❌ Revocation failed: ' + (result.error || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('❌ Revoke error:', error);
        alert('Failed to revoke token: ' + error.message);
    } finally {
        revokeBtn.classList.remove('loading');
        revokeBtn.textContent = 'Revoke Token';
    }
}

// Load sample token
function loadSample() {
    const sample = sampleDropdown.value;
    if (!sample) return;
    
    // Sample tokens (these will be created by the demo endpoint)
    console.log('📝 Loading sample:', sample);
    
    // For now, trigger demo token creation with different parameters
    const apiUrl = apiUrlInput.value.trim();
    
    let sampleConfig = {
        user: 'did:example:alice',
        agent: 'sample-bot',
        scope: 'pay:merchant',
        limit: { amount: 1000, currency: 'USD' },
        aud: 'merchant.example'
    };
    
    if (sample === 'expired') {
        sampleConfig.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        sampleConfig.agent = 'expired-bot';
    } else if (sample === 'limit') {
        sampleConfig.limit.amount = 10000;
        sampleConfig.agent = 'high-limit-bot';
    }
    
    // Show loading state
    sampleDropdown.disabled = true;
    showInlineNotification('Loading sample token...', 'info');
    
    // Create sample token via API
    fetch(`${apiUrl}/demo/create-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleConfig)
    })
    .then(r => r.json())
    .then(result => {
        if (result.token) {
            tokenInput.value = result.token;
            if (sample === 'valid' || sample === 'limit') {
                audienceInput.value = 'merchant.example';
            }
            showInlineNotification(`✅ Sample token loaded: ${sample}`, 'success');
            // Auto-scroll to textarea
            tokenInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            showInlineNotification('❌ Failed to load sample token', 'error');
        }
    })
    .catch(err => {
        console.error('Failed to load sample:', err);
        showInlineNotification('❌ Failed to load sample token. Make sure verifier API is running.', 'error');
    })
    .finally(() => {
        sampleDropdown.disabled = false;
    });
    
    // Reset dropdown
    sampleDropdown.value = '';
}

// Event listeners
verifyBtn.addEventListener('click', verifyToken);
demoBtn.addEventListener('click', createDemoToken);
revokeBtn.addEventListener('click', revokeToken);
sampleDropdown.addEventListener('change', loadSample);

// Allow Enter key in audience field
audienceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        verifyToken();
    }
});

// Tab switching
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // Remove active from all
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active to clicked tab
        btn.classList.add('active');
        document.querySelector(`[data-content="${targetTab}"]`).classList.add('active');
    });
});

// Helper to programmatically switch tabs
function switchToPolicyTester() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector('[data-tab="policy-tester"]').classList.add('active');
    document.querySelector('[data-content="policy-tester"]').classList.add('active');
    
    if (window.lastCreatedToken) {
        document.getElementById('tester-token').value = window.lastCreatedToken;
    }
    
    // Scroll to top of tester
    document.querySelector('[data-content="policy-tester"]').scrollIntoView({ behavior: 'smooth' });
}

window.switchToPolicyTester = switchToPolicyTester;

// Policy Builder functionality
const buildPolicyBtn = document.getElementById('build-policy-btn');
const createTokenBtn = document.getElementById('create-token-btn');
const templateSelect = document.getElementById('policy-template');

// Policy templates
const policyTemplates = {
    travel: {
        actions: 'payments.send',
        merchants: 'airbnb,expedia,booking',
        amount: 500,
        currency: 'USD',
        periodAmount: 2000,
        period: 'week',
        start: '09:00',
        end: '17:00',
        tz: 'America/Los_Angeles',
        strict: false,
        description: 'Perfect for travel booking agents. Allows $500 per transaction with a $2000 weekly budget, restricted to weekdays during business hours.'
    },
    micropay: {
        actions: 'payments.send',
        merchants: '',
        amount: 10,
        currency: 'USD',
        periodAmount: 100,
        period: 'day',
        start: '',
        end: '',
        tz: '',
        strict: true,
        description: 'Great for micro-payment scenarios. Very low limits ($10 per transaction, $100 per day) with strict mode enabled.'
    },
    enterprise: {
        actions: 'payments.send,payments.approve',
        merchants: 'vendor1,vendor2,acme-corp',
        amount: 5000,
        currency: 'USD',
        periodAmount: 50000,
        period: 'month',
        start: '08:00',
        end: '20:00',
        tz: 'America/New_York',
        strict: true,
        description: 'Enterprise-grade policy with high limits ($5K per transaction, $50K monthly). Restricted to approved vendors with strict validation.'
    }
};

// Template selector handler
templateSelect.addEventListener('change', (e) => {
    const template = policyTemplates[e.target.value];
    if (!template) {
        document.getElementById('template-description').style.display = 'none';
        return;
    }
    
    // Populate form fields
    document.getElementById('policy-actions').value = template.actions;
    document.getElementById('policy-merchants').value = template.merchants;
    document.getElementById('policy-amount').value = template.amount;
    document.getElementById('policy-currency').value = template.currency;
    document.getElementById('policy-period-amount').value = template.periodAmount;
    document.getElementById('policy-period').value = template.period;
    document.getElementById('policy-start').value = template.start;
    document.getElementById('policy-end').value = template.end;
    document.getElementById('policy-tz').value = template.tz;
    document.getElementById('policy-strict').checked = template.strict;
    
    // Show description
    const descEl = document.getElementById('template-description');
    descEl.textContent = template.description;
    descEl.style.display = 'block';
});

buildPolicyBtn.addEventListener('click', () => {
    const policyId = document.getElementById('policy-id').value || generatePolicyId();
    const actions = document.getElementById('policy-actions').value.split(',').map(s => s.trim()).filter(Boolean);
    const merchants = document.getElementById('policy-merchants').value.split(',').map(s => s.trim()).filter(Boolean);
    const amount = parseFloat(document.getElementById('policy-amount').value) || 0;
    const currency = document.getElementById('policy-currency').value || 'USD';
    const periodAmount = parseFloat(document.getElementById('policy-period-amount').value) || 0;
    const period = document.getElementById('policy-period').value;
    const start = document.getElementById('policy-start').value;
    const end = document.getElementById('policy-end').value;
    const tz = document.getElementById('policy-tz').value;
    const strict = document.getElementById('policy-strict').checked;
    
    // Validation
    const errors = [];
    if (actions.length === 0) {
        errors.push('At least one action is required');
    }
    if (amount <= 0) {
        errors.push('Per-transaction limit must be greater than 0');
    }
    if (periodAmount <= 0) {
        errors.push('Per-period limit must be greater than 0');
    }
    if (periodAmount < amount) {
        errors.push('Per-period limit cannot be less than per-transaction limit');
    }
    if (currency.length !== 3) {
        errors.push('Currency must be 3 characters (e.g., USD, EUR)');
    }
    
    if (errors.length > 0) {
        alert('⚠️ Validation errors:\n\n' + errors.join('\n'));
        return;
    }
    
    // Build policy object
    const policy = {
        version: 'pol.v0.2',
        id: policyId,
        actions: actions,
        resources: merchants.length > 0 ? [{
            type: 'merchant',
            match: { ids: merchants }
        }] : [],
        limits: {},
        strict: strict
    };
    
    if (amount > 0) {
        policy.limits.per_txn = { amount, currency };
    }
    
    if (periodAmount > 0) {
        policy.limits.per_period = { amount: periodAmount, currency, period };
    }
    
    if (start && end) {
        policy.constraints = {
            time: { start, end }
        };
        if (tz) policy.constraints.time.tz = tz;
    }
    
    // Show policy JSON
    document.getElementById('policy-json').textContent = JSON.stringify(policy, null, 2);
    document.getElementById('policy-output').style.display = 'block';
    
    // Auto-fill policy ID if was empty
    if (!document.getElementById('policy-id').value) {
        document.getElementById('policy-id').value = policyId;
    }
    
    console.log('✅ Policy built:', policy);
});

createTokenBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim();
    const policyJson = document.getElementById('policy-json').textContent;
    
    if (!policyJson) {
        alert('⚠️ Please click "Build Policy JSON" first');
        return;
    }
    
    const policy = JSON.parse(policyJson);
    
    createTokenBtn.classList.add('loading');
    createTokenBtn.textContent = 'Creating Token...';
    
    try {
        const response = await fetch(`${apiUrl}/demo/create-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user: 'did:example:alice',
                agent: 'policy-builder@playground',
                scope: policy.actions[0] || 'payments.send',
                policy: policy
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `API returned ${response.status}`);
        }
        
        const result = await response.json();
        displayPolicyToken(result.token, result.payload);
        
        console.log('✅ Token created:', result);
    } catch (error) {
        console.error('❌ Token creation failed:', error);
        alert(`Error: ${error.message}\n\nMake sure Verifier API is running at ${apiUrl}`);
    } finally {
        createTokenBtn.classList.remove('loading');
        createTokenBtn.textContent = 'Create Token with Policy';
    }
});

function displayPolicyToken(token, payload) {
    const output = document.getElementById('policy-token-output');
    output.style.display = 'block';
    
    document.getElementById('policy-token-text').textContent = token;
    document.getElementById('policy-token-payload').textContent = JSON.stringify({
        ver: payload.ver,
        user: payload.user,
        agent: payload.agent,
        policy_id: payload.policy?.id,
        policy_hash: payload.policy_hash?.substring(0, 20) + '...',
        exp: new Date(payload.exp * 1000).toISOString()
    }, null, 2);
    
    window.lastCreatedToken = token;
    
    // Scroll to output
    output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Policy Tester functionality
const testPolicyBtn = document.getElementById('test-policy-btn');

testPolicyBtn.addEventListener('click', async () => {
    const token = document.getElementById('tester-token').value.trim();
    const action = document.getElementById('tester-action').value.trim();
    const resourceType = document.getElementById('tester-resource-type').value.trim();
    const resourceId = document.getElementById('tester-resource-id').value.trim();
    const amount = document.getElementById('tester-amount').value;
    const currency = document.getElementById('tester-currency').value.trim();
    const apiUrl = apiUrlInput.value.trim();
    
    if (!token) {
        alert('Please paste a token');
        return;
    }
    
    testPolicyBtn.classList.add('loading');
    testPolicyBtn.textContent = 'Testing...';
    
    try {
        const requestBody = {
            token,
            action,
            resource: (resourceType && resourceId) ? { type: resourceType, id: resourceId } : undefined,
            amount: amount ? parseFloat(amount) : undefined,
            currency: currency || undefined
        };
        
        const response = await fetch(`${apiUrl}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        const testOutput = document.getElementById('policy-test-output');
        const testHeader = document.getElementById('policy-test-header');
        const testResult = document.getElementById('policy-test-result');
        
        testOutput.style.display = 'block';
        
        if (result.valid) {
            testHeader.className = 'result-header valid';
            testHeader.innerHTML = '✅ Policy Decision: ALLOW';
        } else {
            testHeader.className = 'result-header invalid';
            testHeader.innerHTML = '❌ Policy Decision: DENY';
        }
        
        testResult.textContent = JSON.stringify(result, null, 2);
        
        console.log('Policy test result:', result);
    } catch (error) {
        console.error('Policy test error:', error);
        alert('Error: ' + error.message);
    } finally {
        testPolicyBtn.classList.remove('loading');
        testPolicyBtn.textContent = 'Test Policy';
    }
});

// Helper function to generate policy ID
function generatePolicyId() {
    return 'pol_' + Array.from(crypto.getRandomValues(new Uint8Array(12)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Toggle advanced options section
function toggleAdvancedOptions() {
    const section = document.getElementById('advanced-options');
    const toggleIcon = document.querySelector('.toggle-section-btn .toggle-icon');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        toggleIcon.textContent = '▲';
    } else {
        section.style.display = 'none';
        toggleIcon.textContent = '▼';
    }
}

window.toggleAdvancedOptions = toggleAdvancedOptions;

// Copy policy JSON function
function copyPolicyJson() {
    const policyJson = document.getElementById('policy-json').textContent;
    if (policyJson) {
        copyToClipboard(policyJson, 'Policy JSON');
    }
}
window.copyPolicyJson = copyPolicyJson;

// Smart defaults and localStorage persistence
(function() {
    // Save/restore API URL
    const savedApiUrl = localStorage.getItem('agentoauth_playground_api_url');
    if (savedApiUrl) {
        apiUrlInput.value = savedApiUrl;
    }
    
    apiUrlInput.addEventListener('change', () => {
        localStorage.setItem('agentoauth_playground_api_url', apiUrlInput.value);
    });
    
    // Auto-generate Policy ID on blur if empty
    const policyIdInput = document.getElementById('policy-id');
    policyIdInput.addEventListener('blur', (e) => {
        if (!e.target.value.trim()) {
            e.target.value = generatePolicyId();
        }
    });
    
    // Save/restore Policy Builder form state
    const policyInputs = [
        'policy-id', 'policy-actions', 'policy-merchants', 'policy-amount',
        'policy-currency', 'policy-period-amount', 'policy-period',
        'policy-start', 'policy-end', 'policy-tz', 'policy-strict'
    ];
    
    // Load saved form state
    policyInputs.forEach(id => {
        const saved = localStorage.getItem(`agentoauth_playground_${id}`);
        if (saved !== null) {
            const el = document.getElementById(id);
            if (el.type === 'checkbox') {
                el.checked = saved === 'true';
            } else {
                el.value = saved;
            }
        }
    });
    
    // Save form state on change
    policyInputs.forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('change', (e) => {
            const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
            localStorage.setItem(`agentoauth_playground_${id}`, value);
        });
    });
    
    // Add "Clear Form" button functionality
    const clearFormBtn = document.createElement('button');
    clearFormBtn.type = 'button';
    clearFormBtn.textContent = '🗑️ Clear Form';
    clearFormBtn.className = 'btn-secondary';
    clearFormBtn.style.marginRight = '0.5rem';
    clearFormBtn.addEventListener('click', () => {
        if (confirm('Clear all form fields? This cannot be undone.')) {
            // Clear all policy inputs
            policyInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el.type === 'checkbox') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
                localStorage.removeItem(`agentoauth_playground_${id}`);
            });
            
            // Clear outputs
            document.getElementById('policy-output').style.display = 'none';
            document.getElementById('policy-token-output').style.display = 'none';
            document.getElementById('template-description').style.display = 'none';
            templateSelect.value = '';
            
            alert('Form cleared!');
        }
    });
    
    // Insert clear button before build button
    const buildPolicyBtn = document.getElementById('build-policy-btn');
    buildPolicyBtn.parentNode.insertBefore(clearFormBtn, buildPolicyBtn);
})();

