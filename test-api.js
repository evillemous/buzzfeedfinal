import https from 'https';
import http from 'http';

// Configuration
const config = {
  host: 'localhost',
  port: 5000,
  path: '/api/ai/batch-generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Get command line arguments or use defaults
const args = process.argv.slice(2);
const count = args[0] ? parseInt(args[0]) : 2;
const listiclePercentage = args[1] ? parseInt(args[1]) : 50;

// Payload data
const payload = JSON.stringify({
  count,
  listiclePercentage
});

console.log(`Generating ${count} articles (${listiclePercentage}% listicles)...`);

// Use http for localhost, https for external URLs
const client = config.host === 'localhost' ? http : https;

// Make the request
const req = client.request(config, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE:');
    try {
      // Try to parse as JSON
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      // If not JSON, show raw data (truncated if very long)
      if (data.length > 1000) {
        console.log(data.substring(0, 1000) + '... (truncated)');
      } else {
        console.log(data);
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`REQUEST ERROR: ${e.message}`);
});

// Write the payload data to the request
req.write(payload);

// End the request
req.end();

console.log('Request sent, waiting for response...');