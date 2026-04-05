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

  // Initialize state
  updateStepVisibility();
  updateButtons();
  updateProgress();

  // Event Listeners
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (validateStep(currentStep)) {
        if (currentStep < totalSteps - 1) {
          currentStep++;
          updateStepVisibility();
          updateButtons();
          updateProgress();
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
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

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
    // Back button
    if (backBtn) {
      backBtn.style.display = currentStep === 0 ? "none" : "flex";
    }

    // Next/Submit buttons logic
    const isLastStep = currentStep === totalSteps - 1;

    if (nextBtn) {
      nextBtn.style.display = isLastStep ? "none" : "flex";
    }

    if (submitBtn) {
      submitBtn.style.display = isLastStep ? "flex" : "none";
    }

    // Ensure wrapper is always visible if it exists
    const submitWrapper = document.querySelector(".submit-wrapper");
    if (submitWrapper) {
      submitWrapper.style.display = "block";
      // Optional: ensure flex for centering if needed by CSS
      submitWrapper.style.display = "flex";
      submitWrapper.style.justifyContent = "center";
    }
  }

  function updateProgress() {
    // Update Step Indicators
    stepIndicators.forEach((indicator, index) => {
      if (index <= currentStep) {
        indicator.classList.add("active");
      } else {
        indicator.classList.remove("active");
      }
    });

    // Update Progress Bar
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
      // Handle visible inputs only (some might be hidden libs)
      if (input.type === "hidden") {
        // Check if it has a paired visible input or if it's truly required logic
        // For now, simple check
        if (!input.value) isValid = false;
      } else if (!input.checkValidity()) {
        isValid = false;
        input.reportValidity();
        if (!firstError) firstError = input;
      }
    });

    // Custom validations (based on step id, not brittle indexes)
    if (step.id === "step-basic") {
      const cat = document.getElementById("complaintCategory");
      const subcat = document.getElementById("complaintSubcategory");

      if (cat && (!cat.value || !cat.value.trim())) {
        isValid = false;
        if (!firstError) firstError = cat;
      }

      if (subcat && (!subcat.value || !subcat.value.trim())) {
        isValid = false;
        if (!firstError) firstError = subcat;
      }

      if (!isValid) {
        showMessage("warning", "Please select a category and subcategory.");
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
}
