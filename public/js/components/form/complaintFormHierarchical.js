/**
 * Hierarchical Complaint Form Controller
 * Handles category -> subcategory -> department selection
 */
import { handleComplaintSubmit, resetComplaintForm } from "./formSubmission.js";
import { setupRealtimeValidation } from "../../utils/validation.js";
import {
  createComplaintFileHandler,
  setupDragAndDrop,
} from "../../utils/fileHandler.js";
import showMessage from "../toast.js";
import apiClient from "../../config/apiClient.js";
import {
  getActiveRole,
  isInCitizenMode,
  canSwitchToCitizen,
} from "../../auth/roleToggle.js";
import { getUserRole } from "../../auth/authChecker.js";

/**
 * Initialize hierarchical complaint form
 */

export async function initializeComplaintForm() {
  const form = document.getElementById("complaintForm");
  if (!form) {
    console.error("[COMPLAINT FORM] Form element not found");
    return;
  }
  // Check if user is citizen or in citizen mode
  // Try to get role from authChecker first (same as sidebar)
  let activeRole = null;
  try {
    activeRole = await getUserRole({ refresh: true });
  } catch (error) {
    console.warn(
      "[COMPLAINT FORM] Failed to get role from authChecker, trying roleToggle:",
      error
    );
    activeRole = getActiveRole();
  }
  const inCitizenMode = isInCitizenMode();
  if (activeRole !== "citizen" && !inCitizenMode) {
    const canSwitch = await canSwitchToCitizen();
    if (canSwitch) {
      showRoleSwitchRequired(form);
      return;
    }
    showMessage("error", "Only citizens can file complaints");
    form.style.display = "none";
    return;
  }
  // Get form elements
  const elements = {
    form,
    categorySelect: form.querySelector("#complaintCategory"),
    subcategorySelect: form.querySelector("#complaintSubcategory"),
    departmentCheckboxes: form.querySelector("#departmentCheckboxes"),
    fileDropZone: form.querySelector("#fileDropZone"),
    fileInput: form.querySelector("#evidenceFiles"),
    filePreview: form.querySelector("#filePreview"),
  };
  // Validate required elements
  const missingElements = Object.entries(elements)
    .filter(([key, element]) => !element && key !== "filePreview")
    .map(([key]) => key);
  if (missingElements.length > 0) {
    console.error(
      "[COMPLAINT FORM] Missing required elements:",
      missingElements
    );
    return;
  }
  // Initialize file handler with upload state callback
  const fileHandler = createComplaintFileHandler({
    previewContainer: elements.filePreview,
    onFilesChange: (_files) => {
      // console.log removed for security
    },
    onUploadStateChange: (isUploading) => {
      // Disable/enable buttons based on upload state
      const submitBtn = elements.form.querySelector(".submit-btn");
      const cancelBtn =
        elements.form.querySelector(".cancel-btn") ||
        document.querySelector(".cancel-btn");
      if (submitBtn) {
        submitBtn.disabled = isUploading;
      }
      if (cancelBtn) {
        cancelBtn.disabled = isUploading;
      }
    },
  });
  // Setup form functionality
  setupHierarchicalSelection(elements);
  setupFileHandling(elements.fileDropZone, elements.fileInput, fileHandler);
  // Load ALL departments immediately (regardless of category selection)
  loadAllDepartments(elements.departmentCheckboxes);
  setupFormValidation(elements.form);
  setupFormSubmission(elements.form, fileHandler);
  loadCategories();
  // Attach event listener to cancel button (moved from inline onclick)
  const cancelBtn = document.getElementById("btn-cancel-complaint");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      window.history.back();
    });
  }

  // Prevent any auto-focus behavior
  setTimeout(() => {
    if (document.activeElement && document.activeElement.tagName !== "BODY") {
      document.activeElement.blur();
    }
  }, 50);

  // Setup title auto-generation from description
  setupTitleAutoGeneration(form);

  // Setup voice input
  setupVoiceInput(form);

  // Setup duplicate detection
  setupDuplicateDetection(form);
}

/**
 * Setup Duplicate Detection
 * Checks for similar complaints when location or category changes
 */
function setupDuplicateDetection(form) {
  const categorySelect = form.querySelector("#complaintCategory");
  const subcategorySelect = form.querySelector("#complaintSubcategory");
  const latInput = form.querySelector("#latitude");
  const lngInput = form.querySelector("#longitude");

  // Create container for duplicate warnings if it doesn't exist
  let warningContainer = form.querySelector(".duplicate-warning-container");
  if (!warningContainer) {
    warningContainer = document.createElement("div");
    warningContainer.className = "duplicate-warning-container";
    warningContainer.style.display = "none";

    // Insert after location map/input
    const locationGroup = form.querySelector(".location-wrapper");
    if (locationGroup) {
      locationGroup.appendChild(warningContainer);
    }
  }

  // Debounce function
  const debounce = (func, wait) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  const checkDuplicates = async () => {
    const category = categorySelect.value;
    const subcategory = subcategorySelect.value;
    const latitude = latInput.value;
    const longitude = lngInput.value;

    // Minimum requirements: Location + Category
    if (!category || !latitude || !longitude) {
      warningContainer.style.display = "none";
      return;
    }

    try {
      const { data, error } = await apiClient.get(
        `/api/complaints/check-duplicates?latitude=${latitude}&longitude=${longitude}&category=${category}&subcategory=${
          subcategory || ""
        }`
      );

      if (error) throw error;

      if (data && data.length > 0) {
        // HYBRID THRESHOLD LOGIC
        // If duplicates >= 5, BLOCK submission (Option B)
        // If duplicates < 5, WARN user (Option A)

        const THRESHOLD = 5;
        if (data.length >= THRESHOLD) {
          renderBlockingUI(warningContainer, data, form);
        } else {
          renderDuplicateWarning(warningContainer, data, form, false); // false = not blocking
        }
      } else {
        warningContainer.style.display = "none";
        enableSubmitButton(form);
      }
    } catch (err) {
      console.error("Duplicate check failed:", err);
      warningContainer.style.display = "none";
      enableSubmitButton(form);
    }
  };

  const debouncedCheck = debounce(checkDuplicates, 1000); // 1s delay

  // Listeners
  categorySelect.addEventListener("change", debouncedCheck);
  subcategorySelect.addEventListener("change", debouncedCheck);

  // For hidden inputs, standard change events might not fire if updated programmatically.
  // Use MutationObserver for hidden inputs
  const observer = new MutationObserver(() => {
    debouncedCheck();
  });

  observer.observe(latInput, { attributes: true, attributeFilter: ["value"] });
  observer.observe(lngInput, { attributes: true, attributeFilter: ["value"] });

  // Also listen to manual input events if they happen
  latInput.addEventListener("change", debouncedCheck);
  lngInput.addEventListener("change", debouncedCheck);
}

/**
 * Render duplicate warning UI
 */
/**
 * Render duplicate warning UI (Non-Blocking)
 */
function renderDuplicateWarning(
  container,
  duplicates,
  form,
  isBlocking = false
) {
  // Ensure submit button is enabled if not blocking
  if (!isBlocking) {
    enableSubmitButton(form);
  }

  container.innerHTML = `
        <div class="warning-header">
            <span class="warning-icon">⚠️</span>
            <h4 class="warning-title">Potential Duplicates Found</h4>
        </div>
        <p style="margin-bottom: 0.8rem; font-size: 0.9rem; color: #431407;">
            We found ${
              duplicates.length
            } similar report(s) near this location. Please check if your issue is already listed.
            If matched, you can click <strong>"Me Too"</strong> to support the existing report instead of creating a new one.
        </p>
        <div class="duplicate-list">
            ${duplicates.map((d) => renderDuplicateItem(d)).join("")}
        </div>
        <div class="dismiss-warning">
            <button type="button" class="btn-dismiss">None of these match my issue (Continue)</button>
        </div>
    `;

  container.style.display = "block";
  container.classList.remove("blocking-mode");

  // Attach event listeners
  const dismissBtn = container.querySelector(".btn-dismiss");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      container.style.display = "none";
    });
  }

  attachUpvoteListeners(container);
}

/**
 * Render Blocking UI (High Volume of Duplicates)
 */
function renderBlockingUI(container, duplicates, form) {
  // DISABLE submit button
  const submitBtn =
    form.querySelector(".submit-btn") ||
    form.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.title =
      "This issue has already been reported multiple times. Please upvote instead.";
    submitBtn.style.opacity = "0.5";
    submitBtn.style.cursor = "not-allowed";
  }

  container.innerHTML = `
        <div class="warning-header" style="color: #b91c1c;">
            <span class="warning-icon">🛑</span>
            <h4 class="warning-title" style="color: #b91c1c;">Report Submission Paused</h4>
        </div>
        <p style="margin-bottom: 0.8rem; font-size: 0.9rem; color: #7f1d1d; font-weight: 500;">
            We have detected a <strong>high number of reports (${
              duplicates.length
            })</strong> for this issue in this area.
            <br/><br/>
            To help our coordinators respond faster, we have paused new submissions. 
            <strong>Please UPVOTE an existing report below</strong> to add urgency to this issue.
        </p>
        <div class="duplicate-list">
            ${duplicates
              .slice(0, 3)
              .map((d) => renderDuplicateItem(d))
              .join("")}
        </div>
        <div class="dismiss-warning">
            <span style="font-size: 0.8rem; color: #6b7280;">(Submitting new reports is temporarily disabled for this area)</span>
        </div>
    `;

  container.style.display = "block";
  container.classList.add("blocking-mode"); // Add class for styling if needed

  attachUpvoteListeners(container);
}

function renderDuplicateItem(d) {
  return `
        <div class="duplicate-item">
            <div class="duplicate-info">
                <span class="duplicate-title">${
                  d.title || "Untitled Complaint"
                }</span>
                <div class="duplicate-meta">
                    <span>📅 ${new Date(
                      d.submitted_at || d.created_at
                    ).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>📍 ${(d.distance * 1000).toFixed(0)}m away</span>
                    <span style="display: block; margin-top: 4px; color: #4b5563;">
                        ${
                          d.description
                            ? d.description.length > 80
                              ? d.description.substring(0, 80) + "..."
                              : d.description
                            : "No description"
                        }
                    </span>
                </div>
            </div>
            <div class="duplicate-actions">
                    <button type="button" class="btn-me-too" data-id="${d.id}">
                    <span>👍 Me Too (${d.upvote_count || 0})</span>
                    </button>
            </div>
        </div>
    `;
}

function attachUpvoteListeners(container) {
  const upvoteButtons = container.querySelectorAll(".btn-me-too");
  upvoteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      // Optimistic UI update
      const originalText = e.currentTarget.innerHTML;
      e.currentTarget.innerHTML = "<span>Checking...</span>";
      e.currentTarget.disabled = true;

      try {
        // Call Upvote API
        const { data, error } = await apiClient.post(
          `/api/complaints/${id}/upvote`
        );
        if (error) throw error;

        showMessage("success", "Thanks! You matched with an existing report.");

        // Show success state and redirect
        e.currentTarget.innerHTML = "<span>✅ Matched!</span>";
        e.currentTarget.style.background = "#10b981"; // Green

        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1500);
      } catch (err) {
        console.error("Upvote failed:", err);
        showMessage("error", "Failed to upvote. Please try again.");
        e.currentTarget.innerHTML = originalText;
        e.currentTarget.disabled = false;
      }
    });
  });
}

function enableSubmitButton(form) {
  const submitBtn =
    form.querySelector(".submit-btn") ||
    form.querySelector("button[type='submit']");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.title = "";
    submitBtn.style.opacity = "1";
    submitBtn.style.cursor = "pointer";
  }
}

/**
 * Setup Title Auto-Generation from Description
 */
function setupTitleAutoGeneration(form) {
  const descriptionInput = form.querySelector("#description");
  const titleInput = form.querySelector("#complaintTitle"); // Hidden input

  if (!descriptionInput || !titleInput) return;

  const updateTitle = () => {
    const desc = descriptionInput.value.trim();
    if (desc) {
      // Create title from first few words (approx 50 chars)
      let title = desc.split(/\s+/).slice(0, 10).join(" ");
      if (title.length > 50) {
        title = title.substring(0, 47) + "...";
      }
      // Ensure specific format if needed, or just clean it
      titleInput.value = title.charAt(0).toUpperCase() + title.slice(1);
    } else {
      titleInput.value = "";
    }
  };

  descriptionInput.addEventListener("input", updateTitle);
  descriptionInput.addEventListener("change", updateTitle);
  descriptionInput.addEventListener("blur", updateTitle); // Ensure final update
}

/**
 * Setup Voice Input using Web Speech API
 */
/**
 * Setup Voice Input using Web Speech API
 */
function setupVoiceInput(form) {
  const micBtn = form.querySelector("#startSpeech");
  const langSelect = form.querySelector("#voiceLanguage");
  const descriptionInput = form.querySelector("#description");

  if (!micBtn || !descriptionInput) return;

  // Check browser support
  if (
    !("webkitSpeechRecognition" in window) &&
    !("SpeechRecognition" in window)
  ) {
    micBtn.style.display = "none";
    if (langSelect) langSelect.style.display = "none";
    return;
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = false; // Stop after one sentence/pause
  recognition.interimResults = true;

  let isListening = false;

  micBtn.addEventListener("click", () => {
    // Check for Secure Context (HTTPS or localhost)
    if (!window.isSecureContext) {
      showMessage(
        "error",
        "Microphone access requires a secure connection (HTTPS) or localhost. Please use http://localhost:3000 if testing locally."
      );
      return;
    }

    if (isListening) {
      recognition.stop();
      return;
    }

    // Set language from selector
    if (langSelect) {
      recognition.lang = langSelect.value;
    }

    try {
      recognition.start();
      isListening = true;
      micBtn.classList.add("listening");
      micBtn.style.background = "rgba(220, 38, 38, 0.2)"; // Red tint
      micBtn.style.color = "#ef4444"; // Red color

      // Visual feedback with language specific hint
      const lang = langSelect ? langSelect.value : "en-US";
      let hint = "Listening... Speak now";
      if (lang === "tl-PH" || lang === "ceb-PH") {
        hint = "Listening... (Speak clearly in the selected language)";
      }
      showMessage("info", hint);
    } catch (e) {
      console.error("Speech recognition error:", e);
      isListening = false;
      showMessage("error", "Unable to start speech recognition.");
    }
  });

  recognition.onresult = (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // Determine where to insert (at cursor or append)
    // For simplicity, we just append or replace
    // Better UX: Append with space
    if (finalTranscript) {
      const curentVal = descriptionInput.value;
      // If empty, just set. If not, append.
      const newVal = curentVal
        ? curentVal.trim() + " " + finalTranscript.trim()
        : finalTranscript.trim();
      descriptionInput.value = newVal;

      // Trigger input event for auto-resize and title generation
      descriptionInput.dispatchEvent(new Event("input"));
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error", event.error);
    isListening = false;
    resetMicBtn(micBtn);

    if (event.error === "not-allowed") {
      if (!window.isSecureContext) {
        showMessage(
          "error",
          "Microphone blocked due to insecure connection (HTTP). Please use localhost."
        );
      } else {
        showMessage(
          "error",
          "Microphone access denied. Please check your browser permissions."
        );
      }
    } else if (event.error === "no-speech") {
      // Ignore no-speech error, just stop listening usually or show mild warning
      // showMessage("info", "No speech detected.");
    } else {
      showMessage("error", `Speech recognition error: ${event.error}`);
    }
  };

  recognition.onend = () => {
    isListening = false;
    resetMicBtn(micBtn);
  };
}

function resetMicBtn(btn) {
  btn.classList.remove("listening");
  btn.style.background = "rgba(255, 255, 255, 0.1)";
  btn.style.color = "inherit";
}
/**
 * Setup hierarchical category -> subcategory -> department selection
 */
function setupHierarchicalSelection(elements) {
  const { categorySelect, subcategorySelect, departmentCheckboxes } = elements;
  if (!categorySelect || !subcategorySelect || !departmentCheckboxes) return;
  // Category selection handler
  categorySelect.addEventListener("change", async (e) => {
    const categoryId = e.target.value;
    await loadSubcategories(categoryId, subcategorySelect);
    // Clear departments when category changes
    departmentCheckboxes.innerHTML =
      '<div class="loading-placeholder">Select a subcategory to see relevant departments</div>';
  });
  // Subcategory selection handler
  subcategorySelect.addEventListener("change", async (e) => {
    const subcategoryId = e.target.value;
    if (subcategoryId) {
      // First load all departments, then auto-select appropriate ones
      await loadAllDepartments(departmentCheckboxes);
      await autoSelectAppropriateDepartments(
        subcategoryId,
        departmentCheckboxes
      );
    } else {
      // If no subcategory selected, just load all departments without auto-selection
      await loadAllDepartments(departmentCheckboxes);
    }
  });
}
/**
 * Load categories from API
 */
async function loadCategories() {
  const categorySelect = document.getElementById("complaintCategory");
  if (!categorySelect) return;
  try {
    categorySelect.innerHTML =
      '<option value="">Loading categories...</option>';
    const { data, error } = await apiClient.get(
      "/api/department-structure/categories"
    );
    if (error) throw error;
    categorySelect.innerHTML = '<option value="">Select a category</option>';
    if (data && data.length > 0) {
      data.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    showMessage("error", "Failed to load categories");
    categorySelect.innerHTML =
      '<option value="">Error loading categories</option>';
  }
}
/**
 * Load subcategories for selected category
 */
async function loadSubcategories(categoryId, subcategorySelect) {
  if (!subcategorySelect || !categoryId) return;
  try {
    subcategorySelect.innerHTML =
      '<option value="">Loading subcategories...</option>';
    subcategorySelect.disabled = true;
    const { data, error } = await apiClient.get(
      `/api/department-structure/categories/${categoryId}/subcategories`
    );
    if (error) throw error;
    subcategorySelect.innerHTML =
      '<option value="">Select a subcategory</option>';
    if (data && data.length > 0) {
      data.forEach((subcategory) => {
        const option = document.createElement("option");
        option.value = subcategory.id;
        option.textContent = subcategory.name;
        subcategorySelect.appendChild(option);
      });
      subcategorySelect.disabled = false;
    } else {
      subcategorySelect.innerHTML =
        '<option value="">No subcategories available</option>';
    }
  } catch (error) {
    console.error("Error loading subcategories:", error);
    showMessage("error", "Failed to load subcategories");
    subcategorySelect.innerHTML =
      '<option value="">Error loading subcategories</option>';
  }
}
/**
 * Auto-select appropriate departments when subcategory is selected
 */
async function autoSelectAppropriateDepartments(
  subcategoryId,
  departmentCheckboxes
) {
  if (!departmentCheckboxes || !subcategoryId) return;
  try {
    // Get departments mapped to this subcategory
    const { data, error } = await apiClient.get(
      `/api/department-structure/subcategories/${subcategoryId}/departments`
    );
    if (error) throw error;
    if (data && data.length > 0) {
      // Find departments that are mapped to this subcategory
      const mappedDepartments = data.filter(
        (dept) =>
          dept.department_subcategory_mapping &&
          dept.department_subcategory_mapping.response_priority
      );
      // Auto-check mapped departments
      mappedDepartments.forEach((dept) => {
        const checkbox = document.querySelector(`input[value="${dept.code}"]`);
        if (checkbox) {
          checkbox.checked = true;
          checkbox.setAttribute("data-auto-selected", "true");
        }
      });
      // console.log removed for security
      // Show helpful message
      if (mappedDepartments.length > 0) {
        const suggestionMessage = document.createElement("div");
        suggestionMessage.className = "suggestion-message";
        suggestionMessage.innerHTML = `
          <div style="background: #e8f5e8; border: 1px solid #28a745; border-radius: 6px; padding: 12px; margin: 10px 0; color: #155724;">
            <strong>💡 Suggested Departments:</strong> We've pre-selected departments that typically handle this type of complaint. You can uncheck any that don't apply to your specific situation.
          </div>
        `;
        // Remove existing suggestion message if any
        const existingMessage = departmentCheckboxes.querySelector(
          ".suggestion-message"
        );
        if (existingMessage) {
          existingMessage.remove();
        }
        departmentCheckboxes.insertBefore(
          suggestionMessage,
          departmentCheckboxes.firstChild
        );
      }
    }
  } catch (error) {
    console.error("Error auto-selecting departments:", error);
  }
}
/**
 * Load ALL departments (always show all, regardless of category/subcategory)
 */
async function loadAllDepartments(departmentCheckboxes) {
  if (!departmentCheckboxes) return;
  try {
    departmentCheckboxes.innerHTML =
      '<div class="loading-placeholder">Loading departments...</div>';
    // Always get ALL departments, regardless of subcategory
    const { data, error } = await apiClient.get(
      `/api/department-structure/departments/all`
    );
    if (error) throw error;
    departmentCheckboxes.innerHTML = "";
    if (data && data.length > 0) {
      // Add search input
      const searchContainer = document.createElement("div");
      searchContainer.className = "department-search-container";
      searchContainer.innerHTML = `
        <div class="search-input-wrapper">
          <input type="text" id="department-search" placeholder="Search departments..." class="premium-input department-search-input" style="margin-bottom: 0.5rem;">
        </div>
        <div class="search-results-info" id="search-results-info" style="display: none; margin-bottom: 0.5rem; font-size: 0.85rem; color: #6b7280;">
          <span id="search-results-count">0</span> departments found
        </div>
      `;
      departmentCheckboxes.appendChild(searchContainer);
      // Group departments by level
      const lguDepartments = data.filter((dept) => dept.level === "LGU");
      const ngaDepartments = data.filter((dept) => dept.level === "NGA");
      // Create LGU section
      if (lguDepartments.length > 0) {
        const lguSection = document.createElement("div");
        lguSection.className = "department-section";
        lguSection.innerHTML = "<h4>Local Government Units (LGU)</h4>";
        lguDepartments.forEach((dept) => {
          const checkbox = createDepartmentCheckbox(dept);
          lguSection.appendChild(checkbox);
        });
        departmentCheckboxes.appendChild(lguSection);
      }
      // Create NGA section
      if (ngaDepartments.length > 0) {
        const ngaSection = document.createElement("div");
        ngaSection.className = "department-section";
        ngaSection.innerHTML = "<h4>National Government Agencies (NGA)</h4>";
        ngaDepartments.forEach((dept) => {
          const checkbox = createDepartmentCheckbox(dept);
          ngaSection.appendChild(checkbox);
        });
        departmentCheckboxes.appendChild(ngaSection);
      }
      // Show all departments but don't auto-select any (make it optional)
      // console.log removed for security

      // Show helpful message to user about optional selection
      const suggestionMessage = document.createElement("div");
      suggestionMessage.className = "suggestion-message";
      suggestionMessage.innerHTML = `
        <div style="background: #e8f5e8; border: 1px solid #28a745; border-radius: 6px; padding: 12px; margin: 10px 0; color: #155724;">
          <strong>💡 Department Selection (Optional):</strong> You can select departments that should handle your complaint. If none are selected, the system will route your complaint to appropriate departments automatically.
        </div>
      `;
      departmentCheckboxes.insertBefore(
        suggestionMessage,
        departmentCheckboxes.firstChild
      );
      // Setup search functionality
      setupDepartmentSearch(data);
      // No "None" option - users can simply leave all departments unchecked
    } else {
      departmentCheckboxes.innerHTML =
        '<div class="no-departments">No departments available for this subcategory</div>';
    }
  } catch (error) {
    console.error("Error loading departments:", error);
    showMessage("error", "Failed to load departments");
    departmentCheckboxes.innerHTML =
      '<div class="error-message">Error loading departments</div>';
  }
}
/**
 * Create department checkbox element
 */
function createDepartmentCheckbox(department) {
  const wrapper = document.createElement("div");
  wrapper.className = "checkbox-wrapper";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = `dept-${department.id}`;
  checkbox.name = "departments";
  checkbox.value = department.code;
  checkbox.setAttribute("data-dept-code", department.code);
  const label = document.createElement("label");
  label.htmlFor = `dept-${department.id}`;
  label.className = "checkbox-label";
  const labelText = document.createElement("span");
  labelText.textContent = department.name;
  const codeSpan = document.createElement("span");
  codeSpan.className = "dept-code";
  codeSpan.textContent = ` (${department.code})`;
  const responseTimeSpan = document.createElement("span");
  responseTimeSpan.className = "response-time";
  responseTimeSpan.textContent = ` - ${department.response_time_hours}h response`;
  // All departments are shown equally - no special indicators
  labelText.appendChild(codeSpan);
  labelText.appendChild(responseTimeSpan);
  label.appendChild(labelText);
  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);
  return wrapper;
}
/**
 * Setup file handling functionality
 */
function setupFileHandling(dropZone, fileInput, fileHandler) {
  if (!dropZone || !fileHandler) return;
  setupDragAndDrop(dropZone, fileHandler, fileInput);
  window.complaintFileHandler = fileHandler;
}
/**
 * Show role switch required message
 */
function showRoleSwitchRequired(form) {
  const message = document.createElement("div");
  message.className = "role-switch-required";
  message.innerHTML = `
    <div class="role-switch-content">
      <h3>Switch to Citizen Mode Required</h3>
      <p>You need to switch to citizen mode to file a complaint.</p>
      <button type="button" class="btn btn-primary" onclick="window.location.href='/role-toggle'">
        Switch to Citizen Mode
      </button>
    </div>
  `;
  form.innerHTML = "";
  form.appendChild(message);
}
/**
 * Setup form validation
 */
function setupFormValidation(form) {
  if (!form) return;
  setupRealtimeValidation(form);
}
/**
 * Setup form submission
 */
function setupFormSubmission(form, fileHandler) {
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Get selected departments (optional)
    const selectedDepartments = Array.from(
      form.querySelectorAll('input[name="departments"]:checked')
    ).map((checkbox) => checkbox.value);
    // Department selection is now optional - no validation required
    // console.log removed for security
    // Add selected departments as preferred_departments (user's choice)
    if (selectedDepartments.length > 0) {
      // Send array of selected department codes
      selectedDepartments.forEach((deptCode) => {
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "preferred_departments";
        hiddenInput.value = deptCode;
        form.appendChild(hiddenInput);
      });
    } else {
      // Send empty array when no departments are selected
      const emptyInput = document.createElement("input");
      emptyInput.type = "hidden";
      emptyInput.name = "preferred_departments";
      emptyInput.value = "[]";
      form.appendChild(emptyInput);
    }
    // Add category and subcategory info as hidden inputs
    // Note: These are UUIDs that reference the categories and subcategories tables
    const categoryId = form.querySelector("#complaintCategory").value;
    const subcategoryId = form.querySelector("#complaintSubcategory").value;
    if (categoryId) {
      const categoryInput = document.createElement("input");
      categoryInput.type = "hidden";
      categoryInput.name = "category";
      categoryInput.value = categoryId; // UUID from categories table
      form.appendChild(categoryInput);
    }
    if (subcategoryId) {
      const subcategoryInput = document.createElement("input");
      subcategoryInput.type = "hidden";
      subcategoryInput.name = "subcategory";
      subcategoryInput.value = subcategoryId; // UUID from subcategories table
      form.appendChild(subcategoryInput);
    }
    try {
      // Get selected files from file handler
      const selectedFiles = fileHandler.getFiles();
      // Submit the complaint using the correct parameters with fileHandler for progress tracking
      const _result = await handleComplaintSubmit(
        form,
        selectedFiles,
        fileHandler
      );
      // Reset form on success
      resetComplaintForm(form, () => fileHandler.clearAll());
      // Redirect to dashboard after delay
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (error) {
      console.error("Error submitting complaint:", error);
      // Error message is already shown in handleComplaintSubmit
    }
  });
}
/**
 * Setup department search functionality
 */
function setupDepartmentSearch(allDepartments) {
  const searchInput = document.getElementById("department-search");
  const searchResultsInfo = document.getElementById("search-results-info");
  const searchResultsCount = document.getElementById("search-results-count");
  if (!searchInput) return;
  // Debounce search to avoid too many calls
  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();
      filterDepartments(
        query,
        allDepartments,
        searchResultsInfo,
        searchResultsCount
      );
    }, 300);
  });
  // Clear search on escape
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.target.value = "";
      filterDepartments(
        "",
        allDepartments,
        searchResultsInfo,
        searchResultsCount
      );
    }
  });
}
/**
 * Filter departments based on search query
 */
function filterDepartments(
  query,
  allDepartments,
  searchResultsInfo,
  searchResultsCount
) {
  const departmentSections = document.querySelectorAll(".department-section");
  const _departmentCheckboxes = document.querySelectorAll(".checkbox-wrapper");
  let visibleCount = 0;
  if (!query) {
    // Show all departments
    departmentSections.forEach((section) => {
      section.style.display = "block";
      const checkboxes = section.querySelectorAll(".checkbox-wrapper");
      checkboxes.forEach((checkbox) => {
        checkbox.style.display = "block";
        visibleCount++;
      });
    });
    searchResultsInfo.style.display = "none";
    return;
  }
  // Filter departments
  departmentSections.forEach((section) => {
    const checkboxes = section.querySelectorAll(".checkbox-wrapper");
    let sectionHasVisible = false;
    checkboxes.forEach((checkbox) => {
      const label = checkbox.querySelector("label");
      const departmentName = label ? label.textContent.toLowerCase() : "";
      const departmentCode =
        checkbox.querySelector("input")?.value?.toLowerCase() || "";
      const matches =
        departmentName.includes(query) || departmentCode.includes(query);
      if (matches) {
        checkbox.style.display = "block";
        sectionHasVisible = true;
        visibleCount++;
      } else {
        checkbox.style.display = "none";
      }
    });
    // Show/hide section based on whether it has visible items
    section.style.display = sectionHasVisible ? "block" : "none";
  });
  // Update search results info
  if (query) {
    searchResultsCount.textContent = visibleCount;
    searchResultsInfo.style.display = visibleCount > 0 ? "block" : "none";
  } else {
    searchResultsInfo.style.display = "none";
  }
}
// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeComplaintForm);
} else {
  initializeComplaintForm();
}
