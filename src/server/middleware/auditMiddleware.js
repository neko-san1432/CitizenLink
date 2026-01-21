/**
 * Audit Middleware
 * Logs all important actions to the audit_logs table
 */

const Database = require("../../config/database");
const supabase = Database.getClient();

const auditMiddleware = async (req, res, next) => {
  const start = Date.now();

  // Capture the original end function
  const oldEnd = res.end;

  res.end = function (chunk, encoding) {
    res.end = oldEnd;
    res.end(chunk, encoding);

    // Log the request after it's finished
    const duration = Date.now() - start;
    const { method, url, ip } = req;
    const {statusCode} = res;
    const userId = req.user?.id || null;

    // Don't log healthcecks or static files if too noisy
    if (
      url === "/health" ||
      url.startsWith("/public/") ||
      url.startsWith("/css/")
    ) {
      return;
    }

    // Perform async logging (don't await to not block the response, although it's already ended)
    supabase
      .from("audit_logs")
      .insert({
        user_id: userId,
        action: `${method} ${url}`,
        status_code: statusCode,
        duration_ms: duration,
        ip_address: ip,
        user_agent: req.get("User-Agent"),
        timestamp: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error("[AUDIT] Error saving log:", error.message);
      })
      .catch((err) => {
        console.error("[AUDIT] Critical error logging action:", err);
      });
  };

  next();
};

module.exports = auditMiddleware;
