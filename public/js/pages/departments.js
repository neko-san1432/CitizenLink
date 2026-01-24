/**
 * Departments Page
 * Displays government departments information for citizens
 */

// Department icons mapping
const departmentIcons = {
  CEO: "🏗️",
  GSO: "🔧",
  CPDC: "📋",
  CHO: "🏥",
  CSWDO: "🤝",
  CDRRMO: "🚨",
  ENRO: "🌿",
  CTO: "💰",
  CEEO: "💼",
  HRMO: "👥",
  PNP: "👮",
  CLO: "⚖️",
  OCM: "🏛️",
  PAD: "📞",
  OCA: "📋",
  CIO: "📢",
  CAO: "📊",
};

// Department colors mapping (lighter variants for backgrounds)
const departmentColors = {
  CEO: "#fef2f2",
  GSO: "#fffbeb",
  CPDC: "#fdf4ff",
  CHO: "#fce7f3",
  CSWDO: "#eff6ff",
  CDRRMO: "#fff7ed",
  ENRO: "#f0fdf4",
  CTO: "#fefce8",
  CEEO: "#f8fafc",
  HRMO: "#f0fdfa",
  PNP: "#f1f5f9",
  CLO: "#faf5ff",
  OCM: "#fef2f2",
  PAD: "#eff6ff",
  OCA: "#fff7ed",
  CIO: "#f0fdfa",
  CAO: "#f3f4f6",
};

let allDepartments = []; // Store for filtering

async function loadDepartments() {
  try {
    const response = await fetch("/api/departments/active");
    const result = await response.json();

    if (result.success && result.data) {
      allDepartments = result.data;
      renderDepartments(allDepartments);
      setupSearch();
    } else {
      showError("Failed to load departments");
    }
  } catch (error) {
    console.error("Error loading departments:", error);
    showError("Could not connect to server. Please try again later.");
  }
}

function setupSearch() {
  const searchInput = document.getElementById("deptSearch");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allDepartments.filter(
      (dept) =>
        (dept.name && dept.name.toLowerCase().includes(query)) ||
        (dept.code && dept.code.toLowerCase().includes(query)) ||
        (dept.description && dept.description.toLowerCase().includes(query))
    );
    renderDepartments(filtered);
  });
}

function renderDepartments(departments) {
  const content = document.getElementById("departments-content");
  if (!content) return;

  if (departments.length === 0) {
    content.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: #6b7280;">
         <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🔍</div>
         <h3 style="font-size: 1.25rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">No departments found</h3>
         <p>Try adjusting your filters or search query.</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "departments-grid";

  grid.innerHTML = departments
    .map((dept) => createDepartmentCard(dept))
    .join("");

  content.innerHTML = "";
  content.appendChild(grid);
}

function createDepartmentCard(department) {
  const icon = departmentIcons[department.code] || "🏢";
  // Default to a light neutral background if code not found
  const bgColor = departmentColors[department.code] || "#f3f4f6";

  let contactInfo = {};
  try {
    if (department.contact_info) {
      contactInfo =
        typeof department.contact_info === "string"
          ? JSON.parse(department.contact_info)
          : department.contact_info;
    }
  } catch (e) {
    console.warn("Failed to parse contact_info", e);
  }

  const escapeHtml = (text) => {
    if (!text) return "";
    return text
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const name = escapeHtml(department.name || "Unknown Department");
  const code = escapeHtml(department.code || "");
  const description = escapeHtml(
    department.description || "No description provided."
  );
  const level = escapeHtml(department.level || "N/A");
  const responseTime = department.response_time_hours || "N/A";

  return `
    <div class="department-card-premium">
        ${level !== 'N/A' ? `<div class="dept-badge">${level}</div>` : ''}
        
        <div class="department-header-premium">
            <div class="dept-icon-circle" style="background-color: ${bgColor};">
                ${icon}
            </div>
            <h3 class="dept-name">${name}</h3>
            <span class="dept-code">${code}</span>
        </div>
        
        <div class="dept-description">
            ${description.length > 120
      ? description.substring(0, 120) + "..."
      : description
    }
        </div>
        
        <div class="dept-meta-grid">
             <div class="dept-meta-item">
                <span class="dept-meta-label">Status</span>
                <span class="dept-meta-value" style="color: #059669;">● Active</span>
            </div>
        </div>
    </div>
  `;
}

function showError(message) {
  const content = document.getElementById("departments-content");
  if (!content) return;
  content.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: #ef4444; background: #fef2f2; border-radius: 12px; border: 1px solid #fee2e2;">
        <p><strong>Error:</strong> ${message}</p>
    </div>
  `;
}

// Load departments when page loads
document.addEventListener("DOMContentLoaded", loadDepartments);
