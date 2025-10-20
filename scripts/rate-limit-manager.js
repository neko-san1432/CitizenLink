#!/usr/bin/env node

/**
 * Rate Limit Manager
 * A simple script to manage rate limits for development
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 CitizenLink Rate Limit Manager');
console.log('==================================\n');

function showMenu() {
  console.log('Available commands:');
  console.log('1. Check rate limit status');
  console.log('2. Clear rate limits for specific IP');
  console.log('3. Clear all rate limits');
  console.log('4. Check if rate limiting is disabled');
  console.log('5. Exit');
  console.log('');
}

function makeRequest(endpoint, method = 'GET', data = null) {
  const http = require('http');
  const url = require('url');
  
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(`http://localhost:3000/api/rate-limit${endpoint}`);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 3000,
      path: parsedUrl.path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function checkStatus() {
  try {
    const response = await makeRequest('/config');
    console.log('\n📊 Rate Limit Configuration:');
    console.log('============================');
    console.log(`Disabled: ${response.data.disabled ? '✅ Yes' : '❌ No'}`);
    console.log(`Environment: ${response.data.environment}`);
    console.log(`DISABLE_RATE_LIMITING env var: ${response.data.disableEnvVar || 'Not set'}`);
    console.log('');
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    console.log('Make sure the server is running on localhost:3000\n');
  }
}

async function checkIpStatus(ip) {
  try {
    const response = await makeRequest(`/status/${ip}`);
    if (response.status === 200) {
      console.log(`\n📈 Rate Limit Status for ${ip}:`);
      console.log('================================');
      console.log(`Requests: ${response.data.status.requests}`);
      console.log(`Remaining: ${response.data.status.remaining}`);
      console.log(`Reset Time: ${response.data.status.resetTime ? new Date(response.data.status.resetTime).toLocaleString() : 'N/A'}`);
      console.log(`Disabled: ${response.data.disabled ? '✅ Yes' : '❌ No'}`);
      console.log('');
    } else {
      console.error('❌ Error checking IP status:', response.data);
    }
  } catch (error) {
    console.error('❌ Error checking IP status:', error.message);
    console.log('Make sure the server is running on localhost:3000\n');
  }
}

async function clearIpLimits(ip) {
  try {
    const response = await makeRequest('/clear', 'POST', { ip });
    if (response.status === 200) {
      console.log(`✅ Rate limits cleared for IP: ${ip}\n`);
    } else {
      console.error('❌ Error clearing IP limits:', response.data);
    }
  } catch (error) {
    console.error('❌ Error clearing IP limits:', error.message);
    console.log('Make sure the server is running on localhost:3000\n');
  }
}

async function clearAllLimits() {
  try {
    const response = await makeRequest('/clear', 'POST', {});
    if (response.status === 200) {
      console.log('✅ All rate limits cleared\n');
    } else {
      console.error('❌ Error clearing all limits:', response.data);
    }
  } catch (error) {
    console.error('❌ Error clearing all limits:', error.message);
    console.log('Make sure the server is running on localhost:3000\n');
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  while (true) {
    showMenu();
    const choice = await askQuestion('Enter your choice (1-5): ');
    
    switch (choice.trim()) {
      case '1':
        const ip = await askQuestion('Enter IP address (or press Enter for your IP): ');
        await checkIpStatus(ip || undefined);
        break;
        
      case '2':
        const ipToClear = await askQuestion('Enter IP address to clear: ');
        if (ipToClear.trim()) {
          await clearIpLimits(ipToClear.trim());
        } else {
          console.log('❌ IP address is required\n');
        }
        break;
        
      case '3':
        const confirm = await askQuestion('Are you sure you want to clear ALL rate limits? (y/N): ');
        if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
          await clearAllLimits();
        } else {
          console.log('❌ Operation cancelled\n');
        }
        break;
        
      case '4':
        await checkStatus();
        break;
        
      case '5':
        console.log('👋 Goodbye!');
        rl.close();
        process.exit(0);
        break;
        
      default:
        console.log('❌ Invalid choice. Please enter 1-5.\n');
    }
  }
}

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  rl.close();
  process.exit(0);
});

main().catch(console.error);
