/**
 * Progressive Form Controller
 * Handles the multi-step wizard logic for the complaint form
 */

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
            } else {
                if (!input.checkValidity()) {
                    isValid = false;
                    input.reportValidity();
                    if (!firstError) firstError = input;
                }
            }
        });

        // Custom validations
        if (stepIndex === 2) { // Basic Info
            const cat = document.getElementById("complaintCategory");
            const subcat = document.getElementById("complaintSubcategory");

            if (!cat.value || !subcat.value) {
                isValid = false;
                // Highlight or show toast
                // For simplicity, rely on html5 reportValidity above if they are required
                // But Selects sometimes don't trigger reportValidity nicely if custom styled
            }
        }

        if (stepIndex === 1) { // Location
            const location = document.getElementById("location");
            if (!location.value) {
                isValid = false;
                // Toast
                alert("Please pin a location on the map."); // Replace with toast later
            }
        }

        if (stepIndex === 0) { // Details (Now Step 1)
            const desc = document.getElementById("description");
            if (!desc.value.trim()) {
                isValid = false;
                desc.reportValidity();
            }
        }

        return isValid;
    }
}
