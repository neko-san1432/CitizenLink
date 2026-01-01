import showMessage from "../components/toast.js";

// Lightweight progressive signup step manager
const BARANGAY_LIST = [
  "Aplaya",
  "Balabag",
  "Binaton",
  "Cogon",
  "Colorado",
  "Dawis",
  "Dulangan",
  "Goma",
  "Igpit",
  "Kiagot",
  "Lungag",
  "Mahayahay",
  "Matti",
  "Kapatagan (Rizal)",
  "Ruparan",
  "San Agustin",
  "San Jose (Balutakay)",
  "San Miguel (Odaca)",
  "San Roque",
  "Sinawilan",
  "Soong",
  "Tiguman",
  "Tres de Mayo",
  "Zone 1 (Pob.)",
  "Zone 2 (Pob.)",
  "Zone 3 (Pob.)",
];

const STEP_STORAGE_KEY = "cl_signup_step_index";
const FORM_DATA_KEY = "cl_signup_form_data";
const FLOW_ACTIVE_KEY = "cl_signup_flow_active";

const resetSignupData = () => {
  sessionStorage.removeItem(STEP_STORAGE_KEY);
  sessionStorage.removeItem(FORM_DATA_KEY);
  sessionStorage.removeItem(FLOW_ACTIVE_KEY);
  sessionStorage.removeItem("cl_verification_complete");

  const emailFlow = document.getElementById("signup-email-flow");
  if (emailFlow) {
    emailFlow.querySelectorAll("input, select, textarea").forEach((i) => {
      if (i.type === "checkbox" || i.type === "radio") i.checked = false;
      else i.value = "";
    });
  }
};

const initBarangaySelect = () => {
  const select = document.getElementById("barangay");
  if (!select || select.dataset.populated === "true") return;

  const currentValue = select.value;
  select.innerHTML = '<option value="" selected>Select barangay</option>';
  BARANGAY_LIST.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  if (currentValue) {
    const match = BARANGAY_LIST.find(
      (b) => b.toLowerCase() === currentValue.toLowerCase()
    );
    if (match) {
      select.value = match;
    }
  }
  select.dataset.populated = "true";
};

document.addEventListener("DOMContentLoaded", () => {
  initBarangaySelect();

  // Method Selection Logic
  const methodSection = document.getElementById("signup-method-section");
  const emailFlow = document.getElementById("signup-email-flow");
  const emailMethodBtn = document.querySelector('[data-signup-method="email"]');
  const backToMethodsBtn = document.getElementById("signup-method-back");

  if (emailMethodBtn && methodSection && emailFlow) {
    emailMethodBtn.addEventListener("click", () => {
      methodSection.hidden = true;
      emailFlow.hidden = false;
      sessionStorage.setItem(FLOW_ACTIVE_KEY, "true");
      // focus first input
      setTimeout(() => {
        const firstInput = emailFlow.querySelector("input");
        if (firstInput) firstInput.focus();
      }, 50);
    });
  }

  if (backToMethodsBtn && methodSection && emailFlow) {
    backToMethodsBtn.addEventListener("click", () => {
      resetSignupData();
      emailFlow.hidden = true;
      methodSection.hidden = false;
    });
  }

  // Clear data when navigating away to other pages
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link && link.href) {
      try {
        const url = new URL(link.href);
        if (
          url.origin === window.location.origin &&
          !url.pathname.includes("/signup") &&
          !link.hasAttribute("data-skip-signup-cleanup")
        ) {
          resetSignupData();
        }
      } catch (err) {}
    }
  });

  // Steps UI logic
  const stepsRoot = document.getElementById("signup-steps");
  if (stepsRoot) {
    const steps = Array.from(stepsRoot.querySelectorAll(".signup-step"));
    const nextBtn = document.getElementById("signup-next-btn");
    const prevBtn = document.getElementById("signup-prev-btn");
    const submitBtn = document.getElementById("signup-submit-btn");
    const progressFill = document.getElementById("signup-progress-fill");
    const progressLabel = document.getElementById("signup-progress-label");
    const progressBar = progressFill ? progressFill.parentElement : null;
    let current = 0;

    const showStep = (index) => {
      steps.forEach((s, i) => {
        s.hidden = i !== index;
      });
      current = index;
      // Controls
      if (prevBtn) prevBtn.hidden = index === 0;
      const isLast = index === steps.length - 1;
      if (nextBtn) nextBtn.hidden = isLast;
      if (submitBtn) submitBtn.hidden = !isLast;
      updateProgress();
      // focus first input in step
      const first = steps[index].querySelector("input,select,textarea,button");
      if (first) first.focus();

      // Save current step
      try {
        sessionStorage.setItem(STEP_STORAGE_KEY, String(current));
      } catch (e) {}
    };

    const updateProgress = () => {
      const pct =
        steps.length > 1 ? Math.round((current / (steps.length - 1)) * 100) : 0;
      if (progressFill) progressFill.style.width = `${pct}%`;
      if (progressBar) {
        progressBar.setAttribute("aria-valuenow", String(pct));
      }
      if (progressLabel) {
        progressLabel.textContent = `Step ${current + 1} of ${
          steps.length
        } · ${pct}% complete`;
      }
    };

    const validateCurrentStep = () => {
      const inputs = Array.from(
        steps[current].querySelectorAll("input,select,textarea")
      ).filter((i) => i.closest("form"));
      for (const el of inputs) {
        // skip disabled or hidden fields
        if (el.disabled || el.hidden) continue;
        if (el.hasAttribute("required")) {
          if (!el.checkValidity()) {
            el.reportValidity && el.reportValidity();
            el.focus();
            return false;
          }
        }
      }

      // Check for ID verification step
      const idPlaceholder = steps[current].querySelector(
        "#id-step-placeholder"
      );
      if (idPlaceholder) {
        const passed =
          sessionStorage.getItem("cl_verification_complete") === "true";
        if (!passed) {
          showMessage(
            "error",
            "Verification failed. Please ensure your ID matches your profile information before proceeding."
          );
          return false;
        }
      }

      return true;
    };

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (!validateCurrentStep()) return;
        showStep(Math.min(current + 1, steps.length - 1));
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        showStep(Math.max(current - 1, 0));
      });
    }

    // keyboard: Enter should move to next only when not on final step
    stepsRoot.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "SELECT" ||
            active.tagName === "TEXTAREA")
        ) {
          // prevent form submit on Enter in steps (except final)
          if (current < steps.length - 1) {
            e.preventDefault();
            nextBtn && nextBtn.click();
          }
        }
      }
    });

    const saveFormData = () => {
      const formData = {};
      const inputs = stepsRoot.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        if (input.name) {
          if (input.type === "checkbox" || input.type === "radio") {
            if (input.checked) {
              formData[input.name] = input.value;
            }
          } else {
            formData[input.name] = input.value;
          }
        }
      });
      try {
        sessionStorage.setItem(FORM_DATA_KEY, JSON.stringify(formData));
      } catch (e) {
        console.warn("Failed to save form data:", e);
      }
    };

    const restoreFormData = () => {
      try {
        const saved = sessionStorage.getItem(FORM_DATA_KEY);
        if (saved) {
          const formData = JSON.parse(saved);
          Object.entries(formData).forEach(([name, value]) => {
            const input = stepsRoot.querySelector(`[name="${name}"]`);
            if (input) {
              if (input.type === "checkbox" || input.type === "radio") {
                if (input.value === value) input.checked = true;
              } else {
                input.value = value;
              }
            }
          });
        } else {
          // If no saved data, ensure DOM fields are empty
          // This prevents browser-native form state restoration from re-filling fields
          // after they were cleared via resetSignupData() in a previous interaction.
          stepsRoot.querySelectorAll("input, select, textarea").forEach((i) => {
            if (i.type === "checkbox" || i.type === "radio") i.checked = false;
            else if (i.tagName !== "BUTTON") i.value = "";
          });
        }
      } catch (e) {
        console.warn("Failed to restore form data:", e);
      }
    };

    // Listen for changes
    stepsRoot.addEventListener("input", saveFormData);
    stepsRoot.addEventListener("change", saveFormData); // For select/checkbox

    // initialize
    let initialStep = 0;
    try {
      // Check for reload
      const navEntries = performance.getEntriesByType("navigation");
      const navType = navEntries.length > 0 ? navEntries[0].type : null;
      const isReload =
        navType === "reload" ||
        navType === "back_forward" ||
        (performance.navigation && performance.navigation.type === 1);

      if (!isReload) {
        // Check if we arrived from a different page or direct entry
        const referrer = document.referrer;
        const isInternal =
          referrer && referrer.includes(window.location.hostname);
        const isSignupUrl = referrer && referrer.includes("/signup");

        // If from outside, from a different internal page, or if referrer is missing
        if (!isInternal || !isSignupUrl) {
          resetSignupData();
        }
      }

      const saved = sessionStorage.getItem(STEP_STORAGE_KEY);
      if (saved !== null) {
        initialStep = parseInt(saved, 10);
        if (
          isNaN(initialStep) ||
          initialStep < 0 ||
          initialStep >= steps.length
        ) {
          initialStep = 0;
        }
      }
    } catch (e) {
      console.warn("Persistent signup init error:", e);
    }

    // Restore data before showing step
    restoreFormData();

    // If flow was active, ensure the email flow is visible
    const isFlowActive = sessionStorage.getItem(FLOW_ACTIVE_KEY) === "true";
    if (initialStep > 0 || isFlowActive) {
      if (methodSection && emailFlow) {
        methodSection.hidden = true;
        emailFlow.hidden = false;
      }
    }

    showStep(initialStep);

    // Listen for reset event from other scripts
    document.addEventListener("signup-reset", () => {
      resetSignupData();
      showStep(0);
      if (emailFlow && methodSection) {
        emailFlow.hidden = true;
        methodSection.hidden = false;
      }
    });

    // Global click listener for Sign Up buttons to trigger reset if already on page
    document.addEventListener("click", (e) => {
      const signupBtn = e.target.closest("#signup-btn");
      if (signupBtn) {
        // If clicking "Sign up" while already on signup page, reset flow
        if (window.location.pathname.includes("/signup")) {
          document.dispatchEvent(new CustomEvent("signup-reset"));
        }
      }
    });

    // Password Toggle Logic
    const toggleButtons = document.querySelectorAll(".password-toggle");
    toggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const input = button.parentElement.querySelector("input");
        const icon = button.querySelector("svg");

        if (input.type === "password") {
          input.type = "text";
          // Switch to eye-off icon
          icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          `;
        } else {
          input.type = "password";
          // Switch back to eye icon
          icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          `;
        }
      });
    });
  }
});

export {};
