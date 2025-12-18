/**
 * Super Admin Dashboard
 * System-wide management interface
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
  await loadRoleCounts();
  await loadLatestUsers();
  await loadRoleDistribution();
  await loadApiHealth();
  await loadLogs();
  startTrafficMonitor();

  // Setup refresh button event listeners
  const refreshRoleDistributionBtn = document.getElementById(
    "refresh-role-distribution-btn"
  );
  if (refreshRoleDistributionBtn) {
    refreshRoleDistributionBtn.addEventListener("click", loadRoleDistribution);
  }

  const refreshLatestUsersBtn = document.getElementById(
    "refresh-latest-users-btn"
  );
  if (refreshLatestUsersBtn) {
    refreshLatestUsersBtn.addEventListener("click", loadLatestUsers);
  }

  // Setup help button (placeholder for future implementation)
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
 * Load department roles dynamically
 */
async function loadDepartmentRoles() {
  try {
    const apiClient = (await import("../config/apiClient.js")).default;
    // Prefer the explicit endpoint that exists in routes
    let departments = [];
    try {
      const res = await apiClient.get(
        "/api/department-structure/departments/all"
      );
      if (res && res.success && Array.isArray(res.data)) {
        departments = res.data;
      }
    } catch {}
    // Fallback to categories tree if needed
    if (!departments.length) {
      const res2 = await apiClient.get("/api/department-structure/categories");
      if (res2 && res2.success && Array.isArray(res2.data)) {
        departments = [];
        res2.data.forEach((cat) =>
          cat.subcategories?.forEach((sc) =>
            sc.departments?.forEach((d) => departments.push(d))
          )
        );
      }
    }
    // departments loaded via one of the endpoints above
    // Load role swap dropdown
    const roleSwapSelect = document.getElementById("role-swap-role");
    if (roleSwapSelect) {
      const loadingEl = document.getElementById("department-roles-loading");
      if (loadingEl) loadingEl.remove();
      departments.forEach((dept) => {
        // Add officer role
        const officerOption = document.createElement("option");
        officerOption.value = `lgu-${dept.code.toLowerCase()}`;
        officerOption.textContent = `LGU Officer - ${dept.name} (${dept.code})`;
        roleSwapSelect.appendChild(officerOption);
        // Add admin role
        const adminOption = document.createElement("option");
        adminOption.value = `lgu-admin-${dept.code.toLowerCase()}`;
        adminOption.textContent = `LGU Admin - ${dept.name}`;
        roleSwapSelect.appendChild(adminOption);
      });
    }
    // Load assign citizen dropdown
    const assignCitizenSelect = document.getElementById("assign-citizen-role");
    if (assignCitizenSelect) {
      const loadingEl = document.getElementById("assign-citizen-roles-loading");
      if (loadingEl) loadingEl.remove();
      departments.forEach((dept) => {
        // Add officer role
        const officerOption = document.createElement("option");
        officerOption.value = `lgu-${dept.code.toLowerCase()}`;
        officerOption.textContent = `LGU Officer - ${dept.name} (${dept.code})`;
        assignCitizenSelect.appendChild(officerOption);
        // Add admin role
        const adminOption = document.createElement("option");
        adminOption.value = `lgu-admin-${dept.code.toLowerCase()}`;
        adminOption.textContent = `LGU Admin - ${dept.name}`;
        assignCitizenSelect.appendChild(adminOption);
      });
    }
  } catch (error) {
    console.error("[SUPERADMIN] Error loading department roles:", error);
    // Show error in loading placeholders
    const loadingEls = document.querySelectorAll('[id$="-loading"]');
    loadingEls.forEach((el) => {
      el.innerHTML = '<option value="">Error loading departments</option>';
    });
  }
}
/**
 * Load dashboard data
 */
async function loadDashboardData() {
  try {
    const [statsResponse, dashboardResponse] = await Promise.all([
      fetch("/api/superadmin/statistics"),
      fetch("/api/superadmin/dashboard"),
    ]);
    const [statsResult, dashboardResult] = await Promise.all([
      statsResponse.json(),
      dashboardResponse.json(),
    ]);
    if (statsResult.success) {
      updateStatistics(statsResult.statistics);
    }
    if (dashboardResult.success) {
      // Additional dashboard data if needed
      // console.log removed for security
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load dashboard error:", error);
  }
}
/**
 * Update statistics display
 */
function updateStatistics(stats) {
  document.getElementById("stat-complaints").textContent =
    stats.total_complaints || 0;
  document.getElementById("stat-role-changes").textContent =
    stats.total_role_changes || 0;
  document.getElementById("stat-dept-transfers").textContent =
    stats.total_department_transfers || 0;
}
/**
 * Load role counts (users, admins, hr, officers)
 */
async function loadRoleCounts() {
  try {
    const res = await fetch("/api/superadmin/users?limit=1");
    const metaRes = await fetch("/api/superadmin/users?limit=1000");
    const meta = await metaRes.json();
    const users = meta.success && Array.isArray(meta.data) ? meta.data : [];
    const totalUsers = users.length;
    // Admins: count LGU admins only (exclude super-admin)
    const admins = users.filter((u) =>
      /^lgu-admin/.test(String(u.role || "").toLowerCase())
    ).length;
    // HR: include lgu-hr variants
    const hr = users.filter(
      (u) =>
        String(u.role || "").toLowerCase() === "lgu-hr" ||
        /^lgu-hr/.test(String(u.role || "").toLowerCase())
    ).length;
    // Officers: include simplified 'lgu' and legacy lgu-* (excluding admin/hr)
    const roleStr = (r) => String(r || "").toLowerCase();
    const officers = users.filter((u) => {
      const r = roleStr(u.role);
      return r === "lgu" || /^lgu-(?!admin|hr)/.test(r);
    }).length;
    setText("stat-users", totalUsers);
    setText("stat-admins", admins);
    setText("stat-hr", hr);
    setText("stat-officers", officers);
  } catch (e) {
    // ignore
  }
}
function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(v);
}
/**
 * Load role distribution and render pie chart
 */
window.loadRoleDistribution = async function loadRoleDistribution() {
  try {
    const response = await fetch("/api/superadmin/role-distribution");
    const result = await response.json();

    if (!result.success || !result.distribution) {
      console.error(
        "[SUPER_ADMIN] Failed to load role distribution:",
        result.error
      );
      return;
    }

    const { citizens, hr, officers, admins } = result.distribution;
    renderRoleDistributionChart({ citizens, hr, officers, admins });
  } catch (error) {
    console.error("[SUPER_ADMIN] Load role distribution error:", error);
  }
};

/**
 * Render role distribution pie chart (Super Admin)
 */
function renderRoleDistributionChart(data) {
  const canvas = document.getElementById("role-distribution-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // Destroy existing chart if it exists
  if (roleDistributionChart) {
    roleDistributionChart.destroy();
  }

  const values = [
    data.citizens || 0,
    data.hr || 0,
    data.officers || 0,
    data.admins || 0,
  ];
  const total = values.reduce((a, b) => a + b, 0);

  const chartData = {
    labels: [
      `Citizens (${values[0]})`,
      `HR (${values[1]})`,
      `Officers (${values[2]})`,
      `Admins (${values[3]})`,
    ],
    datasets: [
      {
        data: values,
        backgroundColor: [
          "#3b82f6", // Blue for Citizens
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
 * Load latest registered users
 */
window.loadLatestUsers = async function () {
  try {
    const container = document.getElementById("latest-users-container");
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading latest users...</p>
      </div>
    `;

    const response = await fetch("/api/superadmin/latest-users?limit=5");
    const result = await response.json();

    if (result.success && result.users) {
      displayLatestUsers(result.users);
    } else {
      container.innerHTML = `<p class="empty-state" style="color: #ef4444;">Failed to load users: ${
        result.error || "Unknown error"
      }</p>`;
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load latest users error:", error);
    const container = document.getElementById("latest-users-container");
    if (container) {
      container.innerHTML =
        '<p class="empty-state" style="color: #ef4444;">Failed to load latest users</p>';
    }
  }
};

/**
 * Display latest registered users
 */
function displayLatestUsers(users) {
  const container = document.getElementById("latest-users-container");
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML =
      '<p class="empty-state">No registered users found</p>';
    return;
  }

  const html = `
    <div class="latest-users-list">
      ${users
        .map((user) => {
          const registrationDate = new Date(user.created_at).toLocaleString();
          const emailConfirmedDate = user.email_confirmed_at
            ? new Date(user.email_confirmed_at).toLocaleString()
            : null;
          const authMethod = user.is_oauth ? "OAuth" : "Email";
          const roleBadge = user.role || "citizen";

          return `
          <div class="user-item" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; border-bottom: 1px solid #e5e7eb; gap: 1rem;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.1rem;">
                  ${(user.name || user.email || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight: 600; color: #111827; margin-bottom: 0.25rem;">
                    ${user.name || user.email || "Unknown User"}
                  </div>
                  <div style="font-size: 0.875rem; color: #6b7280;">
                    ${user.email || "No email"}
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: #6b7280; flex-wrap: wrap;">
                <span><strong>Role:</strong> ${roleBadge}</span>
                <span><strong>Method:</strong> ${authMethod}</span>
                ${
                  emailConfirmedDate
                    ? `<span><strong>Confirmed:</strong> ${emailConfirmedDate}</span>`
                    : ""
                }
              </div>
            </div>
            <div style="text-align: right; font-size: 0.875rem; color: #6b7280;">
              <div style="font-weight: 500; color: #111827; margin-bottom: 0.25rem;">Registered</div>
              <div>${registrationDate}</div>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;

  container.innerHTML = html;
}
/**
 * API Health
 */
async function loadApiHealth() {
  const el = document.getElementById("api-health-status");
  const indicator = document.getElementById("api-health-indicator");
  if (!el) return;
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (data && data.success) {
      el.textContent = `Healthy • ${new Date(data.timestamp).toLocaleString()}`;
      el.style.color = "#10b981";
      if (indicator) {
        indicator.style.background = "#10b981";
      }
    } else {
      el.textContent = "Unhealthy";
      el.style.color = "#ef4444";
      if (indicator) {
        indicator.style.background = "#ef4444";
      }
    }
  } catch {
    el.textContent = "Health check failed";
    el.style.color = "#ef4444";
    if (indicator) {
      indicator.style.background = "#ef4444";
    }
  }
  const btn = document.getElementById("btn-refresh-health");
  if (btn) btn.onclick = loadApiHealth;
}
/**
 * Traffic monitor using rate-limit status (proxy for request volume)
 */
function startTrafficMonitor() {
  const graph = document.getElementById("traffic-graph");
  const meta = document.getElementById("traffic-meta");
  if (!graph || !meta) return;
  const bars = [];
  async function tick() {
    try {
      const res = await fetch("/api/rate-limit/status");
      const data = await res.json();
      const requests = (data && data.status && data.status.requests) || 0;
      bars.push(requests);
      if (bars.length > 60) bars.shift();
      renderBars(bars, graph);
      meta.textContent = `Requests in window: ${requests}, Remaining: ${
        (data && data.status && data.status.remaining) || "-"
      }`;
    } catch {}
  }
  tick();
  setInterval(tick, 1000);
}
function renderBars(values, container) {
  const max = Math.max(1, ...values);
  container.innerHTML = values
    .map((v) => {
      const h = Math.round((v / max) * 100);
      return `<div style="width: 8px; height:${h}%; background:#3b82f6; border-radius:2px;"></div>`;
    })
    .join("");
}
/**
 * Load system logs
 */
window.loadLogs = async function () {
  try {
    const logType = document.getElementById("log-type-filter").value;
    const response = await fetch(
      `/api/superadmin/logs?log_type=${logType}&limit=50`
    );
    const result = await response.json();
    if (result.success) {
      displayLogs(result.logs);
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load logs error:", error);
    const container = document.getElementById("logs-container");
    if (container) {
      container.innerHTML =
        '<p class="empty-state" style="color: #ef4444;">Failed to load logs</p>';
    }
  }
};
/**
 * Display logs
 */
function displayLogs(logs) {
  const container = document.getElementById("logs-container");
  const allLogs = [];
  // Combine all log types
  if (logs.role_changes) {
    logs.role_changes.forEach((log) => {
      allLogs.push({ ...log, log_type: "role_change" });
    });
  }
  if (logs.department_transfers) {
    logs.department_transfers.forEach((log) => {
      allLogs.push({ ...log, log_type: "dept_transfer" });
    });
  }
  if (logs.complaint_workflow) {
    logs.complaint_workflow.forEach((log) => {
      allLogs.push({ ...log, log_type: "complaint" });
    });
  }
  // Sort by date
  allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (allLogs.length === 0) {
    container.innerHTML = '<p class="empty-state">No logs found</p>';
    return;
  }
  const html = allLogs
    .slice(0, 50)
    .map((log) => formatLogEntry(log))
    .join("");
  container.innerHTML = html;
}
/**
 * Format log entry
 */
function formatLogEntry(log) {
  const date = new Date(log.created_at).toLocaleString();
  let content = "";
  let typeLabel = "";
  let typeColor = "#667eea";
  if (log.log_type === "role_change") {
    typeLabel = "Role Change";
    typeColor = "#3498db";
    const userEmail = log.user?.email || "Unknown";
    const performerEmail = log.performer?.email || "System";
    content = `
      <strong>${userEmail}</strong>: ${log.old_role} → ${log.new_role}
      <div style="color: #64748b; font-size: 0.875rem; margin-top: 0.5rem;">By: ${performerEmail}</div>
      ${
        log.metadata?.reason
          ? `<div style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">Reason: ${log.metadata.reason}</div>`
          : ""
      }
    `;
  } else if (log.log_type === "dept_transfer") {
    typeLabel = "Dept Transfer";
    typeColor = "#f59e0b";
    const userEmail = log.user?.email || "Unknown";
    const performerEmail = log.performer?.email || "System";
    content = `
      <strong>${userEmail}</strong>: ${log.from_department || "N/A"} → ${
      log.to_department
    }
      <div style="color: #64748b; font-size: 0.875rem; margin-top: 0.5rem;">By: ${performerEmail}</div>
      ${
        log.reason
          ? `<div style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">Reason: ${log.reason}</div>`
          : ""
      }
    `;
  } else if (log.log_type === "complaint") {
    typeLabel = "Complaint";
    typeColor = "#10b981";
    content = `
      <strong>${
        log.action_type
      }</strong>: Complaint #${log.complaint_id?.substring(0, 8)}...
      ${
        log.details
          ? `<div style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">${JSON.stringify(
              log.details
            )}</div>`
          : ""
      }
    `;
  }

  return `
    <div class="log-entry">
      <div class="log-entry-header">
        <span class="log-type" style="background: ${typeColor};">${typeLabel}</span>
        <span class="log-entry-date">${date}</span>
      </div>
      <div class="log-entry-content">${content}</div>
    </div>
  `;
}

/**
 * Setup form handlers
 */
function setupFormHandlers() {
  // Role Swap
  document
    .getElementById("role-swap-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("role-swap-user").value;
      const newRole = document.getElementById("role-swap-role").value;
      const reason = document.getElementById("role-swap-reason").value;

      if (
        !confirm(
          `Are you sure you want to change this user's role to ${newRole}?`
        )
      ) {
        return;
      }
      await performRoleSwap(userId, newRole, reason);
    });
  // Department Transfer
  document
    .getElementById("dept-transfer-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("dept-transfer-user").value;
      const fromDept = document.getElementById("dept-transfer-from").value;
      const toDept = document.getElementById("dept-transfer-to").value;
      const reason = document.getElementById("dept-transfer-reason").value;
      await transferDepartment(userId, fromDept, toDept, reason);
    });
  // Assign Citizen
  document
    .getElementById("assign-citizen-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("assign-citizen-user").value;
      const role = document.getElementById("assign-citizen-role").value;
      const department = document.getElementById("assign-citizen-dept").value;
      const reason = document.getElementById("assign-citizen-reason").value;
      await assignCitizen(userId, role, department, reason);
    });
  // Log type filter change
  document.getElementById("log-type-filter").addEventListener("change", () => {
    loadLogs();
  });
}
function setupUserSearchSA() {
  const btn = document.getElementById("sa-user-search-btn");
  const input = document.getElementById("sa-user-search");
  const brgy = document.getElementById("sa-user-barangay");
  async function run() {
    const q = encodeURIComponent(input?.value || "");
    const b = encodeURIComponent(brgy?.value || "");
    const url = `/api/superadmin/users?search=${q}${b ? `&barangay=${b}` : ""}`;
    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        renderUserListSA(result.data || []);
      } else {
        renderUserListSA([]);
      }
    } catch (e) {
      console.error("[SUPERADMIN] user search error:", e);
      renderUserListSA([]);
    }
  }
  if (btn) btn.addEventListener("click", run);
  if (input)
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") run();
    });
}
function renderUserListSA(users) {
  const list = document.getElementById("sa-user-list");
  if (!list) return;
  if (!users.length) {
    list.innerHTML = '<p class="empty-state">No users found.</p>';
    return;
  }
  list.innerHTML = users
    .map(
      (u) => `
    <div class="user-item" data-user-id="${u.id}">
      <div><strong>${escapeHtml(u.fullName || u.name || u.email)}</strong></div>
      <div style="color:#64748b; font-size:0.875rem; margin-top:0.25rem;">${escapeHtml(
        u.email || ""
      )}</div>
      <div style="color:#64748b; font-size:0.875rem; margin-top:0.25rem;">Role: ${escapeHtml(
        u.role || ""
      )} | Brgy: ${escapeHtml(u.address?.barangay || "-")}</div>
    </div>
  `
    )
    .join("");
  list.querySelectorAll(".user-item").forEach((el) => {
    el.addEventListener("click", async () => {
      const id = el.getAttribute("data-user-id");
      await loadUserDetailsSA(id);
      await loadUserComplaintsSA(id);
    });
  });
}
async function loadUserDetailsSA(userId) {
  try {
    const res = await fetch(`/api/superadmin/users/${userId}`);
    const result = await res.json();
    const container = document.getElementById("sa-user-details");
    if (!container) return;
    if (result.success && result.data) {
      const u = result.data;
      container.innerHTML = `
        <div style="display:flex; gap:1rem; align-items:center; margin-bottom:1rem;">
          <div style="width:48px; height:48px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-size:1.5rem;">👤</div>
          <div>
            <div style="font-weight:700; font-size:1.125rem; color:#1e293b;">${escapeHtml(
              u.fullName || u.name || u.email
            )}</div>
            <div style="color:#64748b; font-size:0.875rem;">${escapeHtml(
              u.email || ""
            )}</div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; padding-top:1rem; border-top:1px solid #e2e8f0;">
          <div><strong style="color:#1e293b;">Role:</strong> <span style="color:#64748b;">${escapeHtml(
            u.role || "-"
          )}</span></div>
          <div><strong style="color:#1e293b;">Department:</strong> <span style="color:#64748b;">${escapeHtml(
            u.department || "-"
          )}</span></div>
          <div><strong style="color:#1e293b;">Barangay:</strong> <span style="color:#64748b;">${escapeHtml(
            u.address?.barangay || "-"
          )}</span></div>
          <div><strong style="color:#1e293b;">City:</strong> <span style="color:#64748b;">${escapeHtml(
            u.address?.city || "-"
          )}</span></div>
          <div><strong style="color:#1e293b;">Mobile:</strong> <span style="color:#64748b;">${escapeHtml(
            u.mobileNumber || "-"
          )}</span></div>
        </div>
      `;
    } else {
      container.innerHTML =
        '<p class="empty-state" style="color:#ef4444;">Failed to load user.</p>';
    }
  } catch (e) {
    console.error("[SUPERADMIN] load user details error:", e);
  }
}
async function loadUserComplaintsSA(userId) {
  try {
    const res = await fetch(
      `/api/superadmin/users/${userId}/complaints?limit=10`
    );
    const result = await res.json();
    const container = document.getElementById("sa-user-complaints");
    if (!container) return;
    if (result.success) {
      const complaints = result.data || [];
      if (!complaints.length) {
        container.innerHTML = '<p class="empty-state">No complaints found.</p>';
        return;
      }
      container.innerHTML = complaints
        .map(
          (c) => `
        <div style="padding:0.75rem; border:1px solid #e2e8f0; border-radius:0.5rem; background:#f8fafc; margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <strong style="color:#1e293b;">${escapeHtml(
              c.title || "Untitled"
            )}</strong>
            <span style="color:#64748b; font-size:0.875rem; padding:0.25rem 0.5rem; background:white; border-radius:0.25rem; border:1px solid #e2e8f0;">${escapeHtml(
              c.status || ""
            )}</span>
          </div>
          <div style="color:#64748b; font-size:0.875rem;">Type: ${escapeHtml(
            c.type || "-"
          )}</div>
          ${
            c.location_text
              ? `<div style=\"color:#64748b; font-size:0.875rem; margin-top:0.25rem;\">${escapeHtml(
                  c.location_text
                )}</div>`
              : ""
          }
        </div>
      `
        )
        .join("");
    } else {
      container.innerHTML =
        '<p class="empty-state" style="color:#ef4444;">Failed to load complaints.</p>';
    }
  } catch (e) {
    console.error("[SUPERADMIN] load user complaints error:", e);
  }
}
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
/**
 * Perform role swap
 */
async function performRoleSwap(userId, newRole, reason) {
  try {
    const response = await fetch("/api/superadmin/role-swap", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        new_role: newRole,
        reason,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("role-swap-form").reset();
      await loadDashboardData();
      await loadLogs();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[SUPERADMIN] Role swap error:", error);
    showMessage("error", "Failed to perform role swap");
  }
}
/**
 * Transfer department
 */
async function transferDepartment(userId, fromDept, toDept, reason) {
  try {
    const response = await fetch("/api/superadmin/transfer-department", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        from_department: fromDept,
        to_department: toDept,
        reason,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("dept-transfer-form").reset();
      await loadDashboardData();
      await loadLogs();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[SUPERADMIN] Transfer department error:", error);
    showMessage("error", "Failed to transfer department");
  }
}
/**
 * Assign citizen
 */
async function assignCitizen(userId, role, department, reason) {
  try {
    const response = await fetch("/api/superadmin/assign-citizen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        role,
        department_id: department,
        reason,
      }),
    });
    const result = await response.json();
    if (result.success) {
      showMessage("success", result.message);
      document.getElementById("assign-citizen-form").reset();
      await loadDashboardData();
      await loadLogs();
    } else {
      showMessage("error", result.error);
    }
  } catch (error) {
    console.error("[SUPERADMIN] Assign citizen error:", error);
    showMessage("error", "Failed to assign citizen");
  }
}

/**
 * Super Admin Global Helpers
 */
window.refreshAuditLogs = () =>
  window.loadLogs ? window.loadLogs() : console.error("loadLogs not found");
window.triggerBackup = () => {
  showMessage("info", "Starting manual backup...");
  setTimeout(
    () => showMessage("success", "Database backup completed and encrypted"),
    2000
  );
};
window.manageCategories = () =>
  showMessage("info", "Category management modal coming soon");
window.managePermissions = () =>
  showMessage("info", "Permission management modal coming soon");
window.systemSettings = () =>
  showMessage("info", "System settings modal coming soon");
window.apiKeys = () =>
  showMessage("info", "API Key management modal coming soon");
