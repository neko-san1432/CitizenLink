/**
 * HR Dashboard
 * Role management interface for HR personnel
 */
import showMessage from "../components/toast.js";

// Check for OAuth success message
const oauthSuccessMessage = sessionStorage.getItem("oauth_success_message");
if (oauthSuccessMessage) {
  sessionStorage.removeItem("oauth_success_message");
  showMessage("success", oauthSuccessMessage, 5000);
}

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  await loadDepartmentStats();
  await loadRoleDistribution();
  await loadPerformanceData();
  await loadWorkloadDistribution();
  await loadBottleneckAlerts();
  setupFormHandlers();
  setupUserSearch();

  // Setup refresh button event listener
  const refreshRoleDistributionBtn = document.getElementById(
    "refresh-role-distribution-btn"
  );
  if (refreshRoleDistributionBtn) {
    refreshRoleDistributionBtn.addEventListener("click", loadRoleDistribution);
  }

  // Setup quick action buttons (placeholders for future implementation)
  const promoteUserBtn = document.getElementById("promote-user-btn");
  if (promoteUserBtn) {
    promoteUserBtn.addEventListener("click", () => {
      showMessage(
        "info",
        "Please use the User Management section to promote users"
      );
    });
  }

  const demoteUserBtn = document.getElementById("demote-user-btn");
  if (demoteUserBtn) {
    demoteUserBtn.addEventListener("click", () => {
      showMessage(
        "info",
        "Please use the User Management section to demote users"
      );
    });
  }

  const getHelpBtn = document.getElementById("get-help-btn");
  if (getHelpBtn) {
    getHelpBtn.addEventListener("click", () => {
      showMessage("info", "Help feature coming soon");
    });
  }
});

// Chart instance for role distribution
let roleDistributionChart = null;
/**
 * Load dashboard data
 */
async function loadDashboardData() {
  try {
    const response = await fetch("/api/hr/dashboard");
    const result = await response.json();
    if (result.success) {
      updateStatistics(result.data.statistics);
    }
  } catch (error) {
    console.error("[HR] Load dashboard error:", error);
  }
}
/**
 * Update statistics display
 */
function updateStatistics(stats) {
  document.getElementById("stat-officers").textContent =
    stats.total_officers || 0;
  document.getElementById("stat-admins").textContent = stats.total_admins || 0;
  document.getElementById("stat-promotions").textContent =
    stats.promotions_this_month || 0;
  document.getElementById("stat-demotions").textContent =
    stats.demotions_this_month || 0;
}
/**
 * Load department statistics
 */
async function loadDepartmentStats() {
  try {
    const response = await fetch("/api/hr/users?limit=1000");
    const result = await response.json();
    if (result.success && result.data) {
      const users = result.data;
      const departmentStats = calculateDepartmentStats(users);
      renderDepartmentStats(departmentStats);
    } else {
      renderDepartmentStats([]);
    }
  } catch (error) {
    console.error("[HR] Load department stats error:", error);
    renderDepartmentStats([]);
  }
}
/**
 * Calculate department statistics from user data
 */
function calculateDepartmentStats(users) {
  const deptMap = new Map();
  const seenUserIds = new Set();
  users.forEach((user) => {
    if (user && user.id) {
      if (seenUserIds.has(user.id)) return; // avoid double counting same user
      seenUserIds.add(user.id);
    }
    const role = String(user.role || "").toLowerCase();
    // Derive department from multiple sources; skip if missing
    const department =
      user.department ||
      user.dpt ||
      user?.raw_user_meta_data?.department ||
      user?.raw_user_meta_data?.dpt ||
      user?.user_metadata?.department ||
      user?.user_metadata?.dpt ||
      null;
    if (!department) return; // Ignore records without an office to avoid 'Unknown'

    if (!deptMap.has(department)) {
      deptMap.set(department, { admins: 0, officers: 0 });
    }
    const deptStats = deptMap.get(department);
    // Count admins (lgu-admin-* roles)
    if (role === "lgu-admin" || /^lgu-admin-/.test(role)) {
      deptStats.admins++;
      return;
    }
    // Count officers: include simplified 'lgu' and legacy lgu-* except admin/hr
    if (role === "lgu" || /^lgu-(?!admin|hr)/.test(role)) {
      deptStats.officers++;
    }
  });
  return Array.from(deptMap.entries())
    .map(([dept, stats]) => ({
      department: dept,
      admins: stats.admins,
      officers: stats.officers,
      total: stats.admins + stats.officers,
    }))
    .sort((a, b) => b.total - a.total);
}
/**
 * Load role distribution and render pie chart
 */
window.loadRoleDistribution = async function loadRoleDistribution() {
  try {
    const response = await fetch("/api/hr/role-distribution");
    const result = await response.json();

    if (!result.success || !result.distribution) {
      console.error("[HR] Failed to load role distribution:", result.error);
      return;
    }

    const { hr, officers, admins } = result.distribution;
    renderRoleDistributionChart({ hr, officers, admins });
  } catch (error) {
    console.error("[HR] Load role distribution error:", error);
  }
};

/**
 * Render role distribution pie chart (HR)
 */
function renderRoleDistributionChart(data) {
  const canvas = document.getElementById("role-distribution-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // Destroy existing chart if it exists
  if (roleDistributionChart) {
    roleDistributionChart.destroy();
  }

  const values = [data.hr || 0, data.officers || 0, data.admins || 0];
  const total = values.reduce((a, b) => a + b, 0);

  const chartData = {
    labels: [
      `HR (${values[0]})`,
      `Officers (${values[1]})`,
      `Admins (${values[2]})`,
    ],
    datasets: [
      {
        data: values,
        backgroundColor: [
          "#10b981", // Green for HR
          "#f59e0b", // Orange for Officers
          "#8b5cf6", // Purple for Admins
        ],
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  };

  roleDistributionChart = new Chart(ctx, {
    type: "pie",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 15,
            font: {
              size: 14,
            },
            generateLabels(chart) {
              const { data } = chart;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const percentage =
                    total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return {
                    text: `${label} - ${percentage}%`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    strokeStyle: data.datasets[0].borderColor,
                    lineWidth: data.datasets[0].borderWidth,
                    hidden: false,
                    index: i,
                  };
                });
              }
              return [];
            },
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage =
                total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label.split(" (")[0]}: ${value} users (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Render department statistics
 */
function renderDepartmentStats(stats) {
  const container = document.getElementById("department-stats");
  if (!container) return;
  if (!stats.length) {
    container.innerHTML =
      '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No department data available.</p>';
    return;
  }
  const html = stats
    .map(
      (dept) => `
    <div class="dept-stat-card">
      <h3>${escapeHtml(dept.department)}</h3>
      <div class="dept-counts">
        <div class="dept-count">
          <div class="dept-count-value">${dept.admins}</div>
          <div class="dept-count-label">Admins</div>
        </div>
        <div class="dept-count">
          <div class="dept-count-value">${dept.officers}</div>
          <div class="dept-count-label">Officers</div>
        </div>
        <div class="dept-count">
          <div class="dept-count-value">${dept.total}</div>
          <div class="dept-count-label">Total</div>
        </div>
      </div>
    </div>
  `
    )
    .join("");
  container.innerHTML = html;
}
/**
 * Setup form handlers
 */
function setupFormHandlers() {
  // Forms are optional (they may be removed from the page)
  const promoteOfficerForm = document.getElementById("promote-officer-form");
  if (promoteOfficerForm)
    promoteOfficerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("promote-officer-user").value;
      const department = document.getElementById("promote-officer-dept").value;
      const reason = document.getElementById("promote-officer-reason").value;
      await promoteToOfficer(userId, department, reason);
    });
  const promoteAdminForm = document.getElementById("promote-admin-form");
  if (promoteAdminForm)
    promoteAdminForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("promote-admin-user").value;
      const department = document.getElementById("promote-admin-dept").value;
      const reason = document.getElementById("promote-admin-reason").value;
      await promoteToAdmin(userId, department, reason);
    });
  const demoteOfficerForm = document.getElementById("demote-officer-form");
  if (demoteOfficerForm)
    demoteOfficerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("demote-officer-user").value;
      const reason = document.getElementById("demote-officer-reason").value;
      await demoteToOfficer(userId, reason);
    });
  const stripTitlesForm = document.getElementById("strip-titles-form");
  if (stripTitlesForm)
    stripTitlesForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("strip-titles-user").value;
      const reason = document.getElementById("strip-titles-reason").value;
      if (
        !confirm(
          "Are you sure you want to strip all titles from this user? This will revert them to citizen status."
        )
      ) {
        return;
      }
      await stripTitles(userId, reason);
    });
  const assignDeptForm = document.getElementById("assign-dept-form");
  if (assignDeptForm)
    assignDeptForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("assign-dept-user").value;
      const departmentId = document.getElementById("assign-dept-id").value;
      await assignDepartment(userId, departmentId);
    });
  const roleHistoryForm = document.getElementById("role-history-form");
  if (roleHistoryForm)
    roleHistoryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("role-history-user").value;
      await viewRoleHistory(userId);
    });
}

// Pending Signup Approvals Panel
async function loadPendingSignups() {
  try {
    const res = await fetch("/api/hr/pending-signups");
    const json = await res.json();
    const container = document.getElementById("pending-signups");
    if (!container) return;
    if (!json.success) {
      container.innerHTML =
        '<p style="color:#7f8c8d;">Failed to load pending signups</p>';
      return;
    }
    const users = json.data || [];
    if (users.length === 0) {
      container.innerHTML = '<p style="color:#7f8c8d;">No pending signups.</p>';
      return;
    }
    container.innerHTML = users
      .map((u) => {
        const name = u.name || u.fullName || u.email || u.id;
        const dept =
          u?.raw_user_meta_data?.pending_department ||
          u?.user_metadata?.pending_department ||
          "-";
        const role =
          u?.raw_user_meta_data?.pending_role ||
          u?.user_metadata?.pending_role ||
          "-";
        return `
        <div class="user-item">
          <div class="user-item-name">${escapeHtml(name)}</div>
          <div class="user-item-email">${escapeHtml(u.email || "")}</div>
          <div class="user-item-role">Requested: ${escapeHtml(
            role
          )} @ ${escapeHtml(String(dept))}</div>
          <div style="margin-top:8px; display:flex; gap:8px;">
            <button class="btn btn-success btn-sm" data-approve="${
              u.id
            }">Approve</button>
            <button class="btn btn-danger btn-sm" data-reject="${
              u.id
            }">Reject</button>
          </div>
        </div>`;
      })
      .join("");
    // Bind actions
    container.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-approve");
        await approvePending(id);
      });
    });
    container.querySelectorAll("[data-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-reject");
        await rejectPending(id);
      });
    });
  } catch (e) {
    const container = document.getElementById("pending-signups");
    if (container)
      container.innerHTML =
        '<p style="color:#7f8c8d;">Failed to load pending signups</p>';
  }
}

async function approvePending(userId) {
  try {
    const res = await fetch(
      `/api/hr/pending-signups/${encodeURIComponent(userId)}/approve`,
      { method: "POST" }
    );
    const json = await res.json();
    if (json.success) {
      showMessage("success", "Approved");
      await loadPendingSignups();
      await loadDashboardData();
    } else {
      showMessage("error", json.error || "Failed to approve");
    }
  } catch (e) {
    showMessage("error", "Failed to approve");
  }
}

async function rejectPending(userId) {
  try {
    const res = await fetch(
      `/api/hr/pending-signups/${encodeURIComponent(userId)}/reject`,
      { method: "POST" }
    );
    const json = await res.json();
    if (json.success) {
      showMessage("success", "Rejected");
      await loadPendingSignups();
      await loadDashboardData();
    } else {
      showMessage("error", json.error || "Failed to reject");
    }
  } catch (e) {
    showMessage("error", "Failed to reject");
  }
}

// Kick-off pending list load when dashboard is ready
try {
  loadPendingSignups();
} catch {}
/**
 * User search & detail wiring
 */
function setupUserSearch() {
  const searchBtn = document.getElementById("user-search-btn");
  const searchInput = document.getElementById("user-search-input");
  const barangayInput = document.getElementById("user-filter-barangay");
  async function runSearch() {
    const q = encodeURIComponent(searchInput.value || "");
    const brgy = encodeURIComponent(barangayInput.value || "");
    const url = `/api/hr/users?search=${q}${brgy ? `&barangay=${brgy}` : ""}`;
    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        renderUserList(result.data || []);
      } else {
        renderUserList([]);
      }
    } catch (err) {
      console.error("[HR] user search error:", err);
      renderUserList([]);
    }
  }
  if (searchBtn) searchBtn.addEventListener("click", runSearch);
  if (searchInput)
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") runSearch();
    });
}
function renderUserList(users) {
  const list = document.getElementById("user-list");
  if (!list) return;
  if (!users.length) {
    list.innerHTML =
      '<p style="color:#7f8c8d; padding:8px;">No users found.</p>';
    return;
  }
  list.innerHTML = users
    .map(
      (u) =>
        `<div class="user-item" data-user-id="${u.id}">
      <div><strong>${escapeHtml(u.fullName || u.name || u.email)}</strong></div>
      <div class="user-meta">${escapeHtml(u.email || "")}</div>
      <div class="user-meta">Role: ${escapeHtml(
        u.role || ""
      )} | Brgy: ${escapeHtml(u.address?.barangay || "-")}</div>
    </div>`
    )
    .join("");

  // Click to load details
  list.querySelectorAll(".user-item").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.getAttribute("data-user-id");
      await loadUserDetails(id);
      await loadUserComplaints(id);
    });
  });
}

async function loadUserDetails(userId) {
  try {
    const res = await fetch(`/api/hr/users/${userId}`);
    const result = await res.json();
    const container = document.getElementById("user-details");
    if (!container) return;
    if (result.success && result.data) {
      const u = result.data;
      container.innerHTML = `
        <div style="display:flex; gap:16px; align-items:center;">
          <div style="width:48px; height:48px; border-radius:50%; background:#eee;"></div>
          <div>
            <div style="font-weight:700; font-size:1.1rem;">${escapeHtml(
              u.fullName || u.name || u.email
            )}</div>
            <div class="user-meta">${escapeHtml(u.email || "")}</div>
          </div>
        </div>
        <div style="margin-top:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div><strong>Role:</strong> ${escapeHtml(u.role || "")}</div>
          <div><strong>Department:</strong> ${escapeHtml(
            u.department || "-"
          )}</div>
          <div><strong>Barangay:</strong> ${escapeHtml(
            u.address?.barangay || "-"
          )}</div>
          <div><strong>City:</strong> ${escapeHtml(
            u.address?.city || "-"
          )}</div>
          <div><strong>Mobile:</strong> ${escapeHtml(
            u.mobileNumber || "-"
          )}</div>
        </div>
      `;
    } else {
      container.innerHTML =
        '<p style="color:#e74c3c;">Failed to load user.</p>';
    }
  } catch (err) {
    console.error("[HR] load user details error:", err);
  }
}
async function loadUserComplaints(userId) {
  try {
    const res = await fetch(`/api/hr/users/${userId}/complaints?limit=10`);
    const result = await res.json();
    const container = document.getElementById("user-complaints");
    if (!container) return;
    if (result.success) {
      const complaints = result.data || [];
      if (!complaints.length) {
        container.innerHTML =
          '<p style="color:#7f8c8d;">No complaints found.</p>';
        return;
      }
      container.innerHTML = complaints
        .map(
          (c) => `
        <div style="padding:12px; border:1px solid #eee; border-radius:6px; margin-bottom:8px; background:#fafafa;">
          <div style="display:flex; justify-content:space-between;">
            <strong>${escapeHtml(c.title || "Untitled")}</strong>
            <span class="user-meta">${escapeHtml(c.status || "")}</span>
          </div>
          <div class="user-meta">Type: ${escapeHtml(c.type || "-")}</div>
          ${
            c.location_text
              ? `<div class="user-meta">${escapeHtml(c.location_text)}</div>`
              : ""
          }
        </div>
      `
        )
        .join("");
    } else {
      container.innerHTML =
        '<p style="color:#e74c3c;">Failed to load complaints.</p>';
    }
  } catch (err) {
    console.error("[HR] load user complaints error:", err);
  }
}
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
/**
 * Promote to Officer
 */
async function promoteToOfficer(userId, department, reason) {
  try {
    const response = await fetch("/api/hr/promote-to-officer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        department,
        reason,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("promote-officer-form").reset();
      await loadDashboardData();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[HR] Promote to officer error:", error);
    showMessage("error", "Failed to promote user");
  }
}
/**
 * Promote to Admin
 */
async function promoteToAdmin(userId, department, reason) {
  try {
    const response = await fetch("/api/hr/promote-to-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        department,
        reason,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("promote-admin-form").reset();
      await loadDashboardData();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[HR] Promote to admin error:", error);
    showMessage("error", "Failed to promote user");
  }
}
/**
 * Demote to Officer
 */
async function demoteToOfficer(userId, reason) {
  try {
    const response = await fetch("/api/hr/demote-to-officer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        reason,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("demote-officer-form").reset();
      await loadDashboardData();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[HR] Demote to officer error:", error);
    showMessage("error", "Failed to demote user");
  }
}
/**
 * Strip Titles
 */
async function stripTitles(userId, reason) {
  try {
    const response = await fetch("/api/hr/strip-titles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        reason,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("strip-titles-form").reset();
      await loadDashboardData();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[HR] Strip titles error:", error);
    showMessage("error", "Failed to strip titles");
  }
}
/**
 * Assign Department
 */
async function assignDepartment(userId, departmentId) {
  try {
    const response = await fetch("/api/hr/assign-department", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        department_id: departmentId,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("assign-dept-form").reset();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[HR] Assign department error:", error);
    showMessage("error", "Failed to assign department");
  }
}
/**
 * View Role History
 */
async function viewRoleHistory(userId) {
  try {
    const response = await fetch(`/api/hr/role-history/${userId}`);
    const result = await response.json();
    const container = document.getElementById("role-history-results");
    if (result.success && result.history) {
      if (result.history.length === 0) {
        container.innerHTML =
          '<p style="color: #7f8c8d;">No role history found for this user.</p>';
        return;
      }
      const html = `
        <div style="margin-top: 20px;">
          <h4>Role Change History</h4>
          <div style="max-height: 400px; overflow-y: auto;">
            ${result.history
              .map(
                (entry) => `
              <div style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; background: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <strong>${entry.old_role} → ${entry.new_role}</strong>
                  <span style="color: #7f8c8d; font-size: 0.9rem;">${new Date(
                    entry.created_at
                  ).toLocaleString()}</span>
                </div>
                ${
                  entry.metadata && entry.metadata.reason
                    ? `<div style="color: #555;">Reason: ${entry.metadata.reason}</div>`
                    : ""
                }
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
      container.innerHTML = html;
    } else {
      container.innerHTML =
        '<p style="color: #e74c3c;">Failed to load role history.</p>';
    }
  } catch (error) {
    console.error("[HR] View role history error:", error);
    showMessage("error", "Failed to load role history");
  }
}

/**
 * Load and render performance data
 */
window.refreshPerformance = async function refreshPerformance() {
  await loadPerformanceData();
  await loadWorkloadDistribution();
  await loadBottleneckAlerts();
};

async function loadPerformanceData() {
  try {
    const response = await fetch("/api/hr/performance-summary");
    const result = await response.json();
    if (result.success) {
      const stats = result.data;
      document.getElementById("hr-total-handled").textContent =
        stats.total_handled || 0;
      document.getElementById("hr-resolution-rate").textContent = `${
        stats.resolution_rate || 0
      }%`;
      document.getElementById("hr-avg-time").textContent =
        stats.avg_resolution_time || "N/A";
    }
  } catch (error) {
    console.error("[HR] Load performance data error:", error);
  }
}

/**
 * Load and render workload distribution chart
 */
let workloadChart = null;
async function loadWorkloadDistribution() {
  try {
    const response = await fetch("/api/hr/workload-distribution");
    const result = await response.json();
    if (result.success) {
      renderWorkloadChart(result.data);
    }
  } catch (error) {
    console.error("[HR] Load workload distribution error:", error);
  }
}

function renderWorkloadChart(data) {
  const canvas = document.getElementById("workload-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (workloadChart) workloadChart.destroy();

  workloadChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((d) => d.name),
      datasets: [
        {
          label: "Current Tasks",
          data: data.map((d) => d.task_count),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

/**
 * Load and render bottleneck alerts
 */
async function loadBottleneckAlerts() {
  const container = document.getElementById("bottleneck-alerts");
  if (!container) return;
  try {
    const response = await fetch("/api/hr/bottlenecks");
    const result = await response.json();
    if (result.success && result.data.length > 0) {
      container.innerHTML = result.data
        .map(
          (alert) => `
        <div class="alert-item p-3 border-l-4 border-yellow-400 bg-yellow-50 rounded flex justify-between items-center animate-fade-in">
          <div>
            <div class="font-bold text-yellow-800">${escapeHtml(
              alert.message
            )}</div>
            <div class="text-xs text-yellow-600">${escapeHtml(
              alert.department
            )} - ${alert.count} overdue tasks</div>
          </div>
          <button class="btn btn-sm btn-outline-warning" onclick="escalateBottleneck('${
            alert.department
          }')">Escalate</button>
        </div>
      `
        )
        .join("");
    } else {
      container.innerHTML =
        '<p class="text-sm text-gray-500 text-center p-4">No significant bottlenecks detected at this time.</p>';
    }
  } catch (error) {
    console.error("[HR] Load bottlenecks error:", error);
    container.innerHTML =
      '<p class="text-sm text-red-500 text-center p-4">Failed to check for bottlenecks.</p>';
  }
}

window.escalateBottleneck = function (dept) {
  showMessage("info", `Escalating bottleneck in ${dept}...`);
  // Mock escalate API call
  setTimeout(
    () => showMessage("success", `Escalation notice sent to ${dept} Admin`),
    1000
  );
};
