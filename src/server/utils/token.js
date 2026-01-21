const crypto = require("crypto");
const config = require("../../config/app");

/**
 * Generate a signed verification token for ID validation
 * @param {string} idType - The type of ID validated (e.g., 'philid')
 * @returns {string} The signed token 'payload.signature'
 */
function generateVerificationToken(idType) {
  const secret = config.supabase.serviceRoleKey;
  if (!secret)
    throw new Error(
      "Server configuration error: Missing secret for token generation"
    );

  const payload = JSON.stringify({
    type: idType,
    ts: Date.now(),
  });

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Return base64 encoded payload + signature
  return `${Buffer.from(payload).toString("base64")}.${signature}`;
}

/**
 * Verify a verification token
 * @param {string} token - The token string to verify
 * @returns {boolean} True if valid and not expired (1 hour), False otherwise
 */
function verifyVerificationToken(token) {
  if (!token) return false;

  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return false;

    const secret = config.supabase.serviceRoleKey;
    const payloadStr = Buffer.from(payloadB64, "base64").toString("utf8");

    // Re-compute signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payloadStr)
      .digest("hex");

    if (signature !== expectedSignature) return false;

    // Check expiration (1 hour window)
    const payload = JSON.parse(payloadStr);
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - payload.ts > oneHour) return false;

    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  generateVerificationToken,
  verifyVerificationToken,
};
