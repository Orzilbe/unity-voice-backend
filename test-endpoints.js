const axios = require('axios');

// Test configuration
const BASE_URL = 'https://unity-voice-api-linux-f2hsapgsh3hcgqc0.israelcentral-01.azurewebsites.net';
// For local testing, use: const BASE_URL = 'http://localhost:3000';

// Test endpoints
const endpoints = [
  { method: 'GET', path: '/', name: 'Root Health Check' },
  { method: 'GET', path: '/health', name: 'Health Check' },
  { method: 'GET', path: '/api/health', name: 'API Health Check' },
  { method: 'POST', path: '/api/auth/login', name: 'Login Endpoint', 
    data: { email: 'test@example.com', password: 'testpass' } },
  { method: 'POST', path: '/api/auth/register', name: 'Register Endpoint', 
    data: { 
      email: 'newuser@example.com', 
      firstName: 'Test', 
      lastName: 'User',
      phoneNumber: '+1234567890',
      password: 'Test123!@#',
      englishLevel: 'BEGINNER',
      ageRange: '18_25'
    } 
  }
];

async function testEndpoint(endpoint) {
  try {
    const config = {
      method: endpoint.method,
      url: `${BASE_URL}${endpoint.path}`,
      timeout: 30000, // Increased timeout to 30 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (endpoint.data) {
      config.data = endpoint.data;
    }

    console.log(`🔄 Testing ${endpoint.name}...`);
    const response = await axios(config);
    
    console.log(`✅ ${endpoint.name}: ${response.status} ${response.statusText}`);
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${endpoint.name}: ${error.response.status} ${error.response.statusText}`);
      console.log('   Error Response:', JSON.stringify(error.response.data, null, 2));
      return { success: false, status: error.response.status, error: error.response.data };
    } else {
      console.log(`❌ ${endpoint.name}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function runTests() {
  console.log(`🚀 Testing Unity Voice API endpoints at: ${BASE_URL}\n`);
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push({ ...endpoint, result });
    console.log(''); // Add spacing between tests
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('📊 Test Summary:');
  const successful = results.filter(r => r.result.success).length;
  const total = results.length;
  console.log(`   ${successful}/${total} endpoints responding correctly`);
  
  if (successful < total) {
    console.log('\n🔧 Failed endpoints:');
    results.filter(r => !r.result.success).forEach(r => {
      console.log(`   - ${r.name}: ${r.result.error || 'Unknown error'}`);
    });
  }
}

// Run the tests
runTests().catch(console.error); 