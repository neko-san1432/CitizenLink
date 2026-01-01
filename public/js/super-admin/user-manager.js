import showMessage from "../components/toast.js";
import { supabase } from "../config/config.js";

let departmentsCache = [];
let selectedUser = null;
let currentUserRole = null;
let currentUserId = null;

// Helper function to get auth headers
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Get current user role
async function getCurrentUserRole() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUserId = session.user.id;
      const metadata = session.user.user_metadata || session.user.raw_user_meta_data || {};
      return metadata.role || "citizen";
    }
  } catch (e) {
    console.error("[USER_MANAGER] Error getting current user role:", e);
  }
  return "citizen";
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[USER_MANAGER] DOMContentLoaded - script is loading");

  try {
    currentUserRole = await getCurrentUserRole();
    await loadDepartments();
    setupHandlers();
    await refreshUserList();
    console.log("[USER_MANAGER] Initialization complete");
  } catch (error) {
    console.error("[USER_MANAGER] Initialization error:", error);
  }
});

// Also try to attach handlers immediately (in case DOMContentLoaded already fired)
if (document.readyState === "loading") {
  console.log("[USER_MANAGER] Document still loading, waiting for DOMContentLoaded");
} else {
  console.log("[USER_MANAGER] Document already loaded, setting up handlers immediately");
  loadDepartments().then(async () => {
    currentUserRole = await getCurrentUserRole();
    setupHandlers();
    refreshUserList();
  });
}

async function loadDepartments() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/department-structure/departments", {
      headers,
      credentials: "include"
    });
    const { data } = await res.json();
    departmentsCache = Array.isArray(data) ? data : [];
    const deptSelect = document.getElementById("promotion-dept");
    if (deptSelect) {
      departmentsCache.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.code?.toUpperCase() || "";
        opt.textContent = `${d.name} (${d.code})`;
        deptSelect.appendChild(opt);
      });
    }
  } catch (e) {
    // ignore
  }
}

function setupHandlers() {
  console.log("[USER_MANAGER] setupHandlers called");

  const search = document.getElementById("um-search");
  const filter = document.getElementById("um-filter");
  const refresh = document.getElementById("um-refresh");

  // Search input
  if (search) {
    let searchTimeout;
    search.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        refreshUserList();
      }
    });
    search.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        refreshUserList();
      }, 500);
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        search.value = "";
        refreshUserList();
      }
    });
  }

  // Filter dropdown
  if (filter) {
    filter.addEventListener("change", () => {
      refreshUserList();
    });
  }

  // Refresh button
  if (refresh) {
    refresh.addEventListener("click", () => {
      refreshUserList();
    });
  }

  // Promotion modal handlers
  const promotionCloseBtn = document.getElementById("promotion-close");
  if (promotionCloseBtn) {
    promotionCloseBtn.addEventListener("click", hidePromotionModal);
  }

  const promotionModal = document.getElementById("promotion-modal");
  if (promotionModal) {
    promotionModal.addEventListener("click", (e) => { if (e.target === promotionModal) hidePromotionModal(); });
  }

  const promotionForm = document.getElementById("promotion-form");
  if (promotionForm) {
    promotionForm.addEventListener("submit", onPromoteSubmit);
  }

  // Ban modal handlers
  const banCloseBtn = document.getElementById("ban-close");
  if (banCloseBtn) {
    banCloseBtn.addEventListener("click", hideBanModal);
  }

  const banModal = document.getElementById("ban-modal");
  if (banModal) {
    banModal.addEventListener("click", (e) => { if (e.target === banModal) hideBanModal(); });
  }

  const banForm = document.getElementById("ban-form");
  if (banForm) {
    banForm.addEventListener("submit", onBanSubmit);
  }

  // Delete user modal handlers
  const deleteCloseBtn = document.getElementById("delete-user-close");
  if (deleteCloseBtn) {
    deleteCloseBtn.addEventListener("click", hideDeleteModal);
  }

  const deleteCancelBtn = document.getElementById("delete-user-cancel");
  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      hideDeleteModal();
    });
  }

  const deleteModal = document.getElementById("delete-user-modal");
  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal) hideDeleteModal();
    });
  }

  const deleteForm = document.getElementById("delete-user-form");
  if (deleteForm) {
    deleteForm.addEventListener("submit", onDeleteUserSubmit);
  }

  // Ban type change handler
  const banTypeSelect = document.getElementById("ban-type");
  if (banTypeSelect) {
    banTypeSelect.addEventListener("change", (e) => {
      const durationGroup = document.getElementById("ban-duration-group");
      if (e.target.value === "temporary") {
        durationGroup.style.display = "block";
        document.getElementById("ban-duration").setAttribute("required", "required");
      } else {
        durationGroup.style.display = "none";
        document.getElementById("ban-duration").removeAttribute("required");
      }
    });
  }

  console.log("[USER_MANAGER] setupHandlers complete");
}

async function refreshUserList() {
  const list = document.getElementById("um-user-list");
  if (!list) return;

  const searchInput = document.getElementById("um-search");
  const filterSelect = document.getElementById("um-filter");
  const searchQuery = (searchInput?.value || "").trim().toLowerCase();
  const filter = filterSelect?.value || "all";

  // Show loading state
  list.innerHTML = '<p class="empty-state">Loading users...</p>';

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/superadmin/users?limit=1000&search=${encodeURIComponent(searchQuery)}`, {
      headers,
      credentials: "include"
    });
    const result = await res.json();
    const users = (result.success && Array.isArray(result.data)) ? result.data : [];

    // Apply filters
    const filtered = users.filter(u => {
      // Role filter
      const role = String(u.role || "").toLowerCase();
      if (filter === "citizen") {
        if (role !== "citizen") return false;
      } else if (filter === "staff") {
        if (role === "citizen") return false;
      } else if (filter === "banned") {
        const isBanned = u.isBanned === true || u.raw_user_meta_data?.isBanned === true || u.user_metadata?.isBanned === true;
        if (!isBanned) return false;
      }

      // Search filter
      if (searchQuery) {
        const name = (u.fullName || u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const department = (u.department || "").toLowerCase();
        const roleDisplay = normalizeRoleDisplay(u.role, u.department).toLowerCase();

        const matchesSearch = name.includes(searchQuery) ||
                             email.includes(searchQuery) ||
                             department.includes(searchQuery) ||
                             roleDisplay.includes(searchQuery);

        if (!matchesSearch) return false;
      }

      return true;
    });

    // Render results
    if (filtered.length === 0) {
      list.innerHTML = '<p class="empty-state">No users found matching your criteria.</p>';
    } else {
      list.innerHTML = filtered.map(u => renderUserRow(u)).join("");
    }

    // Attach event listeners
    list.querySelectorAll(".um-user-item").forEach(el => {
      el.addEventListener("click", async () => {
        const id = el.getAttribute("data-user-id");
        await loadUserDetails(id);
      });

      const promoteBtn = el.querySelector(".um-promote");
      const demoteBtn = el.querySelector(".um-demote");
      const banBtn = el.querySelector(".um-ban");
      const unbanBtn = el.querySelector(".um-unban");

      if (promoteBtn) {
        promoteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          openPromotionModal(el.dataset.userEmail, el.dataset.userName, el.dataset.userId);
        });
      }

      if (demoteBtn) {
        demoteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await demoteToCitizen(el.dataset.userId);
        });
      }

      if (banBtn) {
        banBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          openBanModal(el.dataset.userEmail, el.dataset.userName, el.dataset.userId);
        });
      }

      if (unbanBtn) {
        unbanBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await unbanUser(el.dataset.userId);
        });
      }
    });
  } catch (e) {
    list.innerHTML = '<p class="empty-state">Failed to load users.</p>';
  }
}

// Normalize role for display
function normalizeRoleDisplay(role, department = null) {
  if (!role) return "Citizen";
  const roleLower = role.toLowerCase();

  let displayRole = "";
  if (roleLower === "lgu" || roleLower === "lgu-officer") {
    displayRole = "LGU Officer";
  } else if (roleLower === "lgu-admin") {
    displayRole = "LGU Admin";
  } else if (roleLower === "lgu-hr") {
    displayRole = "LGU HR";
  } else if (roleLower === "super-admin") {
    displayRole = "Super Admin";
  } else if (roleLower === "complaint-coordinator") {
    displayRole = "Complaint Coordinator";
  } else if (roleLower === "citizen") {
    displayRole = "Citizen";
  } else {
    displayRole = role.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

  const isLguRole = roleLower === "lgu" || roleLower === "lgu-officer" || roleLower === "lgu-admin" || roleLower === "lgu-hr";
  if (isLguRole && department) {
    displayRole += ` - ${department}`;
  }

  return displayRole;
}

function renderUserRow(u) {
  const role = (u.role || "").toLowerCase();
  const isCitizen = role === "citizen";
  const displayRole = normalizeRoleDisplay(u.role, u.department);

  // Check ban status
  const isBanned = u.isBanned === true ||
                  u.raw_user_meta_data?.isBanned === true ||
                  u.user_metadata?.isBanned === true;
  const banExpiresAt = u.banExpiresAt || u.raw_user_meta_data?.banExpiresAt || u.user_metadata?.banExpiresAt;
  const warningStrike = u.warningStrike || u.raw_user_meta_data?.warningStrike || u.user_metadata?.warningStrike || 0;

  // Check if ban has expired
  let banStatus = "";
  if (isBanned && banExpiresAt) {
    const expirationDate = new Date(banExpiresAt);
    const now = new Date();
    if (now > expirationDate) {
      banStatus = '<span style="color:#10b981; font-size:0.75rem;">(Ban Expired)</span>';
    } else {
      const banType = u.banType || u.raw_user_meta_data?.banType || u.user_metadata?.banType || "temporary";
      if (banType === "permanent") {
        banStatus = '<span style="color:#ef4444; font-size:0.75rem;">🔴 BANNED (Permanent)</span>';
      } else {
        banStatus = `<span style="color:#f59e0b; font-size:0.75rem;">🟡 BANNED (Until ${new Date(banExpiresAt).toLocaleDateString()})</span>`;
      }
    }
  }

  return `
    <div class="um-user-item user-item" data-user-id="${u.id}" data-user-email="${escapeHtml(u.email || "")}" data-user-name="${escapeHtml(u.fullName || u.name || "")}">
      <div><strong>${escapeHtml(u.fullName || u.name || u.email)}</strong> ${banStatus}</div>
      <div style="color:#64748b; font-size:0.875rem;">${escapeHtml(u.email || "")}</div>
      <div style="color:#64748b; font-size:0.875rem;">Role: ${escapeHtml(displayRole)}</div>
      ${warningStrike > 0 ? `<div style="color:#f59e0b; font-size:0.75rem;">⚠️ Warning Strikes: ${warningStrike}</div>` : ""}
      <div style="margin-top:0.5rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
        ${isCitizen ? `<button class="btn btn-primary um-promote">Promote</button>` : `<button class="btn btn-secondary um-demote">Demote to Citizen</button>`}
        ${!isBanned ? `<button class="btn btn-danger um-ban">Ban Now</button>` : ""}
        ${isBanned && currentUserRole === "super-admin" ? `<button class="btn btn-success um-unban">Unban</button>` : ""}
      </div>
    </div>
  `;
}

async function loadUserDetails(userId) {
  selectedUser = null;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/superadmin/users/${userId}`, {
      headers,
      credentials: "include"
    });
    const result = await res.json();
    const container = document.getElementById("um-user-details");
    if (!container) return;
    if (result.success && result.data) {
      selectedUser = result.data;
      const u = selectedUser;

      // Get ban status
      const isBanned = u.isBanned === true ||
                      u.raw_user_meta_data?.isBanned === true ||
                      u.user_metadata?.isBanned === true;
      const banType = u.banType || u.raw_user_meta_data?.banType || u.user_metadata?.banType;
      const banExpiresAt = u.banExpiresAt || u.raw_user_meta_data?.banExpiresAt || u.user_metadata?.banExpiresAt;
      const banReason = u.banReason || u.raw_user_meta_data?.banReason || u.user_metadata?.banReason;
      const warningStrike = u.warningStrike || u.raw_user_meta_data?.warningStrike || u.user_metadata?.warningStrike || 0;

      let banInfo = "";
      if (isBanned) {
        if (banExpiresAt) {
          const expirationDate = new Date(banExpiresAt);
          const now = new Date();
          if (now > expirationDate) {
            banInfo = '<div style="color:#10b981; padding:0.5rem; background:#f0fdf4; border-radius:4px; margin-top:0.5rem;">Ban has expired</div>';
          } else {
            const banTypeText = banType === "permanent" ? "Permanent" : "Temporary";
            banInfo = `
              <div style="color:#ef4444; padding:0.5rem; background:#fef2f2; border-radius:4px; margin-top:0.5rem;">
                <strong>Banned (${banTypeText})</strong><br>
                ${banType !== "permanent" ? `Expires: ${new Date(banExpiresAt).toLocaleString()}<br>` : ""}
                ${banReason ? `Reason: ${escapeHtml(banReason)}` : ""}
              </div>
            `;
          }
        }
      }

      const isTargetSuperAdmin = String(u.role || "").toLowerCase() === "super-admin";
      const canDeleteUser = currentUserRole === "super-admin" && u.id !== currentUserId && !isTargetSuperAdmin;

      container.innerHTML = `
        <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem;">
          <div style="width:48px; height:48px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center;">👤</div>
          <div>
            <div style="font-weight:700; font-size:1.125rem; color:#1e293b;">${escapeHtml(u.fullName || u.name || u.email)}</div>
            <div style="color:#64748b; font-size:0.875rem;">${escapeHtml(u.email || "")}</div>
          </div>
        </div>
        ${banInfo}
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; padding-top:1rem; border-top:1px solid #e2e8f0;">
          <div><strong style="color:#1e293b;">Role:</strong> <span style="color:#64748b;">${escapeHtml(normalizeRoleDisplay(u.role, u.department))}</span></div>
          <div><strong style="color:#1e293b;">Department:</strong> <span style="color:#64748b;">${escapeHtml(u.department || "-")}</span></div>
          <div><strong style="color:#1e293b;">Warning Strikes:</strong> <span style="color:#64748b;">${warningStrike}</span></div>
        </div>
        <div style="margin-top:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
          ${!isBanned ? `<button class="btn btn-danger" onclick="openBanModal('${escapeHtml(u.email || "")}', '${escapeHtml(u.fullName || u.name || "")}', '${u.id}')">Ban Now</button>` : ""}
          ${isBanned && currentUserRole === "super-admin" ? `<button class="btn btn-success" onclick="unbanUser('${u.id}')">Unban</button>` : ""}
          ${canDeleteUser ? '<button class="btn btn-secondary" id="delete-user-btn">Delete Account</button>' : ""}
        </div>
      `;

      if (canDeleteUser) {
        const deleteBtn = container.querySelector("#delete-user-btn");
        if (deleteBtn) {
          deleteBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openDeleteModal(u);
          });
        }
      }
    }
  } catch (e) {
    console.error("[USER_MANAGER] Error loading user details:", e);
  }
}

function openPromotionModal(email, name, userId) {
  const modal = document.getElementById("promotion-modal");
  if (!modal) {
    showMessage("error", "Promotion modal not found");
    return;
  }

  selectedUser = { id: userId, email, name };

  const userLabel = document.getElementById("promotion-user-label");
  const roleSelect = document.getElementById("promotion-role");
  const deptSelect = document.getElementById("promotion-dept");
  const reasonTextarea = document.getElementById("promotion-reason");

  if (userLabel) userLabel.value = `${name || email}`;
  if (roleSelect) {
    roleSelect.value = "";
    roleSelect.removeEventListener("change", updateDepartmentRequirement);
    roleSelect.addEventListener("change", updateDepartmentRequirement);
  }
  if (deptSelect) deptSelect.value = "";
  if (reasonTextarea) reasonTextarea.value = "";

  updateDepartmentRequirement();
  modal.style.display = "flex";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  modal.style.zIndex = "10000";
}

function updateDepartmentRequirement() {
  const roleSelect = document.getElementById("promotion-role");
  const deptSelect = document.getElementById("promotion-dept");
  const requiredIndicator = document.getElementById("dept-required-indicator");
  const helpText = document.getElementById("dept-help-text");

  if (!roleSelect || !deptSelect) return;

  const selectedRole = roleSelect.value;
  const isSuperAdmin = selectedRole === "super-admin";
  const isCoordinator = selectedRole === "complaint-coordinator";
  const shouldDisable = isSuperAdmin || isCoordinator;

  if (shouldDisable) {
    deptSelect.disabled = true;
    deptSelect.removeAttribute("required");
    deptSelect.value = "";
    if (requiredIndicator) requiredIndicator.style.display = "none";
    if (helpText) {
      const roleName = isSuperAdmin ? "Super Admin" : "Complaint Coordinator";
      helpText.textContent = `Not applicable for ${roleName}`;
    }
    deptSelect.style.backgroundColor = "#f3f4f6";
    deptSelect.style.cursor = "not-allowed";
  } else {
    deptSelect.disabled = false;
    deptSelect.setAttribute("required", "required");
    if (requiredIndicator) requiredIndicator.style.display = "inline";
    if (helpText) {
      helpText.textContent = "Required for all roles except Super Admin and Complaint Coordinator";
    }
    deptSelect.style.backgroundColor = "";
    deptSelect.style.cursor = "";
  }
}

function hidePromotionModal() {
  const modal = document.getElementById("promotion-modal");
  if (modal) {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
  }
}

async function onPromoteSubmit(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!selectedUser) {
    showMessage("error", "No user selected");
    return;
  }

  const roleSelect = document.getElementById("promotion-role");
  const deptSelect = document.getElementById("promotion-dept");
  const reasonTextarea = document.getElementById("promotion-reason");

  if (!roleSelect || !deptSelect) {
    showMessage("error", "Form elements not found");
    return;
  }

  const role = roleSelect.value;
  const dept = deptSelect.value;
  const reason = reasonTextarea?.value || "";

  if (!role) {
    showMessage("error", "Please select a role");
    return;
  }

  const rolesWithoutDept = ["super-admin", "complaint-coordinator"];
  if (!rolesWithoutDept.includes(role) && !dept) {
    showMessage("error", "Please select an office (not required for Super Admin and Complaint Coordinator)");
    return;
  }

  const requestBody = {
    user_id: selectedUser.id,
    role,
    department_id: dept,
    reason: reason || undefined
  };

  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/superadmin/assign-citizen", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(requestBody)
    });

    const result = await res.json();

    if (result.success) {
      showMessage("success", `Citizen promoted successfully to ${role}`);
      hidePromotionModal();
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshUserList();
      if (selectedUser && selectedUser.id) {
        await loadUserDetails(selectedUser.id);
      }
    } else {
      showMessage("error", result.error || "Failed to promote");
    }
  } catch (e) {
    console.error("[USER_MANAGER] Promotion exception:", e);
    showMessage("error", e.message || "Failed to promote");
  }
}

async function demoteToCitizen(userId) {
  if (!confirm("Demote this user to Citizen?")) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/superadmin/role-swap", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ user_id: userId, new_role: "citizen", reason: "Demotion by super-admin" })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Network error" }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const result = await res.json();

    if (result.success) {
      showMessage("success", `User demoted to Citizen.`);
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshUserList();
      if (selectedUser && selectedUser.id === userId) {
        await loadUserDetails(userId);
      }
    } else {
      showMessage("error", result.error || "Failed to demote");
    }
  } catch (e) {
    console.error("[USER_MANAGER] Demotion exception:", e);
    showMessage("error", `Failed to demote: ${  e.message || "Network error"}`);
  }
}

function openBanModal(email, name, userId) {
  const modal = document.getElementById("ban-modal");
  if (!modal) {
    showMessage("error", "Ban modal not found");
    return;
  }

  selectedUser = { id: userId, email, name };

  const userLabel = document.getElementById("ban-user-label");
  const banTypeSelect = document.getElementById("ban-type");
  const durationInput = document.getElementById("ban-duration");
  const reasonTextarea = document.getElementById("ban-reason");

  if (userLabel) userLabel.value = `${name || email}`;
  if (banTypeSelect) banTypeSelect.value = "";
  if (durationInput) {
    durationInput.value = "";
    durationInput.removeAttribute("required");
  }
  if (reasonTextarea) reasonTextarea.value = "";

  document.getElementById("ban-duration-group").style.display = "none";

  modal.style.display = "flex";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  modal.style.zIndex = "10000";
}

function hideBanModal() {
  const modal = document.getElementById("ban-modal");
  if (modal) {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
  }
}

async function onBanSubmit(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!selectedUser) {
    showMessage("error", "No user selected");
    return;
  }

  const banTypeSelect = document.getElementById("ban-type");
  const durationInput = document.getElementById("ban-duration");
  const reasonTextarea = document.getElementById("ban-reason");

  if (!banTypeSelect || !reasonTextarea) {
    showMessage("error", "Form elements not found");
    return;
  }

  const banType = banTypeSelect.value;
  const duration = banType === "temporary" ? parseInt(durationInput?.value) : null;
  const reason = reasonTextarea.value.trim();

  if (!banType) {
    showMessage("error", "Please select a ban type");
    return;
  }

  if (banType === "temporary" && (!duration || duration < 1)) {
    showMessage("error", "Please enter a valid duration (in hours)");
    return;
  }

  if (!reason) {
    showMessage("error", "Please provide a reason for the ban");
    return;
  }

  const requestBody = {
    user_id: selectedUser.id,
    type: banType,
    duration,
    reason
  };

  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/superadmin/ban-user", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(requestBody)
    });

    const result = await res.json();

    if (result.success) {
      showMessage("success", `User banned successfully (${banType})`);
      hideBanModal();
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshUserList();
      if (selectedUser && selectedUser.id) {
        await loadUserDetails(selectedUser.id);
      }
    } else {
      showMessage("error", result.error || "Failed to ban user");
    }
  } catch (e) {
    console.error("[USER_MANAGER] Ban exception:", e);
    showMessage("error", e.message || "Failed to ban user");
  }
}

async function unbanUser(userId) {
  if (!confirm("Unban this user?")) return;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/superadmin/unban-user", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ user_id: userId })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Network error" }));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }

    const result = await res.json();

    if (result.success) {
      showMessage("success", "User unbanned successfully");
      await new Promise(resolve => setTimeout(resolve, 500));
      await refreshUserList();
      if (selectedUser && selectedUser.id === userId) {
        await loadUserDetails(userId);
      }
    } else {
      showMessage("error", result.error || "Failed to unban user");
    }
  } catch (e) {
    console.error("[USER_MANAGER] Unban exception:", e);
    showMessage("error", `Failed to unban: ${  e.message || "Network error"}`);
  }
}

function openDeleteModal(user) {
  const modal = document.getElementById("delete-user-modal");
  if (!modal) {
    showMessage("error", "Delete modal not found");
    return;
  }

  selectedUser = user;
  const nameLabel = document.getElementById("delete-user-name");
  const emailLabel = document.getElementById("delete-user-email");
  const confirmInput = document.getElementById("delete-user-confirm-input");
  const reasonInput = document.getElementById("delete-user-reason");

  if (nameLabel) {
    nameLabel.textContent = user.fullName || user.name || user.email || "Selected user";
  }
  if (emailLabel) {
    emailLabel.textContent = user.email || "N/A";
  }
  if (confirmInput) {
    confirmInput.value = "";
    confirmInput.placeholder = (user.email || "").toLowerCase();
  }
  if (reasonInput) {
    reasonInput.value = "";
  }

  modal.style.display = "flex";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  modal.style.zIndex = "10000";
}

function hideDeleteModal() {
  const modal = document.getElementById("delete-user-modal");
  if (modal) {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
  }
}

async function onDeleteUserSubmit(e) {
  e.preventDefault();
  if (!selectedUser) {
    showMessage("error", "No user selected for deletion");
    return;
  }

  const confirmInput = document.getElementById("delete-user-confirm-input");
  const reasonInput = document.getElementById("delete-user-reason");
  const submitBtn = document.getElementById("delete-user-submit");

  const expected = (selectedUser.email || "").toLowerCase();
  const provided = (confirmInput?.value || "").trim().toLowerCase();
  if (!expected || provided !== expected) {
    showMessage("error", "Please type the user's email to confirm deletion");
    return;
  }

  const reason = (reasonInput?.value || "").trim();
  if (!reason || reason.length < 10) {
    showMessage("error", "Please provide a reason (at least 10 characters)");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Deleting...";
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/compliance/delete", {
      method: "DELETE",
      headers,
      credentials: "include",
      body: JSON.stringify({ userId: selectedUser.id, reason })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result?.success) {
      throw new Error(result?.error || "Failed to delete user");
    }

    showMessage("success", "User deleted successfully");
    hideDeleteModal();
    selectedUser = null;
    const details = document.getElementById("um-user-details");
    if (details) {
      details.innerHTML = '<p class="empty-state">Select a user to manage.</p>';
    }
    await refreshUserList();
  } catch (error) {
    console.error("[USER_MANAGER] Delete user error:", error);
    showMessage("error", error.message || "Failed to delete user");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Delete User";
    }
  }
}

// Make functions available globally for inline onclick handlers
window.openBanModal = openBanModal;
window.unbanUser = unbanUser;
window.openDeleteModal = openDeleteModal;

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

