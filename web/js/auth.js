// Use shared Supabase manager instead of duplicating initialization code
let supabase = null;

// Initialize Supabase configuration using shared manager
async function initializeAuthSupabase() {
  try {
    // Use the shared manager to get Supabase client
    supabase = await window.supabaseManager.initialize();
  } catch (error) {
    // Error initializing Supabase
  }
}

// Redirect user based on their role
function redirectBasedOnRole(user) {
  // Check user metadata for role
  const userRole = String(user.role || user.user_metadata?.role || "").toLowerCase();
  if (userRole === "superadmin") {
    window.location.href = "/superadmin/appointments";
    return;
  }
  const isLgu = (
    userRole === "lgu" ||
    userRole === "lgu_admin" ||
    userRole === "admin" ||
    userRole.startsWith("lgu-") ||
    userRole.startsWith("lgu-admin-")
  );
  window.location.href = isLgu ? "/lgu/dashboard" : "/dashboard";
}

// Initialize Supabase when the script loads
// Only initialize once to prevent conflicts
initializeAuthSupabase();

// Logout function
window.logout = async function () {
  try {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Supabase logout error
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
    // Force redirect even if there's an error
    window.location.href = "/login";
  }
};

// Check authentication status on page load
document.addEventListener("DOMContentLoaded", () => {
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

  // Check if user is already logged in and redirect if on login/signup pages
  const user = sessionStorage.getItem("user");
  if (user) {
    try {
      const userData = JSON.parse(user);

      // Check if we're on a page that requires authentication
      const currentPath = window.location.pathname;
      const authRequiredPages = ["/login", "/signup"];

      if (authRequiredPages.includes(currentPath)) {
        // Redirect to appropriate dashboard
        const rawRole = String(userData.role || userData.type || "").toLowerCase();
        if (rawRole === "superadmin") {
          window.location.href = "/superadmin/appointments";
          return;
        }
        const isLgu = (
          rawRole === "lgu" ||
          rawRole === "lgu_admin" ||
          rawRole === "admin" ||
          rawRole.startsWith("lgu-") ||
          rawRole.startsWith("lgu-admin-")
        );
        window.location.href = isLgu ? "/lgu/dashboard" : "/dashboard";
      }
    } catch (error) {
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
      if (supabase) {
        // Supabase authentication
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        });

        // Verbose error logging to diagnose auth 500s
        if (error) {
          try {
            console.error(
              "Auth signInWithPassword failed",
              {
                status: error.status,
                code: error.code,
                message: error.message,
                name: error.name,
                stack: error.stack
              }
            );
          } catch (_) {}
          showToast(`Login failed: ${error.message}`, "error");
          return;
        }

        if (data && data.user) {
          // Store user data in session
          const userData = {
            id: data.user.id,
            email: data.user.email,
            type: data.user.user_metadata?.role || "citizen",
            role: data.user.user_metadata?.role || "citizen",
            name: data.user.user_metadata?.name || data.user.email
          };
          
          sessionStorage.setItem("user", JSON.stringify(userData));
          showToast("Login successful! Redirecting...", "success");
          
          setTimeout(() => {
            redirectBasedOnRole(userData);
          }, 1000);
        }
      } else {
        showToast("Authentication service not available. Please contact administrator.", "error");
      }
    } catch (error) {
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
      return;
    } catch (error) {
      // Error showing Bootstrap toast
    }
  }

  // Fallback toast
  if (type === "error") {
    // Show error message
  } else {
    // Show success message
  }
}

// Signup form
const signupForm = document.getElementById("signup-form");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const username = document.getElementById("username").value.trim();
    const phoneInput = document.getElementById("phone").value;
    const phone = phoneInput.trim().replace(/[\s-]/g, '');
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    // Validate full name
    if (!fullName || fullName.length < 2) {
      showToast("Please enter a valid full name (at least 2 characters).", "error");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast("Please enter a valid email address.", "error");
      return;
    }

    // Validate username
    if (!username || username.length < 3) {
      showToast("Username must be at least 3 characters long.", "error");
      return;
    }

    // Username can only contain letters, numbers, and underscores
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      showToast("Username can only contain letters, numbers, and underscores.", "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match. Please try again.", "error");
      return;
    }

    // Validate phone number format (Philippine format)
    // Allow either +63XXXXXXXXXX or 0XXXXXXXXXX (10 digits after the prefix)
    const phoneRegex = /^(\+63|0)\d{10}$/;
    const isValid = phoneRegex.test(phone);
    
    if (!isValid) {
      showToast(
        "Please enter a valid Philippine phone number (e.g., +639123456789 or 09123456789)",
        "error"
      );
      return;
    }

    // Check if terms are agreed to
    const termsAgreement = document.getElementById("termsAgreement");
    
    if (!termsAgreement || !termsAgreement.checked) {
      showToast(
        "Please agree to the Terms of Service and Privacy Policy to continue.",
        "error"
      );
      return;
    }

    // Check if username and email are already taken
    

    // Show loading state
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Creating Account...";
    submitBtn.disabled = true;

    try {
      if (supabase) {
        // Supabase signup
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            emailRedirectTo: `${window.location.origin}/login?verified=1`,
            data: {
              name: fullName,
              username: username,
              phone: phone,
              role: "citizen",
            },  
          },
        });

        if (error) {
          showToast(`Signup failed: ${error.message}`, "error");
          return;
        }

        if (data && data.user) {
          showToast(
            "Account created! Please check your email and click the verification link.",
            "success"
          );

          // Store signup data for email verification
          sessionStorage.setItem("signup_email", email);
          sessionStorage.setItem("signup_fullName", fullName);
          sessionStorage.setItem("signup_username", username);
          sessionStorage.setItem("signup_phone", phone);
          sessionStorage.setItem("signup_user_id", data.user.id);

          setTimeout(() => {
            window.location.href = "/login?verify=1";
          }, 1200);
        }
      } else {
        showToast("Authentication service not available. Please contact administrator.", "error");
      }
    } catch (error) {
      showToast("An error occurred during signup. Please try again.", "error");
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// Add real-time validation functions
window.checkUsernameAvailability = async function(username) {
  if (!username || username.length < 3) {
    return { available: false, message: "Username must be at least 3 characters" };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { available: false, message: "Username can only contain letters, numbers, and underscores" };
  }

  try {
    if (supabase) {
      const { data: existing, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();

      if (existing) {
        return { available: false, message: "Username is already taken" };
      } else {
        return { available: true, message: "Username is available" };
      }
    }
  } catch (error) {
    return { available: false, message: "Unable to check username availability" };
  }

  return { available: true, message: "Username is available" };
};

window.checkEmailAvailability = async function(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { available: false, message: "Please enter a valid email address" };
  }

  try {
    if (supabase) {
      const { data: existing, error } = await supabase
        .from('users')
        .select('email, email_confirmed_at')
        .eq('email', email)
        .single();

      if (existing) {
        if (existing.email_confirmed_at) {
          return { available: false, message: "Email is already registered and verified" };
        } else {
          return { available: false, message: "Email is registered but not verified" };
        }
      } else {
        return { available: true, message: "Email is available" };
      }
    }
  } catch (error) {
    return { available: false, message: "Unable to check email availability" };
  }

  return { available: true, message: "Email is available" };
};

// Initialize modals and ensure they work properly
document.addEventListener("DOMContentLoaded", () => {
  // Check if modals exist
  const termsModal = document.getElementById("termsModal");
  const privacyModal = document.getElementById("privacyModal");

  // Check if Bootstrap is loaded
  if (typeof bootstrap === "undefined") {
    // Try to load Bootstrap dynamically as fallback
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js";
    script.onload = () => {
      initializeModals();
    };
    script.onerror = () => {
      // Bootstrap loading failed
    };
    document.head.appendChild(script);
  } else {
    initializeModals();
  }

  function initializeModals() {
    // Initialize Bootstrap modals
    let termsBsModal, privacyBsModal;

    if (termsModal && typeof bootstrap !== "undefined") {
      try {
        termsBsModal = new bootstrap.Modal(termsModal);
      } catch (error) {
        // Error initializing terms modal
      }
    }

    if (privacyModal && typeof bootstrap !== "undefined") {
      try {
        privacyBsModal = new bootstrap.Modal(privacyModal);
      } catch (error) {
        // Error initializing privacy modal
      }
    }

    // Add click event listeners for modal links
    const termsLinks = document.querySelectorAll(
      '[data-bs-target="#termsModal"]'
    );
    const privacyLinks = document.querySelectorAll(
      '[data-bs-target="#privacyModal"]'
    );

    termsLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (termsBsModal) {
          termsBsModal.show();
        } else if (termsModal) {
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
        if (privacyBsModal) {
          privacyBsModal.show();
        } else if (privacyModal) {
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
