import { getUserRole, refreshMetaFromSession } from "../auth/authChecker.js";
import showMessage from "../components/toast.js";
import { addCsrfTokenToHeaders } from "../utils/csrf.js";

let cachedProfile = null;

async function checkAuthentication() {
  try {
    // Check if user is authenticated
    let role = await getUserRole({ refresh: false });
    if (!role) {
      const refreshed = await refreshMetaFromSession();
      role = refreshed?.role || null;
    }
    if (!role) {
      // No role means not authenticated, redirect to login
      window.location.href = "/login";
      return false;
    }
    // All authenticated users (regardless of role) can access profile
    return true;
  } catch {
    window.location.href = "/login";
    return false;
  }
}
async function fetchProfile() {
  const res = await fetch("/api/auth/profile");
  if (!res.ok) throw new Error("Failed to load profile");
  const json = await res.json();
  return json?.data || {};
}
async function fetchMyComplaints(role) {
  try {
    // For staff roles, fetch assignments instead of complaints
    const roleLower = role?.toLowerCase() || "citizen";
    if (roleLower === "lgu" || roleLower === "lgu-officer") {
      // LGU Officer: fetch assigned tasks
      const res = await fetch("/api/lgu/assigned-tasks?limit=20");
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          return [];
        }
        throw new Error("Failed to load assignments");
      }
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } else if (roleLower === "lgu-admin") {
      // LGU Admin: fetch department assignments
      const res = await fetch("/api/lgu-admin/department-assignments?limit=20");
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          return [];
        }
        throw new Error("Failed to load assignments");
      }
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    }
    // Citizen and other roles: fetch complaints
    const res = await fetch("/api/complaints/my?limit=20");
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        return [];
      }
      throw new Error("Failed to load complaints");
    }
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    console.warn("Could not fetch data:", error.message);
    return [];
  }
}
function formatRoleDisplay(role) {
  if (!role) return "—";
  const roleLower = role.toLowerCase();
  // Format role names for display
  const roleMap = {
    citizen: "Citizen",
    "super-admin": "Super Admin",
    "complaint-coordinator": "Complaint Coordinator",
    "lgu-admin": "LGU Admin",
    lgu: "LGU Officer",
    "lgu-hr": "LGU HR",
    "lgu-officer": "LGU Officer",
  };
  return (
    roleMap[roleLower] ||
    role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, " ")
  );
}

function renderProfile(profile) {
  // Extract name fields
  const firstName = profile?.firstName || profile?.first_name || "";
  const lastName = profile?.lastName || profile?.last_name || "";
  const middleName = profile?.middleName || profile?.middle_name || "";

  // Build display name
  let name = profile?.name || profile?.full_name || "";
  if (!name && (firstName || lastName)) {
    const parts = [firstName, middleName, lastName].filter(Boolean);
    name = parts.join(" ") || "User";
  }
  if (!name) name = "User";

  const email = profile?.email || "—";
  // Mobile number from raw_user_meta_data (already extracted in backend)
  const mobile =
    profile?.mobileNumber || profile?.mobile_number || profile?.mobile || "—";
  // Get role and department
  const role =
    profile?.role ||
    profile?.normalizedRole ||
    profile?.normalized_role ||
    "citizen";
  const department = profile?.department || profile?.dpt || null;
  const employeeId = profile?.employeeId || profile?.employee_id || null;

  // Update profile name display
  const nameDisplayEl = document.getElementById("profile-name-display");
  if (nameDisplayEl) {
    nameDisplayEl.textContent = name;
  }

  // Update email display
  const emailDisplayEl = document.getElementById("profile-email-display");
  const currentEmailDisplayEl = document.getElementById(
    "current-email-display"
  );
  if (emailDisplayEl) {
    emailDisplayEl.textContent = email;
  }
  if (currentEmailDisplayEl) {
    currentEmailDisplayEl.textContent = email;
  }

  // Update avatar initial
  const initialEl = document.getElementById("profile-initial");
  if (initialEl && name !== "—") {
    initialEl.textContent = name.charAt(0).toUpperCase();
  }

  // Update mobile display
  const mobileDisplayEl = document.getElementById("profile-mobile-display");
  if (mobileDisplayEl) {
    mobileDisplayEl.textContent = mobile || "—";
  }

  // Update role
  const roleEl = document.getElementById("profile-role");
  if (roleEl) {
    roleEl.textContent = formatRoleDisplay(role);
  }

  // Update office/department - only show for lgu-admin and lgu (officer) roles
  const officeItemEl = document.getElementById("profile-office-item");
  const officeEl = document.getElementById("profile-office");
  const roleLower = role.toLowerCase().trim();

  const shouldShowOffice =
    (roleLower === "lgu-admin" ||
      roleLower === "lgu" ||
      roleLower === "lgu-officer") &&
    !["citizen", "super-admin", "complaint-coordinator"].includes(roleLower);

  if (officeItemEl && officeEl) {
    if (shouldShowOffice && department) {
      officeItemEl.style.display = "flex";
      officeEl.textContent = department || "—";
    } else {
      officeItemEl.style.display = "none";
    }
  }

  // Update Position ID (only if user has value)
  const positionIdItemEl = document.getElementById("profile-position-id-item");
  const positionIdEl = document.getElementById("profile-position-id");
  if (positionIdItemEl && positionIdEl) {
    if (employeeId) {
      positionIdItemEl.style.display = "flex";
      positionIdEl.textContent = employeeId;
    } else {
      positionIdItemEl.style.display = "none";
    }
  }

  // Update member since date
  const memberSinceEl = document.getElementById("member-since");
  const createdDate = profile?.created_at || profile?.timestamps?.created;
  if (memberSinceEl && createdDate) {
    const date = new Date(createdDate);
    if (!isNaN(date.getTime())) {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      memberSinceEl.textContent = `${
        monthNames[date.getMonth()]
      } ${date.getFullYear()}`;
    } else {
      memberSinceEl.textContent = "—";
    }
  } else if (memberSinceEl) {
    memberSinceEl.textContent = "—";
  }

  // Update address display
  const address = profile?.address || {};
  const addressLine1 = address?.line1 || address?.address_line_1 || null;
  const addressLine2 = address?.line2 || address?.address_line_2 || null;
  const _city = address?._city || "Digos City";
  const _province = address?._province || "Davao del Sur";
  const postalCode = address?.postalCode || address?.postal_code || null;
  const barangay = address?.barangay || null;

  const addressLine1Display = document.getElementById("address-line-1-display");
  const addressLine2Display = document.getElementById("address-line-2-display");
  const _cityDisplay = document.getElementById("address-city-display");
  const _provinceDisplay = document.getElementById("address-province-display");
  const postalDisplay = document.getElementById("address-postal-display");
  const barangayDisplay = document.getElementById("address-barangay-display");

  if (addressLine1Display)
    addressLine1Display.textContent = addressLine1 || "—";
  if (addressLine2Display) {
    if (addressLine2) {
      addressLine2Display.textContent = addressLine2;
      addressLine2Display.style.display = "block";
    } else {
      addressLine2Display.style.display = "none";
    }
  }

  if (postalDisplay) postalDisplay.textContent = postalCode || "—";
  if (barangayDisplay) barangayDisplay.textContent = barangay || "—";
}
// Stores full list of complaints/assignments for pagination
let allItems = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

function renderComplaints(list, role) {
  allItems = list;
  renderPage(1, role);
}

function renderPage(page, role) {
  currentPage = page;
  const container = document.getElementById("my-complaints");
  const empty = document.getElementById("complaints-empty");
  const emptyTitle = document.getElementById("empty-title");
  const emptyMessage = document.getElementById("empty-message");

  // Also get or create pagination controls container
  let paginationContainer = document.getElementById("pagination-controls");
  if (!paginationContainer) {
    paginationContainer = document.createElement("div");
    paginationContainer.id = "pagination-controls";
    paginationContainer.className = "pagination-controls";
    container.parentNode.appendChild(paginationContainer);
  }

  if (!container || !empty) return;

  const roleLower = role?.toLowerCase() || "citizen";
  const isStaff =
    roleLower === "lgu" ||
    roleLower === "lgu-officer" ||
    roleLower === "lgu-admin";

  container.innerHTML = "";

  if (!allItems.length) {
    empty.classList.remove("hidden");
    paginationContainer.style.display = "none";

    if (emptyTitle) {
      emptyTitle.textContent = isStaff
        ? "No assignments yet"
        : "No complaints yet";
    }
    if (emptyMessage) {
      emptyMessage.textContent = isStaff
        ? "You don't have any active assignments at the moment."
        : 'You haven\'t filed any complaints yet. Click "File a complaint" to get started!';
    }
    return;
  }

  empty.classList.add("hidden");
  paginationContainer.style.display = "flex";

  // Calculate pagination
  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const currentItems = allItems.slice(startIndex, endIndex);

  // Create table structure
  const table = document.createElement("table");
  table.className = "complaints-table";

  // Table Header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Title</th>
      <th>Status</th>
      <th>Date</th>
      <th>Action</th>
    </tr>
  `;
  table.appendChild(thead);

  // Table Body
  const tbody = document.createElement("tbody");

  for (const itemData of currentItems) {
    const tr = document.createElement("tr");

    // Handle assignments (for staff) vs complaints (for citizens)
    const title = itemData.title || itemData.complaints?.title || "Assignment";
    const complaintId = itemData.complaint_id || itemData.id;
    const date =
      itemData.submitted_at || itemData.assigned_at || itemData.created_at;
    const status = (itemData.status || itemData.workflow_status || "unknown")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const statusLabel = formatStatus(
      itemData.status || itemData.workflow_status
    );

    const dateStr = date
      ? new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      : "";

    tr.innerHTML = `
      <td>
        <div style="font-weight: 500; color: #1f2937;" class="complaint-title-text">${title}</div>
        <div style="font-size: 0.75rem; color: #6b7280;">ID: ${complaintId.substring(
    0,
    8
  )}...</div>
      </td>
      <td>
        <span class="status-badge status-${status}">${statusLabel}</span>
      </td>
      <td style="color: #6b7280;">${dateStr}</td>
      <td>
        <a class="btn-secondary" href="/complaint-details/${complaintId}?from=profile" style="text-decoration: none; font-size: 0.75rem; padding: 0.25rem 0.5rem;">View</a>
      </td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);

  // Update Pagination Controls
  paginationContainer.innerHTML = `
    <div class="pagination-info">
      Showing ${startIndex + 1} to ${endIndex} of ${totalItems} results
    </div>
    <div class="pagination-buttons">
      <button class="page-btn" ${
  currentPage === 1 ? "disabled" : ""
} id="prev-btn">Previous</button>
      <button class="page-btn" ${
  currentPage === totalPages ? "disabled" : ""
} id="next-btn">Next</button>
    </div>
  `;

  // Attach event listeners
  document.getElementById("prev-btn")?.addEventListener("click", () => {
    if (currentPage > 1) renderPage(currentPage - 1, role);
  });

  document.getElementById("next-btn")?.addEventListener("click", () => {
    if (currentPage < totalPages) renderPage(currentPage + 1, role);
  });
}
function formatStatus(status) {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
function _updateStatistics(_complaints) {
  // Statistics are no longer displayed in the compact layout
  // This function is kept for backward compatibility but does nothing
}
function _scrollToAnchorIfNeeded() {
  // Anchor scrolling no longer needed with new layout
  // This function is kept for backward compatibility but does nothing
}
function wireChangePassword() {
  const modal = document.getElementById("password-change-modal");
  const openBtn = document.getElementById("open-password-change-modal");
  const closeBtn = document.getElementById("close-password-modal");
  const cancelBtn = document.getElementById("cancel-password-change");
  const form = document.getElementById("change-password-form");
  const messageEl = document.getElementById("password-confirmation-message");

  if (!modal || !form) return;

  // Open modal
  if (openBtn) {
    openBtn.addEventListener("click", () => {
      modal.style.display = "flex";
      modal.style.visibility = "visible";
      modal.style.opacity = "1";
    });
  }

  // Close modal handlers
  const closeModal = () => {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    form.reset();
    if (messageEl) {
      messageEl.style.display = "none";
    }
  };

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  // Close on overlay click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword =
      document.getElementById("current-password")?.value || "";
    const logoutAllDevices =
      document.getElementById("logout-all-devices")?.checked || false;

    // Validate inputs
    if (!currentPassword) {
      showMessage("error", "Current password is required", 4000);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || "Request Password Change";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    try {
      // Get CSRF token and add to headers
      const headers = await addCsrfTokenToHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetch("/api/auth/request-password-change", {
        method: "POST",
        headers,
        body: JSON.stringify({ currentPassword, logoutAllDevices }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success)
        throw new Error(json?.error || "Failed to request password change");

      // Show success message with email confirmation info
      if (messageEl) {
        const messageText =
          json.message ||
          "A confirmation email has been sent to your email address. Please check your inbox and click the confirmation link to set your new password.";
        messageEl.querySelector("p").textContent = messageText;
        messageEl.style.display = "block";
      }
      showMessage(
        "success",
        "Password change request sent! Please check your email for confirmation.",
        5000
      );
      form.reset();

      // Close modal after 3 seconds
      setTimeout(() => {
        closeModal();
      }, 3000);
    } catch (err) {
      showMessage(
        "error",
        err.message || "Failed to request password change",
        4000
      );
      if (messageEl) {
        messageEl.style.display = "none";
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

// Name inline editing
function wireNameEdit() {
  const editIcon = document.getElementById("edit-name-icon");
  const nameDisplay = document.getElementById("profile-name-display");
  const nameEdit = document.getElementById("profile-name-edit");
  const firstNameInput = document.getElementById("edit-first-name-input");
  const middleNameInput = document.getElementById("edit-middle-name-input");
  const lastNameInput = document.getElementById("edit-last-name-input");
  const saveBtn = document.getElementById("save-name-btn");
  const cancelBtn = document.getElementById("cancel-name-btn");

  if (
    !editIcon ||
    !nameDisplay ||
    !nameEdit ||
    !firstNameInput ||
    !lastNameInput
  )
    return;

  // Load current name values when opening edit
  const loadNameValues = async () => {
    try {
      const res = await fetch("/api/auth/profile");
      const json = await res.json().catch(() => ({}));
      if (json?.data) {
        const profile = json.data;
        firstNameInput.value = profile?.firstName || profile?.first_name || "";
        middleNameInput.value =
          profile?.middleName || profile?.middle_name || "";
        lastNameInput.value = profile?.lastName || profile?.last_name || "";
      } else {
        // Fallback: try to parse from display name
        const nameParts = nameDisplay.textContent.trim().split(" ");
        if (nameParts.length >= 2) {
          firstNameInput.value = nameParts[0] || "";
          lastNameInput.value = nameParts[nameParts.length - 1] || "";
          if (nameParts.length > 2) {
            middleNameInput.value = nameParts.slice(1, -1).join(" ") || "";
          }
        }
      }
    } catch (err) {
      console.warn("[PROFILE] Failed to load name values:", err);
      // Fallback: try to parse from display name
      const nameParts = nameDisplay.textContent.trim().split(" ");
      if (nameParts.length >= 2) {
        firstNameInput.value = nameParts[0] || "";
        lastNameInput.value = nameParts[nameParts.length - 1] || "";
        if (nameParts.length > 2) {
          middleNameInput.value = nameParts.slice(1, -1).join(" ") || "";
        }
      }
    }
  };

  editIcon.addEventListener("click", async () => {
    nameDisplay.style.display = "none";
    editIcon.style.display = "none";
    nameEdit.style.display = "flex";
    await loadNameValues();
    firstNameInput.focus();
  });

  cancelBtn?.addEventListener("click", () => {
    nameEdit.style.display = "none";
    nameDisplay.style.display = "inline";
    editIcon.style.display = "inline";
  });

  saveBtn?.addEventListener("click", async () => {
    const firstName = firstNameInput.value.trim();
    const middleName = middleNameInput.value.trim();
    const lastName = lastNameInput.value.trim();

    if (!firstName || !lastName) {
      showMessage("error", "First name and last name are required", 3000);
      return;
    }

    if (firstName.length < 2 || lastName.length < 2) {
      showMessage(
        "error",
        "First and last names must be at least 2 characters",
        3000
      );
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    nameEdit.classList.add("inline-edit-loading");

    try {
      const updateData = {
        first_name: firstName,
        last_name: lastName,
      };
      if (middleName) {
        updateData.middle_name = middleName;
      }

      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success)
        throw new Error(json?.error || "Failed to update name");

      // Build new display name
      const parts = [firstName, middleName, lastName].filter(Boolean);
      const newName = parts.join(" ");

      // Update display
      nameDisplay.textContent = newName;
      nameEdit.style.display = "none";
      nameDisplay.style.display = "inline";
      editIcon.style.display = "inline";

      // Update avatar initial
      const initialEl = document.getElementById("profile-initial");
      if (initialEl) {
        initialEl.textContent = firstName.charAt(0).toUpperCase();
      }

      showMessage("success", "Name updated successfully", 3000);
    } catch (err) {
      showMessage("error", err.message || "Failed to update name", 4000);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      nameEdit.classList.remove("inline-edit-loading");
    }
  });
}

// Email modal handler
function wireEmailEdit() {
  // Remove any existing event listeners by cloning and replacing the element
  const editIcon = document.getElementById("edit-email-icon");
  const modal = document.getElementById("email-change-modal");
  const closeBtn = document.getElementById("close-email-modal");
  const cancelBtn = document.getElementById("cancel-email-modal");
  const form = document.getElementById("email-change-form");
  const newEmailInput = document.getElementById("new-email-input");
  const currentPasswordInput = document.getElementById(
    "current-password-email"
  );
  const currentEmailDisplay = document.getElementById("current-email-display");

  if (!editIcon) {
    console.warn("[PROFILE] Email edit icon not found");
    return;
  }

  if (!modal) {
    console.warn("[PROFILE] Email change modal not found");
    return;
  }

  // Clone the icon to remove any existing event listeners
  const newEditIcon = editIcon.cloneNode(true);
  editIcon.parentNode.replaceChild(newEditIcon, editIcon);

  // Set current email in modal when opening
  const updateCurrentEmail = () => {
    const emailDisplay = document.getElementById("profile-email-display");
    if (emailDisplay && currentEmailDisplay) {
      currentEmailDisplay.textContent = emailDisplay.textContent.trim() || "—";
    }
  };

  newEditIcon.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[PROFILE] Email edit icon clicked");
    updateCurrentEmail();
    // Ensure modal is visible with proper styles - remove inline display:none
    modal.removeAttribute("style");
    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    modal.style.zIndex = "10002";
    // Focus on new email input after a short delay to ensure modal is visible
    setTimeout(() => {
      newEmailInput?.focus();
    }, 200);
  });

  const closeModal = () => {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    form?.reset();
    // Clear password field for security
    if (currentPasswordInput) {
      currentPasswordInput.value = "";
    }
  };

  // Use event delegation or ensure single attachment
  // Remove old listeners by replacing elements
  if (closeBtn) {
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  if (cancelBtn) {
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    newCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  // Close on overlay click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Prevent modal from closing when clicking inside modal content
  const modalContent = modal.querySelector(".modal-content");
  if (modalContent) {
    modalContent.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newEmail = newEmailInput?.value.trim() || "";
      const currentPassword = currentPasswordInput?.value || "";

      if (!newEmail || !currentPassword) {
        showMessage("error", "Both email and password are required", 3000);
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      try {
        // Step 1: Verify password server-side (security)
        const headers = await addCsrfTokenToHeaders({
          "Content-Type": "application/json",
        });
        const res = await fetch("/api/auth/request-email-change", {
          method: "POST",
          headers,
          body: JSON.stringify({ newEmail, currentPassword }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success)
          throw new Error(json?.error || "Failed to verify password");

        // Step 2: Update email client-side using Supabase's standard flow
        const { supabase } = await import("/js/config/config.js");
        const { data: _updateData, error: updateError } =
          await supabase.auth.updateUser({
            email: newEmail,
          });

        if (updateError) {
          // Check if email is already in use
          const errorMsg = String(updateError.message || "").toLowerCase();
          if (
            errorMsg.includes("already") ||
            errorMsg.includes("exists") ||
            errorMsg.includes("duplicate")
          ) {
            throw new Error("This email address is already registered");
          }
          throw new Error(updateError.message || "Failed to update email");
        }

        showMessage(
          "success",
          "A confirmation email has been sent to your new email address. Please check your inbox and click the confirmation link to complete the email change.",
          5000
        );
        closeModal();
      } catch (err) {
        showMessage(
          "error",
          err.message || "Failed to request email change",
          4000
        );
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Request Email Change";
        }
      }
    });
  }
}

// Mobile inline editing
function wireMobileEdit() {
  const editIcon = document.getElementById("edit-mobile-icon");
  const mobileDisplay = document.getElementById("profile-mobile-display");
  const mobileEdit = document.getElementById("profile-mobile-edit");
  const mobileInput = document.getElementById("edit-mobile-input");
  const saveBtn = document.getElementById("save-mobile-btn");
  const cancelBtn = document.getElementById("cancel-mobile-btn");

  if (!editIcon || !mobileDisplay || !mobileEdit || !mobileInput) return;

  // Add input validation to prevent non-numeric characters
  mobileInput.addEventListener("input", (e) => {
    // Remove any non-numeric characters
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
    // Limit to 10 digits
    if (e.target.value.length > 10) {
      e.target.value = e.target.value.slice(0, 10);
    }
  });

  // Prevent non-numeric input on keypress
  mobileInput.addEventListener("keypress", (e) => {
    // Allow: backspace, delete, tab, escape, enter
    if (
      [8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (e.keyCode === 65 && e.ctrlKey === true) ||
      (e.keyCode === 67 && e.ctrlKey === true) ||
      (e.keyCode === 86 && e.ctrlKey === true) ||
      (e.keyCode === 88 && e.ctrlKey === true)
    ) {
      return;
    }
    // Ensure that it is a number and stop the keypress
    if (
      (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
      (e.keyCode < 96 || e.keyCode > 105)
    ) {
      e.preventDefault();
    }
  });

  editIcon.addEventListener("click", () => {
    mobileDisplay.style.display = "none";
    editIcon.style.display = "none";
    mobileEdit.style.display = "block";
    mobileInput.value =
      mobileDisplay.textContent === "—" ? "" : mobileDisplay.textContent;
    mobileInput.focus();
  });

  cancelBtn?.addEventListener("click", () => {
    mobileEdit.style.display = "none";
    mobileDisplay.style.display = "inline";
    editIcon.style.display = "inline";
  });

  saveBtn?.addEventListener("click", async () => {
    const newMobile = mobileInput.value.trim();

    // Basic phone validation (Philippines format: +63XXXXXXXXXX or 09XXXXXXXXX)
    if (newMobile && !/^(\+63|0)?9\d{9}$/.test(newMobile.replace(/\s+/g, ""))) {
      showMessage("error", "Please enter a valid mobile number", 3000);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    mobileEdit.classList.add("inline-edit-loading");

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobileNumber: newMobile }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success)
        throw new Error(json?.error || "Failed to update mobile");

      // Update display
      mobileDisplay.textContent = newMobile || "—";
      mobileEdit.style.display = "none";
      mobileDisplay.style.display = "inline";
      editIcon.style.display = "inline";

      showMessage("success", "Mobile number updated successfully", 3000);
    } catch (err) {
      showMessage("error", err.message || "Failed to update mobile", 4000);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      mobileEdit.classList.remove("inline-edit-loading");
    }
  });
}

// Address editing
function wireAddressEdit() {
  const editBtn = document.getElementById("edit-address-btn");
  const addressDisplay = document.getElementById("address-display");
  const addressEdit = document.getElementById("address-edit");
  const saveBtn = document.getElementById("save-address-btn");
  const cancelBtn = document.getElementById("cancel-address-btn");

  if (!editBtn || !addressDisplay || !addressEdit) return;

  editBtn.addEventListener("click", () => {
    addressDisplay.style.display = "none";
    editBtn.style.display = "none";
    addressEdit.style.display = "flex";

    // Prefill inputs
    const line1El = document.getElementById("edit-address-line-1");
    const line2El = document.getElementById("edit-address-line-2");
    const _cityEl = document.getElementById("edit-address-city");
    const _provinceEl = document.getElementById("edit-address-province");
    const postalEl = document.getElementById("edit-address-postal");
    const barangayEl = document.getElementById("edit-address-barangay");

    const line1Display = document.getElementById("address-line-1-display");
    const line2Display = document.getElementById("address-line-2-display");
    const _cityDisplay = document.getElementById("address-city-display");
    const _provinceDisplay = document.getElementById("address-province-display");
    const postalDisplay = document.getElementById("address-postal-display");
    const barangayDisplay = document.getElementById("address-barangay-display");

    if (line1El && line1Display)
      line1El.value =
        line1Display.textContent === "—" ? "" : line1Display.textContent;
    if (line2El && line2Display)
      line2El.value =
        line2Display.textContent === "—" ? "" : line2Display.textContent;

    if (postalEl && postalDisplay)
      postalEl.value =
        postalDisplay.textContent === "—" ? "" : postalDisplay.textContent;
    if (barangayEl && barangayDisplay)
      barangayEl.value =
        barangayDisplay.textContent === "—" ? "" : barangayDisplay.textContent;

    line1El?.focus();
  });

  cancelBtn?.addEventListener("click", () => {
    addressEdit.style.display = "none";
    addressDisplay.style.display = "block";
    editBtn.style.display = "block";
  });

  saveBtn?.addEventListener("click", async () => {
    const line1 =
      document.getElementById("edit-address-line-1")?.value.trim() || "";
    const line2 =
      document.getElementById("edit-address-line-2")?.value.trim() || "";
    const city = "Digos City";
    const province = "Davao del Sur";
    const postalCode =
      document.getElementById("edit-address-postal")?.value.trim() || "";
    const barangay =
      document.getElementById("edit-address-barangay")?.value.trim() || "";

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    addressEdit.classList.add("inline-edit-loading");

    try {
      const updateData = {
        address_line_1: line1,
        address_line_2: line2,
        city,
        province,
        postal_code: postalCode,
        barangay,
      };

      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success)
        throw new Error(json?.error || "Failed to update address");

      // Re-render profile to update display
      const profile = await fetchProfile();
      renderProfile(profile);

      addressEdit.style.display = "none";
      addressDisplay.style.display = "block";
      editBtn.style.display = "block";

      showMessage("success", "Address updated successfully", 3000);
    } catch (err) {
      showMessage("error", err.message || "Failed to update address", 4000);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      addressEdit.classList.remove("inline-edit-loading");
    }
  });
}

function wireAccountDeletion(profile) {
  if (!profile) return;
  const openBtn = document.getElementById("open-delete-account");
  const modal = document.getElementById("delete-account-modal");
  const closeBtn = document.getElementById("delete-account-close");
  const cancelBtn = document.getElementById("cancel-delete-account");
  const form = document.getElementById("delete-account-form");
  const confirmInput = document.getElementById("delete-account-confirm-input");
  const reasonInput = document.getElementById("delete-account-reason");
  const ackInput = document.getElementById("delete-account-ack");
  const emailHint = document.getElementById("delete-account-email-hint");
  const submitBtn = document.getElementById("delete-account-submit");

  if (!openBtn || !modal || !form) return;

  const userEmail = (profile?.email || "").trim();
  if (emailHint) {
    emailHint.textContent = userEmail || "your email";
  }

  const openModal = () => {
    if (emailHint) {
      emailHint.textContent = userEmail || "your email";
    }
    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    confirmInput?.focus();
  };

  const closeModal = () => {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    form.reset();
    if (ackInput) ackInput.checked = false;
  };

  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  cancelBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!userEmail) {
      showMessage(
        "error",
        "Unable to determine your email. Please re-login and try again.",
        4000
      );
      return;
    }
    const typed = (confirmInput?.value || "").trim().toLowerCase();
    if (typed !== userEmail.toLowerCase()) {
      showMessage("error", "Please type your email exactly to confirm.", 4000);
      return;
    }
    const reason = (reasonInput?.value || "").trim();
    if (!reason || reason.length < 10) {
      showMessage(
        "error",
        "Please share a short reason (at least 10 characters).",
        4000
      );
      return;
    }
    if (!ackInput?.checked) {
      showMessage(
        "error",
        "Please acknowledge that this action is permanent.",
        4000
      );
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Deleting...";
    }

    try {
      const headers = await addCsrfTokenToHeaders({
        "Content-Type": "application/json",
      });
      const res = await fetch("/api/compliance/delete", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ confirm: true, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to delete account");
      }
      showMessage(
        "success",
        "Your account has been deleted. Redirecting...",
        4000
      );
      closeModal();
      setTimeout(() => {
        window.location.href = "/login";
      }, 2500);
    } catch (err) {
      console.error("[PROFILE] Delete account error:", err);
      showMessage("error", err.message || "Failed to delete account", 4000);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Delete My Account";
      }
    }
  });
}
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await checkAuthentication())) return;
  try {
    const profile = await fetchProfile();
    cachedProfile = profile;
    const role =
      profile?.role ||
      profile?.normalizedRole ||
      profile?.normalized_role ||
      "citizen";
    const roleLower = role.toLowerCase();
    const isStaff =
      roleLower === "lgu" ||
      roleLower === "lgu-officer" ||
      roleLower === "lgu-admin";

    // Update UI based on role
    const titleEl = document.getElementById("content-title");
    const actionButton = document.getElementById("action-button");

    if (titleEl) {
      titleEl.textContent = isStaff
        ? "Active Assignments"
        : "Active Complaints";
    }

    if (actionButton) {
      if (isStaff) {
        actionButton.style.display = "none";
      } else {
        actionButton.style.display = "block";
      }
    }

    // Fetch data based on role
    const data = await fetchMyComplaints(role);

    renderProfile(profile);
    renderComplaints(data, role);
  } catch (err) {
    showMessage("error", err.message || "Failed to load profile", 4000);
  }

  // Wire up all handlers
  wireChangePassword();
  wireNameEdit();
  wireEmailEdit();
  wireMobileEdit();
  wireAddressEdit();
  wireAccountDeletion(cachedProfile);
});
