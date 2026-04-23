const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/lgu-admin/dashboard-stats',
  method: 'GET',
};

// We don't have authentication, so we might just get 401. But let's try.
const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'DATA:', data));
});
req.on('error', e => console.error(e));
req.end();
