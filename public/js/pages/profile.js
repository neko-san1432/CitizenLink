import { getUserRole, refreshMetaFromSession } from "../auth/authChecker.js";
import showMessage from "../components/toast.js";

let cachedProfile = null;

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

async function fetchMyComplaints(role) {
    try {
        const roleLower = role?.toLowerCase() || "citizen";
        if (roleLower === "lgu" || roleLower === "lgu-officer") {
            const res = await fetch("/api/lgu/assigned-tasks?limit=20");
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json?.data) ? json.data : [];
        } else if (roleLower === "lgu-admin") {
            const res = await fetch("/api/lgu-admin/department-assignments?limit=20");
            if (!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json?.data) ? json.data : [];
        }
        const res = await fetch("/api/complaints/my?limit=20");
        if (!res.ok) return [];
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
    const firstName = profile?.firstName || profile?.first_name || "";
    const lastName = profile?.lastName || profile?.last_name || "";
    const middleName = profile?.middleName || profile?.middle_name || "";

    let name = profile?.name || profile?.full_name || "";
    if (!name && (firstName || lastName)) {
        const parts = [firstName, middleName, lastName].filter(Boolean);
        name = parts.join(" ") || "User";
    }
    if (!name) name = "User";

    const email = profile?.email || "—";
    const mobile = profile?.mobileNumber || profile?.mobile_number || profile?.mobile || "—";
    const role = profile?.role || profile?.normalizedRole || "citizen";
    const department = profile?.department || profile?.dpt || null;
    const employeeId = profile?.employeeId || profile?.employee_id || null;

    const nameDisplayEl = document.getElementById("profile-name-display");
    if (nameDisplayEl) nameDisplayEl.textContent = name;

    const emailDisplayEl = document.getElementById("profile-email-display");
    if (emailDisplayEl) emailDisplayEl.textContent = email;

    const initialEl = document.getElementById("profile-initial");
    if (initialEl && name !== "—") initialEl.textContent = name.charAt(0).toUpperCase();

    const mobileDisplayEl = document.getElementById("profile-mobile-display");
    if (mobileDisplayEl) mobileDisplayEl.textContent = mobile || "—";

    const roleEl = document.getElementById("profile-role");
    if (roleEl) roleEl.textContent = formatRoleDisplay(role);

    const officeItemEl = document.getElementById("profile-office-item");
    const officeEl = document.getElementById("profile-office");
    const roleLower = role.toLowerCase().trim();

    const shouldShowOffice = (roleLower === "lgu-admin" || roleLower === "lgu" || roleLower === "lgu-officer");

    if (officeItemEl && officeEl) {
        if (shouldShowOffice && department) {
            officeItemEl.style.display = "flex";
            officeEl.textContent = department || "—";
        } else {
            officeItemEl.style.display = "none";
        }
    }

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

    const memberSinceEl = document.getElementById("member-since");
    const createdDate = profile?.created_at || profile?.timestamps?.created;
    if (memberSinceEl && createdDate) {
        const date = new Date(createdDate);
        if (!isNaN(date.getTime())) {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            memberSinceEl.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        }
    }

    const address = profile?.address || {};
    const addressLine1 = address?.line1 || address?.address_line_1 || null;
    const addressLine2 = address?.line2 || address?.address_line_2 || null;
    const postalCode = address?.postalCode || address?.postal_code || null;
    const barangay = address?.barangay || null;

    const addressLine1Display = document.getElementById("address-line-1-display");
    const addressLine2Display = document.getElementById("address-line-2-display");
    const postalDisplay = document.getElementById("address-postal-display");
    const barangayDisplay = document.getElementById("address-barangay-display");

    if (addressLine1Display) addressLine1Display.textContent = addressLine1 || "—";
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

let allItems = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

function renderComplaints(list, role) {
    allItems = list;
    renderPage(1, role);
    renderComplaintChart(list);
}

function renderComplaintChart(items) {
    const container = document.getElementById("complaint-stats-container");
    const canvas = document.getElementById("complaintStatsChart");
    if (!items || items.length === 0 || !container || !canvas) {
        if (container) container.style.display = "none";
        return;
    }
    container.style.display = "block";

    let open = 0, inProgress = 0, resolved = 0;
    items.forEach((item) => {
        const status = (item.workflow_status || item.status || "").toLowerCase();
        if (["submitted", "pending", "new", "open"].includes(status)) open++;
        else if (["in_progress", "assigned", "on_hold", "investigating"].includes(status)) inProgress++;
        else if (["resolved", "closed", "completed", "rejected", "done"].includes(status)) resolved++;
    });

    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: ["Open", "In Progress", "Resolved"],
            datasets: [{
                data: [open, inProgress, resolved],
                backgroundColor: ["#60a5fa", "#f59e0b", "#10b981"],
                borderWidth: 0,
                hoverOffset: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right",
                    labels: { boxWidth: 12, font: { family: "'Source Sans 3', sans-serif" } },
                },
                title: {
                    display: true,
                    text: "Status Overview",
                    font: { size: 14, weight: "600" },
                    align: "start",
                    padding: { bottom: 10 },
                },
            },
            cutout: "70%",
        },
    });
}

function renderPage(page, role) {
    currentPage = page;
    const container = document.getElementById("my-complaints");
    const empty = document.getElementById("complaints-empty");
    if (!container || !empty) return;

    const isStaff = ["lgu", "lgu-officer", "lgu-admin"].includes(role?.toLowerCase());
    container.innerHTML = "";

    if (!allItems.length) {
        empty.classList.remove("hidden");
        return;
    }

    empty.classList.add("hidden");
    const totalItems = allItems.length;
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    const currentItems = allItems.slice(startIndex, endIndex);

    const table = document.createElement("table");
    table.className = "complaints-table";
    table.innerHTML = `
    <thead><tr><th>Complaint</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
    <tbody>${currentItems.map(item => {
        const title = item.title || item.complaints?.title || "Assignment";
        const id = item.complaint_id || item.id;
        const date = item.submitted_at || item.assigned_at || item.created_at;
        const status = (item.status || item.workflow_status || "unknown").toLowerCase().replace(/\s+/g, "_");
        const dateStr = date ? new Date(date).toLocaleDateString() : "";
        return `
        <tr>
          <td><div class="font-medium">${title}</div><div class="text-xs text-gray-500">ID: ${id.substring(0, 8)}...</div></td>
          <td><span class="status-badge status-${status}">${status.replace(/_/g, " ")}</span></td>
          <td class="text-gray-500">${dateStr}</td>
          <td><a class="btn-secondary btn-sm" href="/complaint-details/${id}?from=profile">View</a></td>
        </tr>`;
    }).join('')}</tbody>
  `;
    container.appendChild(table);
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!(await checkAuthentication())) return;
    try {
        const profile = await fetchProfile();
        cachedProfile = profile;
        renderProfile(profile);

        const role = profile?.role || profile?.normalizedRole || "citizen";
        const data = await fetchMyComplaints(role);
        renderComplaints(data, role);
    } catch (error) {
        console.error("[PROFILE] Initialization error:", error);
        showMessage("error", "Failed to load profile data");
    }
});
