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

const initialStepLogic = (steps) => {
  let initialStep = 0;
  try {
    const navEntries = performance.getEntriesByType("navigation");
    const navType = navEntries?.[0]?.type;
    const isReload =
      navType === "reload" ||
      navType === "back_forward" ||
      performance?.navigation?.type === 1;

    if (!isReload) {
      const { referrer } = document;
      const isInternal =
        referrer && referrer.includes(globalThis.location.hostname);
      const isSignupUrl = referrer && referrer.includes("/signup");
      if (!isInternal || !isSignupUrl) resetSignupData();
    }
    const saved = sessionStorage.getItem(STEP_STORAGE_KEY);
    if (saved !== null) {
      initialStep = Number.parseInt(saved, 10);
      if (
        Number.isNaN(initialStep) ||
        initialStep < 0 ||
        initialStep >= steps.length
      )
        initialStep = 0;
    }
  } catch (e) {
    console.warn("Persistent signup init error:", e);
  }
  return initialStep;
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
    if (match) select.value = match;
  }
  select.dataset.populated = "true";
};

const setupMethodSelection = (methodSection, emailFlow) => {
  const emailMethodBtn = document.querySelector('[data-signup-method="email"]');
  const backToMethodsBtn = document.getElementById("signup-method-back");

  if (emailMethodBtn && methodSection && emailFlow) {
    emailMethodBtn.addEventListener("click", () => {
      methodSection.hidden = true;
      emailFlow.hidden = false;
      sessionStorage.setItem(FLOW_ACTIVE_KEY, "true");
      setTimeout(() => {
        emailFlow.querySelector("input")?.focus();
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
};

const setupNavigationCleanup = () => {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link?.href) {
      try {
        const url = new URL(link.href);
        if (
          url.origin === globalThis.location.origin &&
          !url.pathname.includes("/signup") &&
          !link.dataset.skipSignupCleanup
        ) {
          resetSignupData();
        }
      } catch (err) {
        console.debug("Navigation cleanup skip:", err);
      }
    }
  });
};

const setupPasswordToggle = () => {
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const icon = button.querySelector("svg");
      if (input.type === "password") {
        input.type = "text";
        icon.innerHTML =
          '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
      } else {
        input.type = "password";
        icon.innerHTML =
          '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      }
    });
  });
};

document.addEventListener("DOMContentLoaded", () => {
  initBarangaySelect();
  const methodSection = document.getElementById("signup-method-section");
  const emailFlow = document.getElementById("signup-email-flow");
  setupMethodSelection(methodSection, emailFlow);
  setupNavigationCleanup();

  const stepsRoot = document.getElementById("signup-steps");
  if (!stepsRoot) return;

  const steps = Array.from(stepsRoot.querySelectorAll(".signup-step"));
  const nextBtn = document.getElementById("signup-next-btn");
  const prevBtn = document.getElementById("signup-prev-btn");
  const submitBtn = document.getElementById("signup-submit-btn");
  const progressBar = document.getElementById("signup-progress-bar");
  const progressLabel = document.getElementById("signup-progress-label");
  const progressFill = document.getElementById("signup-progress-fill");
  let current = 0;

  const updateProgress = () => {
    const pct =
      steps.length > 1 ? Math.round((current / (steps.length - 1)) * 100) : 0;
    if (progressBar?.tagName === "PROGRESS") {
      progressBar.value = pct;
    } else if (progressFill) {
      progressFill.style.width = `${pct}%`;
      if (progressBar) progressBar.setAttribute("aria-valuenow", String(pct));
    }
    if (progressLabel) {
      progressLabel.textContent = `Step ${current + 1} of ${
        steps.length
      } · ${pct}% complete`;
    }
  };

  const showStep = (index) => {
    steps.forEach((s, i) => {
      s.hidden = i !== index;
    });
    current = index;
    if (prevBtn) prevBtn.hidden = index === 0;
    const isLast = index === steps.length - 1;
    if (nextBtn) nextBtn.hidden = isLast;
    if (submitBtn) submitBtn.hidden = !isLast;
    updateProgress();
    steps[index].querySelector("input,select,textarea,button")?.focus();
    try {
      sessionStorage.setItem(STEP_STORAGE_KEY, String(current));
    } catch (e) {
      console.debug("Failed to save step index:", e);
    }
  };

  const validateCurrentStep = () => {
    const inputs = Array.from(
      steps[current].querySelectorAll("input,select,textarea")
    ).filter((i) => i.closest("form"));
    for (const el of inputs) {
      if (el.disabled || el.hidden) continue;
      if (el.hasAttribute("required") && !el.checkValidity()) {
        el?.reportValidity?.();
        el.focus();
        return false;
      }
    }
    const idPlaceholder = steps[current].querySelector("#id-step-placeholder");
    if (
      idPlaceholder &&
      sessionStorage.getItem("cl_verification_complete") !== "true"
    ) {
      showMessage(
        "error",
        "Verification failed. Please ensure your ID matches your profile information before proceeding."
      );
      return false;
    }
    return true;
  };

  const saveFormData = () => {
    const formData = {};
    stepsRoot.querySelectorAll("input, select, textarea").forEach((input) => {
      if (!input.name) return;
      if (input.type === "checkbox" || input.type === "radio") {
        if (input.checked) formData[input.name] = input.value;
      } else {
        formData[input.name] = input.value;
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
        stepsRoot.querySelectorAll("input, select, textarea").forEach((i) => {
          if (i.type === "checkbox" || i.type === "radio") i.checked = false;
          else if (i.tagName !== "BUTTON") i.value = "";
        });
      }
    } catch (e) {
      console.warn("Failed to restore form data:", e);
    }
  };

  if (nextBtn)
    nextBtn.addEventListener("click", () => {
      if (validateCurrentStep())
        showStep(Math.min(current + 1, steps.length - 1));
    });
  if (prevBtn)
    prevBtn.addEventListener("click", () => {
      showStep(Math.max(current - 1, 0));
    });

  stepsRoot.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "SELECT" ||
          active.tagName === "TEXTAREA")
      ) {
        if (current < steps.length - 1) {
          e.preventDefault();
          nextBtn?.click();
        }
      }
    }
  });

  stepsRoot.addEventListener("input", saveFormData);
  stepsRoot.addEventListener("change", saveFormData);

  const initialStep = initialStepLogic(steps);
  restoreFormData();
  const isFlowActive = sessionStorage.getItem(FLOW_ACTIVE_KEY) === "true";
  if (initialStep > 0 || isFlowActive) {
    if (methodSection && emailFlow) {
      methodSection.hidden = true;
      emailFlow.hidden = false;
    }
  }
  showStep(initialStep);

  document.addEventListener("signup-reset", () => {
    resetSignupData();
    showStep(0);
    if (emailFlow && methodSection) {
      emailFlow.hidden = true;
      methodSection.hidden = false;
    }
  });

  document.addEventListener("click", (e) => {
    if (
      e.target.closest("#signup-btn") &&
      globalThis.location.pathname.includes("/signup")
    ) {
      document.dispatchEvent(new CustomEvent("signup-reset"));
    }
  });

  setupPasswordToggle();
});

export const signupProgressiveVersion = "1.0.0";
