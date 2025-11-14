/**
 * HTTPS Enforcement Middleware
 * Ensures all requests in production are served over HTTPS
 * Required for GDPR compliance (encryption in transit)
 */

function enforceHTTPS(req, res, next) {
  // Only enforce in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if request is already secure (HTTPS)
  const isSecure = req.secure ||
                   req.headers['x-forwarded-proto'] === 'https' ||
                   req.headers['x-forwarded-ssl'] === 'on';

  if (!isSecure) {
    // Redirect to HTTPS version
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }

  // Set security headers
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  next();
}

/**
 * Trust proxy middleware for accurate IP detection behind proxies/load balancers
 * Should be configured based on your deployment setup
 */
function trustProxy(app) {
  // Trust first proxy (for load balancers, reverse proxies)
  // Adjust based on your infrastructure
  if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
}

module.exports = {
  enforceHTTPS,
  trustProxy
};

