const crypto = require("crypto");
const _cookieParser = require("cookie-parser");

// CSRF secret key (should be in environment variable in production)
const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString("hex");

// Generate a secure CSRF token
const generateToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Sign a CSRF token using HMAC
const signToken = (token) => {
  const hmac = crypto.createHmac("sha256", CSRF_SECRET);
  hmac.update(token);
  return `${token}.${hmac.digest("hex")}`;
};

// Verify a signed CSRF token
const verifyToken = (signedToken) => {
  if (!signedToken || typeof signedToken !== "string") {
    return null;
  }
  const parts = signedToken.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [token, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", CSRF_SECRET)
    .update(token)
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return token;
  }
  return null;
};

// CSRF middleware - validates signed tokens from cookies or headers
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  let token = null;
  // Check for token in headers first
  if (req.headers["x-csrf-token"]) {
    token = req.headers["x-csrf-token"];
  }
  // Check for token in body (for JSON requests and FormData)
  else if (req.body && req.body._csrf) {
    token = req.body._csrf;
  }
  // Check for token in signed cookie
  else if (req.cookies && req.cookies["csrf-token"]) {
    token = req.cookies["csrf-token"];
  }

  if (!token) {
    return res.status(403).json({
      success: false,
      error: "CSRF token missing"
    });
  }

  // Verify the signed token
  const verifiedToken = verifyToken(token);
  if (!verifiedToken) {
    return res.status(403).json({
      success: false,
      error: "Invalid CSRF token"
    });
  }

  // Verify token matches the one in the session cookie
  const sessionToken = req.cookies["csrf-token"];
  if (sessionToken && verifyToken(sessionToken) !== verifiedToken) {
    return res.status(403).json({
      success: false,
      error: "CSRF token mismatch"
    });
  }

  next();
};

// Generate and store CSRF token in signed cookie
const generateCsrfToken = (req, res, next) => {
  const token = generateToken();
  const signedToken = signToken(token);

  // Set signed cookie (httpOnly: false so client can read it for headers)
  res.cookie("csrf-token", signedToken, {
    httpOnly: false, // Must be readable by JavaScript for X-CSRF-Token header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 60 * 1000 // 30 minutes
  });

  // Add token to response locals for templates
  res.locals.csrfToken = signedToken;
  // Also add to response headers for API clients
  res.setHeader("X-CSRF-Token", signedToken);
  next();
};

// Middleware to add CSRF token to API responses
const addCsrfToken = (req, res, next) => {
  const token = generateToken();
  const signedToken = signToken(token);

  // Set signed cookie
  res.cookie("csrf-token", signedToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 60 * 1000
  });

  // Add to response headers for API clients
  res.setHeader("X-CSRF-Token", signedToken);
  next();
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  addCsrfToken,
  generateToken
};
