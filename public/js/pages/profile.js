import { getUserRole, refreshMetaFromSession } from "../auth/authChecker.js";
import showMessage from "../components/toast.js";

async function checkAuthentication() {
  try {
    let role = await getUserRole({ refresh: false });
    if (!role) {
      const refreshed = await refreshMetaFromSession();
      role = refreshed?.role || null;
    }
    if (!role) {
      window.location.href = "/login";
      return false;
    }
    return true;
  } catch {
    window.location.href = "/login";
    return false;
  }
}

async function fetchprofile() {
  const res = await fetch("/api/auth/profile");
  if (!res.ok) throw new Error("Failed to load profile");
  const json = await res.json();
  return json?.data || {};
}

async function fetchActivity(role) {
  try {
    // For now using the same endpoints, but we could add a dedicated activity log endpoint
    const roleLower = role?.toLowerCase() || "citizen";
    let url = "/api/complaints/my?limit=50"; // Fetch more for the scrollable list

    if (roleLower.includes("lgu")) {
      url = "/api/lgu/assigned-tasks?limit=50";
      if (roleLower === "lgu-admin") url = "/api/lgu-admin/department-assignments?limit=50";
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (error) {
    console.warn("Could not fetch activity:", error);
    return [];
  }
}

function renderprofile(profile) {
  // Name Calculation
  const firstName = profile?.firstName || profile?.first_name || "";
  const lastName = profile?.lastName || profile?.last_name || "";
  const middleName = profile?.middleName || profile?.middle_name || "";
  let name = profile?.name || profile?.full_name || "";
  if (!name && (firstName || lastName)) {
    const parts = [firstName, middleName, lastName].filter(Boolean);
    name = parts.join(" ") || "User";
  }

  // Basic Info
  document.getElementById("profile-name-display").textContent = name || "User";
  document.getElementById("profile-role-display").textContent = formatRole(profile?.role || "citizen");
  document.getElementById("profile-initial").textContent = (name || "U").charAt(0).toUpperCase();

  // Contact Info
  document.getElementById("profile-email-display").textContent = profile?.email || "—";
  document.getElementById("profile-mobile-display").textContent = profile?.mobileNumber || profile?.mobile_number || "—";

  // Address
  const addr = profile?.address || {};
  const addrStr = [addr.line1, addr.barangay, addr.postalCode].filter(Boolean).join(", ");
  document.getElementById("profile-address-display").textContent = addrStr || "—";

  // Member Since
  const created = profile?.created_at || profile?.timestamps?.created;
  if (created) {
    const date = new Date(created);
    const month = date.toLocaleString("default", { month: "short" });
    document.getElementById("member-since").textContent = `${month} ${date.getFullYear()}`;
    document.getElementById("member-since").nextElementSibling.textContent = "Joined";
  }
}

function formatRole(role) {
  if (!role) return "Citizen";
  return role.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function renderStats(activities) {
  const total = activities.length;
  let active = 0;
  let resolved = 0;

  activities.forEach(a => {
    const status = (a.status || a.workflow_status || "").toLowerCase();
    if (["resolved", "closed", "completed", "rejected"].includes(status)) {
      resolved++;
    } else {
      active++;
    }
  });

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-active").textContent = active;
  document.getElementById("stat-resolved").textContent = resolved;
}

function renderActivityList(activities) {
  const container = document.getElementById("activity-list");
  if (!container) return;

  container.innerHTML = "";

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center my-auto py-16 text-center">
        <div class="w-32 h-32 rounded-full bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-6 relative shadow-2xl">
          <svg class="w-16 h-16 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            <line x1="9" y1="12" x2="15" y2="12"></line>
            <line x1="9" y1="16" x2="15" y2="16"></line>
          </svg>
          <svg class="w-12 h-12 text-indigo-400 absolute -bottom-2 -right-2 drop-shadow-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h3 class="text-lg font-bold text-white mb-1">No reports yet</h3>
        <p class="text-xs text-gray-400 mb-6">This user hasn't submitted any reports.</p>
        <button onclick="window.location.href='/filecomplaint'" class="border border-blue-500/50 hover:bg-blue-500/10 text-blue-400 font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Report
        </button>
      </div>
    `;
    return;
  }

  activities.forEach(item => {
    const category = item.category || item.complaints?.category || "General";
    const subcategory = item.subcategory || item.complaints?.subcategory || "";

    // Format: Category - Subcategory (e.g. Infrastructure - Road Repair)
    const categoryText = subcategory
      ? `${category.charAt(0).toUpperCase() + category.slice(1)} - ${subcategory.charAt(0).toUpperCase() + subcategory.slice(1)}`
      : category.charAt(0).toUpperCase() + category.slice(1);

    // Use the category and subcategory instead of "Untitled Activity"
    const title = item.title || item.complaints?.title || categoryText;
    const date = new Date(item.submitted_at || item.created_at || Date.now()).toLocaleDateString();
    const status = (item.status || item.workflow_status || "Pending").replace(/_/g, " ");
    const id = item.complaint_id || item.id;

    // Determine icon and color based on status
    let iconBg = "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    let iconPath = "d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'"; // File text

    if (status.toLowerCase().includes("resolved")) {
      iconBg = "bg-green-500/20 text-green-400 border border-green-500/30";
      iconPath = "d='M5 13l4 4L19 7'"; // Check
    } else if (status.toLowerCase().includes("progress")) {
      iconBg = "bg-orange-500/20 text-orange-400 border border-orange-500/30";
      iconPath = "d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'"; // Clock
    }

    const card = document.createElement("div");
    card.className = "activity-item glass-card flex items-center gap-4 p-4 rounded-xl border border-slate-700/50 hover:border-blue-500/50 transition-all cursor-pointer mb-3 bg-slate-800/40 hover:bg-slate-800/80";
    card.onclick = () => window.location.href = `/complaint-details/${id}`;

    card.innerHTML = `
      <div class="activity-icon w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ${iconPath} />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-bold text-white truncate">${title}</h4>
        <p class="text-xs text-gray-400">ID: ${id.substring(0, 8)} • ${date}</p>
      </div>
      <span class="text-xs font-semibold px-3 py-1 rounded-full bg-slate-700 text-gray-300 capitalize border border-slate-600">
        ${status}
      </span>
    `;

    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await checkAuthentication())) return;
  try {
    const profile = await fetchprofile();
    renderprofile(profile);

    const role = profile?.role || "citizen";
    const activities = await fetchActivity(role);
    renderStats(activities);
    renderActivityList(activities);
  } catch (error) {
    console.error("profile load error:", error);
    showMessage("error", "Failed to load profile");
  }
});
