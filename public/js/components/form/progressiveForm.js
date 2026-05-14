/**
 * Progressive Form Controller
 * Handles the multi-step wizard logic for the complaint form
 */
import showMessage from "../toast.js";

export function initProgressiveForm() {
  const form = document.getElementById("complaintForm");
  if (!form) return;

  const steps = form.querySelectorAll(".form-step");
  const nextBtn = document.getElementById("btn-next");
  const backBtn = document.getElementById("btn-back");
  const submitBtn = document.getElementById("btn-submit-final");
  const stepIndicators = document.querySelectorAll(".step-indicator");
  const progressFill = document.querySelector(".progress-fill");

  let currentStep = 0;
  const totalSteps = steps.length;
  const STORAGE_KEY = "drims_complaint_draft";
  let isRestoring = false;

  // Persistence Logic
  function saveDraft() {
    if (isRestoring) return;
    const fields = {};
    const inputs = form.querySelectorAll("input:not([type='file']), select, textarea");
    inputs.forEach(input => {
      if (input.id) {
        if (input.type === "checkbox" || input.type === "radio") {
          fields[input.id] = input.checked;
        } else {
          fields[input.id] = input.value;
        }
      }
    });

    const draft = {
      currentStep,
      fields,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }

  async function restoreDraft() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      isRestoring = true;
      const draft = JSON.parse(saved);
      // 24 hour expiry for drafts
      if (Date.now() - draft.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        isRestoring = false;
        return;
      }

      // Restore simple fields first
      for (const [id, value] of Object.entries(draft.fields)) {
        const el = document.getElementById(id);
        if (!el || !value) continue;

        if (id === "complaintCategory" || id === "complaintSubcategory") continue; // Handle hierarchy separately

        if (el.type === "checkbox" || el.type === "radio") {
          el.checked = value;
        } else {
          el.value = value;
        }
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Handle Category Hierarchy Persistence
      const catSelect = document.getElementById("complaintCategory");
      const subcatSelect = document.getElementById("complaintSubcategory");

      if (catSelect && draft.fields.complaintCategory) {
        // Wait for categories to be populated by the other controller
        const waitForOptions = (select, targetValue) => {
          return new Promise(resolve => {
            let attempts = 0;
            const check = () => {
              attempts++;
              const options = Array.from(select.options).map(o => o.value);
              if (options.includes(targetValue)) {
                select.value = targetValue;
                select.dispatchEvent(new Event("change", { bubbles: true }));
                resolve(true);
              } else if (attempts < 50) {
                setTimeout(check, 100);
              } else {
                resolve(false);
              }
            };
            check();
          });
        };

        const catFound = await waitForOptions(catSelect, draft.fields.complaintCategory);
        if (catFound && subcatSelect && draft.fields.complaintSubcategory) {
          await waitForOptions(subcatSelect, draft.fields.complaintSubcategory);
        }
      }

      // Restore Step
      if (draft.currentStep > 0 && draft.currentStep < totalSteps) {
        currentStep = draft.currentStep;
        updateStepVisibility();
        updateButtons();
        updateProgress();
      }

      showMessage("info", "Draft restored from your last session.");
    } catch (e) {
      console.warn("[PROGRESSIVE_FORM] Failed to restore draft:", e);
    } finally {
      isRestoring = false;
    }
  }

  // Clear draft on successful submission
  window.addEventListener("complaint-submitted", () => {
    localStorage.removeItem(STORAGE_KEY);
  });

  // Navigation functions
  function updateStepVisibility() {
    steps.forEach((step, index) => {
      if (index === currentStep) {
        step.classList.add("active");
        step.style.display = "block";
        // Trigger map resize if this is the location step
        if (step.id === "step-location" || step.querySelector("#complaint-map")) {
          setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
            if (window.complaintMap) {
              window.complaintMap.invalidateSize();
            }
          }, 100);
        }
      } else {
        step.classList.remove("active");
        step.style.display = "none";
      }
    });
  }

  function updateButtons() {
    if (backBtn) {
      backBtn.style.display = currentStep === 0 ? "none" : "flex";
    }

    const isLastStep = currentStep === totalSteps - 1;
    if (nextBtn) {
      nextBtn.style.display = isLastStep ? "none" : "flex";
    }
    if (submitBtn) {
      submitBtn.style.display = isLastStep ? "flex" : "none";
    }

    const submitWrapper = document.querySelector(".submit-wrapper");
    if (submitWrapper) {
      submitWrapper.style.display = "flex";
      submitWrapper.style.justifyContent = "center";
    }
  }

  function updateProgress() {
    stepIndicators.forEach((indicator, index) => {
      if (index <= currentStep) {
        indicator.classList.add("active");
      } else {
        indicator.classList.remove("active");
      }
    });

    if (progressFill) {
      const progress = (currentStep / (totalSteps - 1)) * 100;
      progressFill.style.width = `${progress}%`;
    }
  }

  function validateStep(stepIndex) {
    const step = steps[stepIndex];
    const requiredInputs = step.querySelectorAll("[required], .required-field input, .required-field select, .required-field textarea");
    let isValid = true;
    let firstError = null;

    requiredInputs.forEach(input => {
      if (input.type === "hidden") {
        if (!input.value) isValid = false;
      } else if (!input.checkValidity()) {
        isValid = false;
        input.reportValidity();
        if (!firstError) firstError = input;
      }
    });

    // Custom validations (based on step id)
    if (step.id === "step-basic") {
      const cat = document.getElementById("complaintCategory");
      const subcat = document.getElementById("complaintSubcategory");

      const categoryName = cat && cat.selectedIndex >= 0 ? cat.options[cat.selectedIndex].text.toLowerCase() : "";
      const isOthers = categoryName.includes("other");

      if (cat && (!cat.value || !cat.value.trim())) {
        isValid = false;
        if (!firstError) firstError = cat;
      }

      // Subcategory is required unless category is "Others"
      if (!isOthers && subcat && (!subcat.value || !subcat.value.trim())) {
        isValid = false;
        if (!firstError) firstError = subcat;
      }

      if (!isValid) {
        if (cat && !cat.value) {
          showMessage("warning", "Please select a category.");
        } else if (!isOthers && subcat && !subcat.value) {
          showMessage("warning", "Please select a subcategory.");
        }
      }
    }

    if (step.id === "step-details") {
      const desc = document.getElementById("description");
      if (desc && !desc.value.trim()) {
        isValid = false;
        if (!firstError) firstError = desc;
        desc.reportValidity();
      }
    }

    if (step.id === "step-location") {
      const location = document.getElementById("location");
      if (location && !location.value) {
        isValid = false;
        showMessage("warning", "Please pin a location on the map.");
        if (!firstError) firstError = location;
      }
    }

    return isValid;
  }

  // Navigation Listeners
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (validateStep(currentStep)) {
        if (currentStep < totalSteps - 1) {
          currentStep++;
          updateStepVisibility();
          updateButtons();
          updateProgress();
          saveDraft();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (currentStep > 0) {
        currentStep--;
        updateStepVisibility();
        updateButtons();
        updateProgress();
        saveDraft();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  // Initialize
  updateStepVisibility();
  updateButtons();
  updateProgress();
  restoreDraft();

  // Saving listeners
  form.addEventListener("input", () => saveDraft());
  form.addEventListener("change", () => saveDraft());
}
