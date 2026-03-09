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

async function fetchProfile() {
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

function renderProfile(profile) {
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
      <div class="flex flex-col items-center justify-center h-48 text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="empty-state-icon mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No activity yet</p>
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
    let iconBg = "bg-blue-100 text-blue-600";
    let iconPath = "d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'"; // File text

    if (status.toLowerCase().includes("resolved")) {
      iconBg = "bg-green-100 text-green-600";
      iconPath = "d='M5 13l4 4L19 7'"; // Check
    } else if (status.toLowerCase().includes("progress")) {
      iconBg = "bg-orange-100 text-orange-600";
      iconPath = "d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'"; // Clock
    }

    const card = document.createElement("div");
    card.className = "activity-item cursor-pointer";
    card.onclick = () => window.location.href = `/complaint-details/${id}`;

    card.innerHTML = `
      <div class="activity-icon ${iconBg}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ${iconPath} />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-bold text-gray-800 truncate">${title}</h4>
        <p class="text-xs text-gray-500">ID: ${id.substring(0, 8)} • ${date}</p>
      </div>
      <span class="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
        ${status}
      </span>
    `;

    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!(await checkAuthentication())) return;
  try {
    const profile = await fetchProfile();
    renderProfile(profile);

    const role = profile?.role || "citizen";
    const activities = await fetchActivity(role);
    renderStats(activities);
    renderActivityList(activities);
  } catch (error) {
    console.error("Profile load error:", error);
    showMessage("error", "Failed to load profile");
  }
});
