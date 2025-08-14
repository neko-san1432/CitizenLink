// Use global Supabase configuration
// Initialize Supabase client for browser (provided by supabase-config.js)
let supabase = null;
// Temporary toggle: disable Supabase to test UI with mock auth
const ENABLE_SUPABASE = false;

// Initialize Supabase configuration
async function initializeAuthSupabase() {
  try {
    if (!ENABLE_SUPABASE) {
      console.log("Supabase disabled (mock mode). Skipping initialization.");
      return;
    }
    // Prevent multiple initializations
    if (supabase) {
      console.log("Supabase already initialized, skipping...");
      return;
    }

    // Wait for Supabase to be ready
    if (window.getSupabaseClient && window.getSupabaseClient()) {
      supabase = window.getSupabaseClient();
      console.log("Supabase client obtained from global config");
      checkExistingSession();
    } else {
      // Listen for Supabase ready event (only once)
      if (!window.supabaseReadyListenerAdded) {
        window.addEventListener("supabaseReady", () => {
          if (!supabase) {
            supabase = window.getSupabaseClient();
            console.log("Supabase ready event received, client obtained");
            checkExistingSession();
          }
        });
        window.supabaseReadyListenerAdded = true;
      }

      // Also try to initialize if not already done
      if (window.initializeSupabaseClient && !window.supabaseInitializing) {
        window.supabaseInitializing = true;
        await window.initializeSupabaseClient();
        window.supabaseInitializing = false;
      }
    }

    console.log("Supabase initialization completed");
  } catch (error) {
    console.error("Error initializing Supabase:", error);
  }
}

// Check if user is already logged in
async function checkExistingSession() {
  try {
    // Prevent multiple calls
    if (window.sessionCheckInProgress) {
      console.log("Session check already in progress, skipping...");
      return;
    }

    if (!ENABLE_SUPABASE || !supabase) {
      console.log("Supabase not yet initialized, waiting...");
      return;
    }

    window.sessionCheckInProgress = true;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      console.log("Existing session found:", session.user.email);
      // Redirect based on user role
      redirectBasedOnRole(session.user);
    }

    window.sessionCheckInProgress = false;
  } catch (error) {
    console.error("Error checking session:", error);
    window.sessionCheckInProgress = false;
  }
}

// Redirect user based on their role
function redirectBasedOnRole(user) {
  // Check user metadata for role, or use email to determine
  const email = user.email;
  if (email === "admin@lgu.gov.ph") {
    window.location.href = "/admin-dashboard";
  } else {
    window.location.href = "/dashboard";
  }
}

// Initialize Supabase when the script loads
console.log("Starting Supabase initialization...");
console.log("Window getSupabaseClient available:", typeof window.getSupabaseClient);
console.log("Window initializeSupabaseClient available:", typeof window.initializeSupabaseClient);

// Wait a bit for Supabase to load, then initialize
setTimeout(() => {
  console.log("Delayed Supabase initialization...");
  console.log("Window getSupabaseClient available:", typeof window.getSupabaseClient);
  console.log("Window initializeSupabaseClient available:", typeof window.initializeSupabaseClient);
  initializeAuthSupabase();
}, 1000);

// Also try immediate initialization
initializeAuthSupabase();

// Logout function
window.logout = async function () {
  try {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Supabase logout error:", error);
      }
    }

    // Clear session storage
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("signup_email");
    sessionStorage.removeItem("signup_fullName");
    sessionStorage.removeItem("signup_username");
    sessionStorage.removeItem("signup_phone");
    sessionStorage.removeItem("signup_user_id");

    // Redirect to login page
    window.location.href = "/login";
  } catch (error) {
    console.error("Logout error:", error);
    // Force redirect even if there's an error
    window.location.href = "/login";
  }
};

// Check authentication status on page load
document.addEventListener("DOMContentLoaded", () => {
  // Check if user is already logged in
  // Show toast if returning from email verification
  try {
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    const urlHash = new URLSearchParams(url.hash.replace(/^#/, ''));
    // Supabase email confirmation returns #access_token=...&type=signup
    const verifiedFlag =
      searchParams.get('verified') === '1' ||
      searchParams.get('verify') === '1' ||
      urlHash.get('type') === 'signup';
    if (verifiedFlag) {
      showToast('Email verified. You may now log in.', 'success');
      // Clean the URL
      history.replaceState({}, document.title, '/login');
    }
  } catch (_) {}

  const user = sessionStorage.getItem("user");
  if (user) {
    try {
      const userData = JSON.parse(user);
      console.log("User already logged in:", userData);

      // Check if we're on a page that requires authentication
      const currentPath = window.location.pathname;
  const authRequiredPages = ["/login", "/signup"];

      if (authRequiredPages.includes(currentPath)) {
        // Redirect to appropriate dashboard
        if (userData.type === "lgu") {
          window.location.href = "/admin-dashboard";
        } else {
          window.location.href = "/dashboard";
        }
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
      sessionStorage.removeItem("user");
    }
  }
});

// General login form handler
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // Show loading state
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Logging in...";
    submitBtn.disabled = true;

    try {
      if (!ENABLE_SUPABASE) {
        console.log("Supabase not available, using mock login...");
        // Fallback to mock login system
        if (email === "citizen@example.com" && password === "citizen01") {
          sessionStorage.setItem(
            "user",
            JSON.stringify({
              username: email,
              type: "citizen",
              name: "John Citizen",
              email: email,
            })
          );

          showToast("Login successful! Redirecting...");
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 1000);
          return;
        } else if (email === "admin@lgu.gov.ph" && password === "admin911") {
          sessionStorage.setItem(
            "user",
            JSON.stringify({
              username: email,
              type: "lgu",
              name: "Admin User",
              department: "City Administration",
            })
          );

          showToast("Login successful! Redirecting...");
          setTimeout(() => {
            window.location.href = "/admin-dashboard";
          }, 1000);
          return;
        } else {
          showToast("Invalid email or password. Please try again.", "error");
        }
      } else {
        console.log('Supabase mode enabled, but temporarily disabled for UI test.');
      }
    } catch (error) {
      console.error("Login error:", error);
      showToast("An error occurred during login. Please try again.", "error");
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Toast notification function
function showToast(message, type = "success") {
  console.log(`Toast [${type}]:`, message);

  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");

  if (toast && toastMessage && typeof bootstrap !== "undefined") {
    try {
      // Update message and styling
      toastMessage.textContent = message;
      toast.className = `toast ${
        type === "error" ? "bg-danger text-white" : "bg-success text-white"
      }`;

      // Ensure we don't keep forced inline styles that prevent hiding
      toast.style.removeProperty("display");
      toast.style.removeProperty("visibility");
      toast.style.removeProperty("opacity");

      // Create or get instance with autohide
      const bsToast = bootstrap.Toast.getOrCreateInstance(toast, {
        autohide: true,
        delay: 3000,
      });

      // Dispose old event listeners then show
      toast.addEventListener(
        "hidden.bs.toast",
        () => {
          // Clean up any inline styles after hide
          toast.style.removeProperty("display");
          toast.style.removeProperty("visibility");
          toast.style.removeProperty("opacity");
        },
        { once: true }
      );

      bsToast.show();
      console.log("Bootstrap toast shown successfully");
      return;
    } catch (error) {
      console.error("Error showing Bootstrap toast:", error);
    }
  }

  // Fallback alert
  console.log("Using fallback alert");
  if (type === "error") {
    alert(`❌ Error: ${message}`);
  } else {
    alert(`✅ ${message}`);
  }
}

// Signup form
console.log("Looking for signup form...");
const signupForm = document.getElementById("signup-form");
console.log("Signup form found:", signupForm);

if (signupForm) {
  console.log("Adding submit event listener to signup form...");
  signupForm.addEventListener("submit", async (e) => {
    console.log("Signup form submitted!");
    e.preventDefault();

    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const username = document.getElementById("username").value;
    const phoneInput = document.getElementById("phone").value;
    const phone = phoneInput.trim().replace(/[\s-]/g, '');
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      console.log('Password validation failed - passwords do not match');
      showToast("Passwords do not match. Please try again.", "error");
      return;
    }

    // Validate phone number format (Philippine format)
    console.log('Phone number to validate:', `"${phone}"`, 'Length:', phone.length);
    console.log('Phone number characters:', Array.from(phone).map(c => c.charCodeAt(0)));
    
    // Allow either +63XXXXXXXXXX or 0XXXXXXXXXX (10 digits after the prefix)
    const phoneRegex = /^(\+63|0)\d{10}$/;
    const isValid = phoneRegex.test(phone);
    console.log('Phone regex test result:', isValid);
    
    if (!isValid) {
      console.log('Phone validation failed - invalid format:', phone);
      showToast(
        "Please enter a valid Philippine phone number (e.g., +639123456789 or 09123456789)",
        "error"
      );
      return;
    }

    // Check if terms are agreed to
    const termsAgreement = document.getElementById("termsAgreement");
    console.log('Terms agreement checkbox found:', termsAgreement);
    console.log('Terms agreement checked:', termsAgreement ? termsAgreement.checked : 'checkbox not found');
    
    if (!termsAgreement || !termsAgreement.checked) {
      console.log('Terms agreement validation failed');
      showToast(
        "Please agree to the Terms of Service and Privacy Policy to continue.",
        "error"
      );
      return;
    }

    // Show loading state
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Creating Account...";
    submitBtn.disabled = true;

    try {
      if (!ENABLE_SUPABASE) {
        console.log("Supabase disabled, using mock signup...");
        // Fallback to mock signup system
        showToast(
          "Account created! Please verify your email address.",
          "success"
        );

        // Store signup data for email verification
        sessionStorage.setItem("signup_email", email);
        sessionStorage.setItem("signup_fullName", fullName);
        sessionStorage.setItem("signup_username", username);
        sessionStorage.setItem("signup_phone", phone);

        setTimeout(() => {
          window.location.href = "/login?verify=1";
        }, 1200);
        return;
      }

      if (supabase && typeof supabase.auth !== "undefined") {
        console.log("Attempting Supabase signup...");
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            // Where Supabase should redirect after the user clicks the email link
            emailRedirectTo: `${window.location.origin}/login?verified=1`,
            data: {
              name: fullName,
              username: username,
              phone: phone,
              role: "citizen",
            },
          },
        });

        if (data && data.user) {
          console.log("Supabase signup successful:", data.user);
          console.log("User email confirmed:", data.user.email_confirmed_at);
          console.log("User needs email confirmation:", data.user.email_confirmed_at === null);
          
          if (data.user.email_confirmed_at === null) {
            showToast(
              "Account created! Please check your email and click the verification link.",
              "success"
            );
          } else {
            showToast(
              "Account created and email already verified! You can now log in.",
              "success"
            );
          }

          // Store signup data for email verification
          sessionStorage.setItem("signup_email", email);
          sessionStorage.setItem("signup_fullName", fullName);
          sessionStorage.setItem("signup_username", username);
          sessionStorage.setItem("signup_phone", phone);
          sessionStorage.setItem("signup_user_id", data.user.id);

          setTimeout(() => {
            // Redirect to login with instruction to verify email
            window.location.href = "/login?verify=1";
          }, 1200);
          return;
        }

        if (error) {
          console.error("Supabase signup error:", error);
          showToast(`Signup failed: ${error.message}`, "error");
        }
      }
    } catch (error) {
      console.error("Signup error:", error);
      showToast("An error occurred during signup. Please try again.", "error");
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Initialize modals and ensure they work properly
document.addEventListener("DOMContentLoaded", () => {
  // Debug: Check if modals exist
  const termsModal = document.getElementById("termsModal");
  const privacyModal = document.getElementById("privacyModal");

  // Check if Bootstrap is loaded
  if (typeof bootstrap === "undefined") {
    console.error("Bootstrap is not loaded! Check the script path.");
    // Try to load Bootstrap dynamically as fallback
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js";
    script.onload = () => {
      initializeModals();
    };
    script.onerror = () => {
      console.error("Failed to load Bootstrap dynamically");
    };
    document.head.appendChild(script);
  } else {
    initializeModals();
  }

  function initializeModals() {
    // Initialize Bootstrap modals
    let termsBsModal, privacyBsModal;

    console.log("Terms modal element:", termsModal);
    console.log("Privacy modal element:", privacyModal);
    console.log("Bootstrap available:", typeof bootstrap !== "undefined");

    if (termsModal && typeof bootstrap !== "undefined") {
      try {
        termsBsModal = new bootstrap.Modal(termsModal);
        console.log("Terms modal initialized successfully");
      } catch (error) {
        console.error("Error initializing terms modal:", error);
      }
    }

    if (privacyModal && typeof bootstrap !== "undefined") {
      try {
        privacyBsModal = new bootstrap.Modal(privacyModal);
        console.log("Privacy modal initialized successfully");
      } catch (error) {
        console.error("Error initializing privacy modal:", error);
      }
    }

    // Add click event listeners for modal links
    const termsLinks = document.querySelectorAll(
      '[data-bs-target="#termsModal"]'
    );
    const privacyLinks = document.querySelectorAll(
      '[data-bs-target="#privacyModal"]'
    );

    console.log("Found terms links:", termsLinks.length);
    console.log("Found privacy links:", privacyLinks.length);

    termsLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Terms link clicked");
        if (termsBsModal) {
          console.log("Using Bootstrap modal");
          termsBsModal.show();
        } else if (termsModal) {
          console.log("Using fallback modal");
          // Fallback to manual show
          termsModal.style.display = "block";
          termsModal.classList.add("show");
          termsModal.setAttribute("aria-hidden", "false");
          document.body.classList.add("modal-open");
        }
      });
    });

    privacyLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Privacy link clicked");
        if (privacyBsModal) {
          console.log("Using Bootstrap modal");
          privacyBsModal.show();
        } else if (privacyModal) {
          console.log("Using fallback modal");
          // Fallback to manual show
          privacyModal.style.display = "block";
          privacyModal.classList.add("show");
          privacyModal.setAttribute("aria-hidden", "false");
          document.body.classList.add("modal-open");
        }
      });
    });

    // Add manual close functionality
    const closeButtons = document.querySelectorAll('[data-bs-dismiss="modal"]');
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const modal = button.closest(".modal");
        if (modal) {
          if (modal === termsModal && termsBsModal) {
            termsBsModal.hide();
          } else if (modal === privacyModal && privacyBsModal) {
            privacyBsModal.hide();
          } else {
            // Fallback to manual hide
            modal.style.display = "none";
            modal.classList.remove("show");
            modal.setAttribute("aria-hidden", "true");
            document.body.classList.remove("modal-open");
          }
        }
      });
    });

    // Add backdrop click to close
    [termsModal, privacyModal].forEach((modal) => {
      if (modal) {
        modal.addEventListener("click", (e) => {
          if (e.target === modal) {
            if (modal === termsModal && termsBsModal) {
              termsBsModal.hide();
            } else if (modal === privacyModal && privacyBsModal) {
              privacyBsModal.hide();
            } else {
              modal.style.display = "none";
              modal.classList.remove("show");
              modal.setAttribute("aria-hidden", "true");
              document.body.classList.remove("modal-open");
            }
          }
        });
      }
    });
  }
});
