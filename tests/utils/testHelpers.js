/**
 * Test helper utilities for authentication testing
 */

const crypto = require('crypto');

/**
 * Generate a test user object
 */
function createTestUser(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    email: `test${Date.now()}@example.com`,
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
    mobileNumber: '+1234567890',
    role: 'citizen',
    ...overrides,
  };
}

/**
 * Generate a test JWT token (mock)
 */
function generateMockToken(userId, _expiresIn = '1h') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url');
  return `${header}.${payload}.signature`;
}

/**
 * Create a mock request object
 */
function createMockRequest(overrides = {}) {
  return {
    method: 'GET',
    path: '/api/test',
    headers: {},
    cookies: {},
    body: {},
    query: {},
    ip: '127.0.0.1',
    hostname: 'localhost',
    get: jest.fn((header) => overrides.headers?.[header.toLowerCase()]),
    ...overrides,
  };
}

/**
 * Create a mock response object
 */
function createMockResponse() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    locals: {},
  };
  return res;
}

/**
 * Create a mock next function
 */
function createMockNext() {
  return jest.fn();
}

/**
 * Wait for a specified amount of time
 */
async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Make multiple concurrent requests
 */
async function makeConcurrentRequests(count, requestFn) {
  const promises = Array(count).fill(null).map(() => requestFn());
  return Promise.all(promises);
}

/**
 * Extract cookie value from Set-Cookie header
 */
function extractCookie(cookieString, name) {
  // Escape special regex characters in name
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // eslint-disable-next-line security/detect-non-literal-regexp
  const match = cookieString.match(new RegExp(`${escapedName}=([^;]+)`));
  return match ? match[1] : null;
}

module.exports = {
  createTestUser,
  generateMockToken,
  createMockRequest,
  createMockResponse,
  createMockNext,
  wait,
  makeConcurrentRequests,
  extractCookie,
};

