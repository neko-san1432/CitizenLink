/**
 * Handle password reset errors from Supabase
 * @param {Object} res - Express response object
 * @param {Object} error - Supabase error object
 * @param {string} redirectTo - Redirect URL
 * @param {Object} supabase - Supabase client (optional, for dev workaround)
 * @param {string} email - User email (optional, for dev workaround)
 */
const handlePasswordResetError = async (
  res,
  error,
  redirectTo,
  supabase,
  email
) => {
  console.error("[FORGOT_PASSWORD] Supabase error:", error);
  console.error("[FORGOT_PASSWORD] Error details:", {
    message: error.message,
    status: error.status,
    code: error.code,
    redirectTo,
    supabaseUrl: process.env.SUPABASE_URL,
  });

  // Check if it's a redirectTo URL issue
  if (error.code === "unexpected_failure" && error.status === 500) {
    console.error("[FORGOT_PASSWORD] Possible causes:");
    console.error(
      "  1. Email sending is disabled in Supabase Dashboard → Authentication → Email"
    );
    console.error(
      "  2. RedirectTo URL not whitelisted in Supabase Dashboard → Authentication → URL Configuration"
    );
    console.error(
      "  3. SMTP/SES not configured in Supabase Dashboard → Settings → Auth"
    );
    console.error("  4. Supabase project email service issue");

    // Development workaround: Try to generate link manually if email sending fails
    if (process.env.NODE_ENV === "development" && supabase && email) {
      try {
        const { data: adminData, error: adminError } =
          await supabase.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo },
          });

        if (!adminError && adminData?.action_link) {
          return res.json({
            success: true,
            message: "Recovery link generated (development mode)",
            note: "Email not sent - Supabase email service not configured. Check server logs for the reset link.",
            link: adminData.action_link,
            development: true,
          });
        }
        console.error(
          "[FORGOT_PASSWORD] Admin API also failed:",
          adminError?.message || "Unknown error"
        );
      } catch (error_) {
        console.error("[FORGOT_PASSWORD] Admin API exception:", error_.message);
      }
    }
  }

  // Return more specific error messages
  let errorMessage = "Failed to send password reset email";
  let statusCode = 400;

  if (error.status === 429) {
    statusCode = 429;
    errorMessage = error.message;
  } else if (error.code === "unexpected_failure" && error.status === 500) {
    errorMessage =
      "Email service is not configured. Please contact your administrator or check Supabase email settings.";
  } else if (error.message) {
    if (
      error.message.includes("not found") ||
      error.message.includes("does not exist")
    ) {
      errorMessage = "No account found with this email address";
    } else {
      errorMessage = error.message;
    }
  }

  return res.status(statusCode).json({
    success: false,
    error: errorMessage,
    errorCode: error.code || null,
    details:
      process.env.NODE_ENV === "development"
        ? {
          message: error.message,
          code: error.code,
          status: error.status,
          note: "This error usually means email sending is disabled in Supabase Dashboard -> Authentication -> Email",
        }
        : null,
  });
};

module.exports = handlePasswordResetError;
