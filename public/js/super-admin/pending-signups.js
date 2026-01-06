/**
 * Super Admin Pending Signups Page
 * Display and manage pending signup requests
 */
import showMessage from "../components/toast.js";

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadPendingSignups();

  // Add refresh button listener
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      // Add rotation animation
      const icon = refreshBtn.querySelector(".refresh-icon");
      if (icon) icon.style.transition = "transform 0.5s ease";
      if (icon) icon.style.transform = "rotate(360deg)";

      await loadPendingSignups();

      setTimeout(() => {
        if (icon) icon.style.transform = "none";
      }, 500);
    });
  }
});

/**
 * Load pending signups
 */
window.loadPendingSignups = async function () {
  const container = document.getElementById("pending-signups-container");
  if (!container) return; // Guard clause

  try {
    // Show loading state
    container.innerHTML = `
      <div class="loading-container" style="grid-column: 1 / -1;">
        <div class="spinner-lg"></div>
        <p>Loading requests...</p>
      </div>
    `;

    const response = await fetch("/api/hr/pending-signups");
    const result = await response.json();

    if (result.success && result.data) {
      displayPendingSignups(result.data);
    } else {
      container.innerHTML = `
        <div class="empty-state-modern" style="grid-column: 1 / -1;">
          <div class="empty-icon">⚠️</div>
          <div class="empty-text">Unable to load requests</div>
          <div class="empty-subtext">${
  result.error || "Please try refreshing the page"
}</div>
        </div>`;
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load pending signups error:", error);
    if (container) {
      container.innerHTML = `
        <div class="empty-state-modern" style="grid-column: 1 / -1;">
           <div class="empty-icon">❌</div>
           <div class="empty-text">Connection Error</div>
           <div class="empty-subtext">Check your internet connection and try again</div>
        </div>`;
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
    container.innerHTML = `
      <div class="empty-state-modern" style="grid-column: 1 / -1;">
        <div class="empty-icon">✓</div>
        <div class="empty-text">All caught up!</div>
        <div class="empty-subtext">There are no pending signup requests at the moment.</div>
      </div>
    `;
    return;
  }

  const html = users
    .map((user) => {
      const name = user.name || user.fullName || user.email || user.id;
      const dept =
        user?.raw_user_meta_data?.pending_department ||
        user?.user_metadata?.pending_department ||
        "General";
      const role =
        user?.raw_user_meta_data?.pending_role ||
        user?.user_metadata?.pending_role ||
        "Citizen";
      const email = user.email || "No email";
      const createdAt = user.created_at
        ? new Date(user.created_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
        : "Unknown";

      // Get initials
      const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();

      return `
      <div class="user-card">
        <div class="card-header">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name" title="${escapeHtml(name)}">${escapeHtml(
  name
)}</div>
            <div class="user-email" title="${escapeHtml(email)}">${escapeHtml(
  email
)}</div>
          </div>
        </div>
        
        <div class="card-details">
          <div class="detail-row">
            <span class="detail-label">Role Request</span>
            <span class="detail-value badge badge-role">${escapeHtml(
    String(role)
  )}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Department</span>
            <span class="detail-value badge badge-dept">${escapeHtml(
    String(dept)
  )}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Registered</span>
            <span class="detail-value">${createdAt}</span>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn-card btn-approve" onclick="approvePending('${
  user.id
}')">
            <span>Approve</span>
          </button>
          <button class="btn-card btn-reject" onclick="rejectPending('${
  user.id
}')">
            <span>Reject</span>
          </button>
        </div>
      </div>
    `;
    })
    .join("");

  container.innerHTML = html;
}

/**
 * Approve pending signup
 */
window.approvePending = async function (userId) {
  if (!confirm("Are you sure you want to approve this signup request?")) {
    return;
  }

  try {
    const response = await fetch(`/api/hr/pending-signups/${userId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
window.rejectPending = async function (userId) {
  if (!confirm("Are you sure you want to reject this signup request?")) {
    return;
  }

  try {
    const response = await fetch(`/api/hr/pending-signups/${userId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
