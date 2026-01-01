/**
 * Super Admin Pending Signups Page
 * Display and manage pending signup requests
 */
import showMessage from "../components/toast.js";

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadPendingSignups();
});

/**
 * Load pending signups
 */
window.loadPendingSignups = async function() {
  try {
    const container = document.getElementById("pending-signups-container");
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading pending signups...</p>
      </div>
    `;

    const response = await fetch("/api/hr/pending-signups");
    const result = await response.json();

    if (result.success && result.data) {
      displayPendingSignups(result.data);
    } else {
      container.innerHTML = `<p class="empty-state" style="color: #ef4444;">Failed to load pending signups: ${  result.error || "Unknown error"  }</p>`;
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load pending signups error:", error);
    const container = document.getElementById("pending-signups-container");
    if (container) {
      container.innerHTML = '<p class="empty-state" style="color: #ef4444;">Failed to load pending signups</p>';
    }
    showMessage("Failed to load pending signups", "error");
  }
};

/**
 * Display pending signups
 */
function displayPendingSignups(users) {
  const container = document.getElementById("pending-signups-container");
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = '<p class="empty-state">No pending signups found</p>';
    return;
  }

  const html = `
    <div class="pending-signups-list">
      ${users.map(user => {
    const name = user.name || user.fullName || user.email || user.id;
    const dept = user?.raw_user_meta_data?.pending_department || user?.user_metadata?.pending_department || "-";
    const role = user?.raw_user_meta_data?.pending_role || user?.user_metadata?.pending_role || "-";
    const email = user.email || "No email";
    const createdAt = user.created_at ? new Date(user.created_at).toLocaleString() : "Unknown";

    return `
          <div class="user-item" style="display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem; background: white;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.25rem;">
                  ${name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight: 600; color: #111827; font-size: 1.1rem; margin-bottom: 0.25rem;">
                    ${escapeHtml(name)}
                  </div>
                  <div style="font-size: 0.875rem; color: #6b7280;">
                    ${escapeHtml(email)}
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 1.5rem; font-size: 0.875rem; color: #6b7280; flex-wrap: wrap; margin-top: 0.75rem;">
                <div><strong>Requested Role:</strong> ${escapeHtml(String(role))}</div>
                <div><strong>Department:</strong> ${escapeHtml(String(dept))}</div>
                <div><strong>Registered:</strong> ${createdAt}</div>
              </div>
            </div>
            <div style="display: flex; gap: 0.75rem; margin-left: 1rem;">
              <button class="btn btn-success" onclick="approvePending('${user.id}')" style="white-space: nowrap;">Approve</button>
              <button class="btn btn-danger" onclick="rejectPending('${user.id}')" style="white-space: nowrap;">Reject</button>
            </div>
          </div>
        `;
  }).join("")}
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Approve pending signup
 */
window.approvePending = async function(userId) {
  if (!confirm("Are you sure you want to approve this signup request?")) {
    return;
  }

  try {
    const response = await fetch(`/api/hr/pending-signups/${userId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const result = await response.json();

    if (result.success) {
      showMessage("Signup approved successfully", "success");
      await loadPendingSignups();
    } else {
      showMessage(result.error || "Failed to approve signup", "error");
    }
  } catch (error) {
    console.error("[SUPERADMIN] Approve pending signup error:", error);
    showMessage("Failed to approve signup", "error");
  }
};

/**
 * Reject pending signup
 */
window.rejectPending = async function(userId) {
  if (!confirm("Are you sure you want to reject this signup request?")) {
    return;
  }

  try {
    const response = await fetch(`/api/hr/pending-signups/${userId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const result = await response.json();

    if (result.success) {
      showMessage("Signup rejected successfully", "success");
      await loadPendingSignups();
    } else {
      showMessage(result.error || "Failed to reject signup", "error");
    }
  } catch (error) {
    console.error("[SUPERADMIN] Reject pending signup error:", error);
    showMessage("Failed to reject signup", "error");
  }
};

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

