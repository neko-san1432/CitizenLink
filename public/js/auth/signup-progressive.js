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
      // focus first input
      setTimeout(() => {
        const firstInput = emailFlow.querySelector("input");
        if (firstInput) firstInput.focus();
      }, 50);
    });
  }

  if (backToMethodsBtn && methodSection && emailFlow) {
    backToMethodsBtn.addEventListener("click", () => {
      emailFlow.hidden = true;
      methodSection.hidden = false;
    });
  }
});

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

  const STEP_STORAGE_KEY = "cl_signup_step_index";

  function showStep(index) {
    steps.forEach((s, i) => {
      s.hidden = i !== index;
    });
    current = index;
    // Controls
    prevBtn.hidden = index === 0;
    const isLast = index === steps.length - 1;
    nextBtn.hidden = isLast;
    submitBtn.hidden = !isLast;
    updateProgress();
    // focus first input in step
    const first = steps[index].querySelector("input,select,textarea,button");
    if (first) first.focus();

    // Save current step
    try {
      sessionStorage.setItem(STEP_STORAGE_KEY, String(current));
    } catch (e) {}
  }

  function updateProgress() {
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
  }

  function validateCurrentStep() {
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
    const idPlaceholder = steps[current].querySelector("#id-step-placeholder");
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
  }

  nextBtn &&
    nextBtn.addEventListener("click", () => {
      if (!validateCurrentStep()) return;
      showStep(Math.min(current + 1, steps.length - 1));
    });
  prevBtn &&
    prevBtn.addEventListener("click", () => {
      showStep(Math.max(current - 1, 0));
    });

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

  // Form Data Persistence
  const FORM_DATA_KEY = "cl_signup_form_data";

  function saveFormData() {
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
  }

  function restoreFormData() {
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
      }
    } catch (e) {
      console.warn("Failed to restore form data:", e);
    }
  }

  // Listen for changes
  stepsRoot.addEventListener("input", saveFormData);
  stepsRoot.addEventListener("change", saveFormData); // For select/checkbox

  // initialize
  let initialStep = 0;
  try {
    // Check if we should reset (e.g. came from a different page)
    const referrer = document.referrer;
    const isInternal = referrer && referrer.includes(window.location.hostname);
    const isSignupUrl = referrer && referrer.includes("/signup");

    if (!isInternal || (!isSignupUrl && referrer !== "")) {
      // Fresh arrival from outside or different internal page - reset
      sessionStorage.removeItem(STEP_STORAGE_KEY);
      sessionStorage.removeItem(FORM_DATA_KEY);
      sessionStorage.removeItem("cl_verification_complete");
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
  } catch (e) {}

  // Restore data before showing step
  restoreFormData();

  // If resuming from a saved step, ensure the email flow is visible
  if (initialStep > 0) {
    const methodSection = document.getElementById("signup-method-section");
    const emailFlow = document.getElementById("signup-email-flow");
    if (methodSection && emailFlow) {
      methodSection.hidden = true;
      emailFlow.hidden = false;
    }
  }

  showStep(initialStep);

  // Listen for reset event from other scripts
  document.addEventListener("signup-reset", () => {
    showStep(0);
    try {
      sessionStorage.removeItem(STEP_STORAGE_KEY);
      sessionStorage.removeItem(FORM_DATA_KEY);
      sessionStorage.removeItem("cl_verification_complete");
      // Clear inputs
      stepsRoot.querySelectorAll("input, select, textarea").forEach((i) => {
        if (i.type === "checkbox" || i.type === "radio") i.checked = false;
        else i.value = "";
      });
    } catch {}
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
}

export {};
