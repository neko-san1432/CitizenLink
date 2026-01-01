/**
 * Coordinator Complaint Review Page
 * Handles loading and reviewing individual complaints
 */
import { Toast } from "../components/toast.js";
import { getDepartmentNameByIdOrCode, getActiveDepartments } from "../utils/departmentUtils.js";

let currentComplaint = null;
let complaintId = null;
let complaintMapInstance = null;
let boundaryToggleBtn = null;
let boundaryVisible = false;
let boundaryDataCache = null;
let reviewBoundaryLayer = null;
/**
 * Clean up any stuck modal overlays
 */
function cleanupStuckModals() {
  // Remove any stuck modal overlays
  const stuckModals = document.querySelectorAll('.modal.active, .modal-overlay.active, [id^="modal-"]');
  stuckModals.forEach(modal => {
    if (modal.id !== "modal-overlay" || modal.classList.contains("active")) {
      modal.classList.remove("active");
      modal.style.display = "none";
      modal.style.visibility = "hidden";
      modal.style.opacity = "0";
      // Only remove if it's not the main modal-overlay managed by ModalManager
      if (modal.id !== "modal-overlay") {
        modal.remove();
      }
    }
  });

  // Remove body modal-open class
  document.body.classList.remove("modal-open");

  // Clean up ModalManager state if it exists
  if (window.modalManager) {
    window.modalManager.activeModal = null;
    const overlay = window.modalManager.modalOverlay;
    if (overlay) {
      overlay.classList.remove("active");
    }
  }
}

/**
 * Initialize the review page
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Clean up any stuck modal overlays first
  cleanupStuckModals();

  // Get complaint ID from URL
  const pathParts = window.location.pathname.split("/");
  complaintId = pathParts[pathParts.length - 1];
  if (!complaintId || complaintId === "review") {
    showError("No complaint ID provided");
    return;
  }
  setupEventListeners();
  await loadComplaint();
});

/**
 * Setup event listeners for all buttons and forms
 */
function setupEventListeners() {
  // Return to dashboard button
  const returnDashboardBtn = document.getElementById("return-dashboard-btn");
  if (returnDashboardBtn) {
    returnDashboardBtn.addEventListener("click", () => {
      window.location.href = "/dashboard";
    });
  }

  // Action buttons
  const assignBtn = document.getElementById("assign-btn");
  if (assignBtn) {
    assignBtn.addEventListener("click", () => window.openAssignModal());
  }

  const duplicateBtn = document.getElementById("duplicate-btn");
  if (duplicateBtn) {
    duplicateBtn.addEventListener("click", () => window.openDuplicateModal());
  }

  const relatedBtn = document.getElementById("related-btn");
  if (relatedBtn) {
    relatedBtn.addEventListener("click", () => window.linkRelatedComplaints());
  }

  const rejectBtn = document.getElementById("reject-btn");
  if (rejectBtn) {
    rejectBtn.addEventListener("click", () => window.showRejectModal());
  }

  const falseComplaintBtn = document.getElementById("false-complaint-btn");
  if (falseComplaintBtn) {
    falseComplaintBtn.addEventListener("click", () => window.openFalseComplaintModal());
  }

  const uniqueBtn = document.getElementById("unique-btn");
  if (uniqueBtn) {
    uniqueBtn.addEventListener("click", () => window.markAsUnique());
  }

  // Modal close buttons
  const closeAssignModal = document.getElementById("close-assign-modal");
  if (closeAssignModal) {
    closeAssignModal.addEventListener("click", () => window.closeModal("assign-modal"));
  }

  const closeDuplicateModal = document.getElementById("close-duplicate-modal");
  if (closeDuplicateModal) {
    closeDuplicateModal.addEventListener("click", () => window.closeModal("duplicate-modal"));
  }

  const closeRejectModal = document.getElementById("close-reject-modal");
  if (closeRejectModal) {
    closeRejectModal.addEventListener("click", () => window.closeModal("reject-modal"));
  }

  const closeFalseComplaintModal = document.getElementById("close-false-complaint-modal");
  if (closeFalseComplaintModal) {
    closeFalseComplaintModal.addEventListener("click", () => window.closeModal("false-complaint-modal"));
  }

  // Cancel buttons
  const cancelAssignBtn = document.getElementById("cancel-assign-btn");
  if (cancelAssignBtn) {
    cancelAssignBtn.addEventListener("click", () => window.closeModal("assign-modal"));
  }

  const cancelDuplicateBtn = document.getElementById("cancel-duplicate-btn");
  if (cancelDuplicateBtn) {
    cancelDuplicateBtn.addEventListener("click", () => window.closeModal("duplicate-modal"));
  }

  const cancelRejectBtn = document.getElementById("cancel-reject-btn");
  if (cancelRejectBtn) {
    cancelRejectBtn.addEventListener("click", () => window.closeModal("reject-modal"));
  }

  const cancelFalseComplaintBtn = document.getElementById("cancel-false-complaint-btn");
  if (cancelFalseComplaintBtn) {
    cancelFalseComplaintBtn.addEventListener("click", () => window.closeModal("false-complaint-modal"));
  }

  // Form submissions
  const assignForm = document.getElementById("assign-form");
  if (assignForm) {
    assignForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.handleAssign(e);
    });
  }

  const duplicateForm = document.getElementById("duplicate-form");
  if (duplicateForm) {
    duplicateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.handleDuplicate(e);
    });
  }

  const rejectForm = document.getElementById("reject-form");
  if (rejectForm) {
    rejectForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.handleReject(e);
    });
  }

  const falseComplaintForm = document.getElementById("false-complaint-form");
  if (falseComplaintForm) {
    falseComplaintForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.handleFalseComplaint(e);
    });
  }
}
/**
 * Load complaint details
 */
async function loadComplaint() {
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to load complaint");
    }
    currentComplaint = result.data;
    renderComplaint();
  } catch (error) {
    console.error("[REVIEW] Load error:", error);
    showError(error.message);
  }
}
/**
 * Render complaint details
 */
async function renderComplaint() {
  // The service returns complaint in nested structure
  const {complaint} = currentComplaint;
  const similarities = currentComplaint.analysis?.duplicate_candidates ||
                     currentComplaint.analysis?.similar_complaints ||
                     currentComplaint.similarities || [];
  // Hide loading, show content
  document.getElementById("loading").style.display = "none";
  document.getElementById("complaint-content").style.display = "block";
  // Header
  document.getElementById("complaint-title").textContent = complaint.title;
  document.getElementById("complaint-id").textContent = complaint.id;
  document.getElementById("submitted-date").textContent = formatDate(complaint.submitted_at);
  document.getElementById("submitter-name").textContent =
    complaint.submitted_by_profile?.name || complaint.submitted_by_profile?.email || "Unknown";
  // Render complainant info panel
  renderComplainantInfo(complaint.submitted_by_profile);
  // Status badge
  const statusEl = document.getElementById("complaint-status");
  const status = complaint.workflow_status || complaint.status || "unknown";
  statusEl.innerHTML = `<span class="badge status-${status.replace(" ", "-")}">${status}</span>`;
  // Priority badge
  const priorityEl = document.getElementById("complaint-priority");
  priorityEl.innerHTML = `<span class="badge priority-${complaint.priority}">${complaint.priority}</span>`;
  // Details - Handle both old and new hierarchical form structure
  const typeText = complaint.type || complaint.category || "Not specified";
  const subcategoryText = complaint.subcategory || "";
  document.getElementById("complaint-type").textContent = typeText;
  const subtypeEl = document.getElementById("complaint-subtype");
  if (subcategoryText) {
    subtypeEl.textContent = ` - ${subcategoryText}`;
  } else {
    subtypeEl.textContent = "";
  }
  document.getElementById("complaint-description").textContent = complaint.descriptive_su;
  document.getElementById("complaint-location").textContent = complaint.location_text;
  // Show preferred departments in main details
  const preferredDeptsEl = document.getElementById("preferred-departments-list");
  if (preferredDeptsEl) {
    const departments = complaint.preferred_departments || [];
    if (departments.length > 0) {
      // Load department names dynamically
      const displayNames = await Promise.all(
        departments.map(dept => getDepartmentNameByIdOrCode(dept))
      );
      preferredDeptsEl.innerHTML = displayNames.map(name => `<span class="dept-badge">${name}</span>`).join(" ");
    } else {
      preferredDeptsEl.textContent = "No departments selected by citizen";
    }
  }
  // Show complainant's department preference
  const preferenceEl = document.getElementById("complainant-preference");
  if (preferenceEl) {
    const departments = complaint.preferred_departments || [];
    if (departments.length > 0) {
      // Load department names dynamically
      const displayNames = await Promise.all(
        departments.map(dept => getDepartmentNameByIdOrCode(dept))
      );
      preferenceEl.textContent = displayNames.join(", ");
    } else {
      preferenceEl.textContent = "No preference specified";
    }
  }
  // Reset map helpers before rendering
  complaintMapInstance = null;
  reviewBoundaryLayer = null;
  boundaryVisible = false;
  updateBoundaryButtonText();
  setupMapControlButtons(complaint);

  // Map preview using ComplaintMap component
  try {
    const mapEl = document.getElementById("location-map");
    const hasLat = complaint.latitude !== null && complaint.latitude !== void 0;
    const hasLng = complaint.longitude !== null && complaint.longitude !== void 0;
    console.log("[REVIEW] Map setup:", {
      mapEl: Boolean(mapEl),
      hasLat,
      hasLng,
      lat: complaint.latitude,
      lng: complaint.longitude,
      latType: typeof complaint.latitude,
      lngType: typeof complaint.longitude
    });
    if (mapEl && (hasLat || hasLng)) {
      // Use ComplaintMap component
      if (window.ComplaintMap) {
        const complaintMap = new window.ComplaintMap("location-map");
        if (hasLat && hasLng) {
          // Wait for map to be fully initialized and container to be visible
          const initMap = () => {
            const mapEl = document.getElementById("location-map");
            if (mapEl && mapEl.offsetWidth > 0 && mapEl.offsetHeight > 0) {
              complaintMapInstance = complaintMap;
              reviewBoundaryLayer = null;
              boundaryVisible = false;
              updateBoundaryButtonText();
              complaintMap.setLocation(
                complaint.latitude,
                complaint.longitude,
                complaint.title || "Complaint Location",
                complaint.location_text || ""
              );
              // Invalidate size after setting location
              setTimeout(() => {
                if (complaintMap.map) {
                  complaintMap.map.invalidateSize();
                }
              }, 300);
            } else {
              // Retry if container not ready
              setTimeout(initMap, 100);
            }
          };
          // Start initialization after a short delay
          setTimeout(initMap, 300);
        }
      } else {
        console.warn("[REVIEW] ComplaintMap component not loaded, trying fallback...");
        // Fallback to basic Leaflet map
        try {
          if (typeof L !== "undefined") {
            const lat = Number(complaint.latitude);
            const lng = Number(complaint.longitude);
            const center = [lat, lng];
            const map = L.map("location-map").setView(center, 15);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
              attribution: "© OpenStreetMap contributors"
            }).addTo(map);
            const marker = L.marker(center).addTo(map);
            marker.bindPopup(`<b>${complaint.title || "Complaint Location"}</b><br>${complaint.location_text || ""}`);
            complaintMapInstance = { map };
            reviewBoundaryLayer = null;
            boundaryVisible = false;
            updateBoundaryButtonText();
          } else {
            console.warn("[REVIEW] Leaflet not available for fallback");
          }
        } catch (fallbackError) {
          console.error("[REVIEW] Fallback map failed:", fallbackError);
        }
      }
    } else if (mapEl) {
      mapEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No location coordinates available</div>';
    }
  } catch (e) {
    console.warn("[REVIEW] Map init failed:", e);
  }
  // Evidence (always show section with fallback)
  const evidenceSection = document.getElementById("evidence-section");
  const evidenceEmpty = document.getElementById("evidence-empty");
  // Handle different evidence field structures
  let evidenceList = [];
  if (complaint.evidence && Array.isArray(complaint.evidence)) {
    evidenceList = complaint.evidence;
  } else if (complaint.evidence_files && Array.isArray(complaint.evidence_files)) {
    evidenceList = complaint.evidence_files;
  } else if (complaint.files && Array.isArray(complaint.files)) {
    evidenceList = complaint.files;
  }
  if (evidenceList.length > 0) {
    if (evidenceSection) evidenceSection.style.display = "block";
    if (evidenceEmpty) evidenceEmpty.style.display = "none";
    renderEvidence(evidenceList);
  } else {
    if (evidenceSection) evidenceSection.style.display = "block";
    if (evidenceEmpty) evidenceEmpty.style.display = "block";
    const grid = document.getElementById("evidence-grid");
    if (grid) grid.innerHTML = "";
  }
  // Check for high confidence duplicates (similarity score >= 0.85)
  const duplicateCandidates = currentComplaint.analysis?.duplicate_candidates || [];
  const hasHighConfidenceDuplicate = duplicateCandidates.length > 0 ||
    (similarities && similarities.some(s => (s.similarity_score || s.score || 0) >= 0.85));

  // Show/hide high confidence duplicate alert
  const duplicateAlert = document.getElementById("high-confidence-duplicate-alert");
  if (duplicateAlert) {
    if (hasHighConfidenceDuplicate && !complaint.is_duplicate) {
      duplicateAlert.style.display = "block";
    } else {
      duplicateAlert.style.display = "none";
    }
  }

  // Similar complaints
  if (similarities && similarities.length > 0) {
    document.getElementById("similar-section").style.display = "block";
    document.getElementById("duplicate-btn").style.display = "block";
    document.getElementById("related-btn").style.display = "block";
    document.getElementById("unique-btn").style.display = "block";
    renderSimilarComplaints(similarities);
  } else {
    // Hide similar complaints section if no similarities
    document.getElementById("similar-section").style.display = "none";
    document.getElementById("duplicate-btn").style.display = "none";
    document.getElementById("related-btn").style.display = "none";
    document.getElementById("unique-btn").style.display = "none";
  }
}
/**
 * Render evidence images with preview functionality
 */
function renderEvidence(evidence) {
  const grid = document.getElementById("evidence-grid");
  const normalize = (item) => {
    // Support both DB_FORMAT.sql (snake_case) and existing code (camelCase)
    // Also support signedUrl from coordinator repository
    const url = item.publicUrl || item.signedUrl || item.url || item.public_url || null;
    const fileName = item.fileName || item.file_name || item.name || "file";
    const filePath = item.filePath || item.file_path || item.path || null;
    const fileType = item.fileType || item.file_type || item.type || "";
    const fileSize = item.fileSize || item.file_size || item.size || null;
    const mimeType = item.mimeType || item.mime_type || item.fileType || "";
    return { url, fileName, filePath, fileType, fileSize, mimeType };
  };
  const isImage = (type, name) => {
    if (type && type.startsWith("image/")) return true;
    const n = (name || "").toLowerCase();
    return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp");
  };
  const isVideo = (type, name) => {
    if (type && type.startsWith("video/")) return true;
    const n = (name || "").toLowerCase();
    return n.endsWith(".mp4") || n.endsWith(".mov") || n.endsWith(".webm");
  };
  const isPdf = (type, name) => {
    return (type === "application/pdf") || (name || "").toLowerCase().endsWith(".pdf");
  };
  const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return "";
    const units = ["B","KB","MB","GB"];
    let i = 0; let n = Number(bytes);
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };
  const getFileIcon = (type, name) => {
    if (isImage(type, name)) return "🖼️";
    if (isVideo(type, name)) return "🎥";
    if (isPdf(type, name)) return "📄";
    if (type && type.startsWith("audio/")) return "🎵";
    return "📎";
  };
  grid.innerHTML = evidence.map((raw, index) => {
    const item = normalize(raw);
    const sizeText = item.fileSize ? ` · ${formatSize(item.fileSize)}` : "";
    const icon = getFileIcon(item.fileType, item.fileName);
    return `
      <div class="evidence-item" data-evidence-index="${index}" style="cursor: pointer;">
        <div class="evidence-preview">
          ${isImage(item.fileType, item.fileName) && item.url ?
    `<img src="${item.url}" alt="${item.fileName}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;">` :
    `<div class="evidence-icon" style="display: flex; align-items: center; justify-content: center; height: 120px; font-size: 48px; background: #f3f4f6; border-radius: 8px;">${icon}</div>`
}
          <div class="evidence-info" style="padding: 8px;">
            <div class="evidence-name" style="font-weight: 500; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.fileName}">${item.fileName}</div>
            <div class="evidence-meta" style="font-size: 12px; color: #6b7280;">${item.fileType || "Unknown type"}${sizeText}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Store evidence data globally for preview
  window.evidenceData = evidence.map(normalize);

  // Attach event listeners for evidence items
  document.querySelectorAll(".evidence-item").forEach(item => {
    const index = parseInt(item.getAttribute("data-evidence-index"));
    item.addEventListener("click", () => {
      window.openEvidencePreview(index);
    });
  });
}

/**
 * Open evidence preview modal
 */
window.openEvidencePreview = function(index) {
  console.log("[REVIEW] Opening evidence preview:", {
    index,
    hasPreview: Boolean(window.evidencePreview),
    hasData: Boolean(window.evidenceData),
    dataLength: window.evidenceData?.length,
    evidence: window.evidenceData?.[index]
  });

  if (window.evidencePreview && window.evidenceData && window.evidenceData[index]) {
    window.evidencePreview.show(window.evidenceData[index]);
  } else {
    console.error("[REVIEW] Cannot open evidence preview - missing components or data");
  }
};

/**
 * Map helper controls
 */
function setupMapControlButtons(complaint) {
  const boundaryBtn = document.getElementById("toggle-boundary-btn");
  const fullscreenBtn = document.getElementById("map-fullscreen-btn");
  if (!boundaryBtn || !fullscreenBtn) return;

  const hasLatitude = complaint.latitude !== null && complaint.latitude !== void 0;
  const hasLongitude = complaint.longitude !== null && complaint.longitude !== void 0;
  const hasCoordinates = hasLatitude && hasLongitude;

  if (!hasCoordinates) {
    boundaryBtn.style.display = "none";
    fullscreenBtn.style.display = "none";
    boundaryToggleBtn = null;
    return;
  }

  boundaryBtn.style.display = "inline-flex";
  fullscreenBtn.style.display = "inline-flex";
  boundaryToggleBtn = boundaryBtn;
  updateBoundaryButtonText();

  boundaryBtn.removeEventListener("click", handleBoundaryToggle);
  boundaryBtn.addEventListener("click", handleBoundaryToggle);
  fullscreenBtn.onclick = () => openFullscreenMap(complaint);
}

function updateBoundaryButtonText() {
  if (!boundaryToggleBtn) return;
  boundaryToggleBtn.textContent = boundaryVisible ? "Hide Digos City Boundary" : "Show Digos City Boundary";
  boundaryToggleBtn.setAttribute("aria-pressed", boundaryVisible ? "true" : "false");
}

async function handleBoundaryToggle() {
  if (!boundaryToggleBtn) return;

  if (!complaintMapInstance || !complaintMapInstance.map) {
    Toast.info("Map is still initializing. Please try again shortly.");
    return;
  }

  boundaryToggleBtn.disabled = true;
  try {
    if (!reviewBoundaryLayer) {
      await ensureBoundaryData();
      reviewBoundaryLayer = createBoundaryLayer(complaintMapInstance.map);
    }

    if (!reviewBoundaryLayer) {
      throw new Error("Boundary data is unavailable.");
    }

    if (complaintMapInstance.map.hasLayer(reviewBoundaryLayer)) {
      complaintMapInstance.map.removeLayer(reviewBoundaryLayer);
      boundaryVisible = false;
      Toast.info("Digos City boundary hidden.");
    } else {
      reviewBoundaryLayer.addTo(complaintMapInstance.map);
      boundaryVisible = true;
      Toast.success("Digos City boundary displayed.");
    }
    updateBoundaryButtonText();
  } catch (error) {
    console.error("[REVIEW] Boundary toggle error:", error);
    Toast.error(error.message || "Unable to toggle the boundary.");
  } finally {
    boundaryToggleBtn.disabled = false;
  }
}

async function ensureBoundaryData() {
  if (Array.isArray(boundaryDataCache) && boundaryDataCache.length > 0) {
    return boundaryDataCache;
  }

  const response = await fetch("/api/boundaries");
  if (!response.ok) {
    throw new Error("Failed to load boundary data.");
  }
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Boundary data is not available.");
  }

  boundaryDataCache = data.filter(item => item && item.geojson);
  if (boundaryDataCache.length === 0) {
    throw new Error("Boundary GeoJSON data is missing.");
  }
  return boundaryDataCache;
}

function createBoundaryLayer(map) {
  if (!Array.isArray(boundaryDataCache) || boundaryDataCache.length === 0 || !map) {
    return null;
  }

  const layerGroup = L.layerGroup();
  boundaryDataCache.forEach(barangay => {
    if (!barangay?.geojson) return;
    const geoLayer = L.geoJSON(barangay.geojson, {
      style: {
        color: "#3b82f6",
        weight: 1.5,
        opacity: 0.8,
        dashArray: "6,4",
        fillOpacity: 0
      },
      interactive: false
    });

    if (barangay.name) {
      geoLayer.bindTooltip(barangay.name, {
        permanent: false,
        direction: "center",
        className: "boundary-tooltip",
        interactive: false
      });
    }

    geoLayer.addTo(layerGroup);
  });

  return layerGroup;
}

function openFullscreenMap(complaint) {
  const hasLatitude = complaint.latitude !== null && complaint.latitude !== void 0;
  const hasLongitude = complaint.longitude !== null && complaint.longitude !== void 0;
  if (!hasLatitude || !hasLongitude) {
    Toast.error("No coordinates available for this complaint.");
    return;
  }

  const existingModal = document.getElementById("review-map-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "review-map-modal";
  modal.className = "modal active";
  modal.style.cssText = "position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);";
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 90vw; width: 960px; background: #fff; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem; border-bottom:1px solid #e5e7eb;">
        <h2 style="margin:0; font-size:1.1rem;">📍 Complaint Location</h2>
        <button id="close-review-map-modal" class="modal-close" style="font-size:1.5rem;">&times;</button>
      </div>
      <div class="modal-body" style="padding:1.25rem;">
        <div id="review-fullscreen-map" style="width:100%; height:70vh; border-radius:10px; overflow:hidden; background:#f3f4f6;"></div>
        <div style="margin-top:1rem; font-size:0.95rem;">
          <strong>Address:</strong> ${complaint.location_text || "N/A"}<br>
          <strong>Coordinates:</strong> ${complaint.latitude}, ${complaint.longitude}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
    document.removeEventListener("keydown", handleEscape);
  };

  document.getElementById("close-review-map-modal").addEventListener("click", (e) => {
    e.stopPropagation();
    closeModal();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  };
  document.addEventListener("keydown", handleEscape);

  setTimeout(() => initializeFullscreenMap(complaint), 100);
}

async function initializeFullscreenMap(complaint) {
  const mapContainer = document.getElementById("review-fullscreen-map");
  if (!mapContainer) return;

  try {
    await ensureLeafletLoaded();

    const lat = Number(complaint.latitude);
    const lng = Number(complaint.longitude);
    const map = L.map("review-fullscreen-map").setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(map);

    L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<strong>${complaint.title || "Complaint Location"}</strong><br>${complaint.location_text || ""}`)
      .openPopup();

    if (Array.isArray(boundaryDataCache) && boundaryDataCache.length > 0) {
      const layer = createBoundaryLayer(map);
      if (layer) {
        layer.addTo(map);
      }
    }

    setTimeout(() => map.invalidateSize(), 200);
  } catch (error) {
    console.error("[REVIEW] Fullscreen map error:", error);
    mapContainer.innerHTML = '<p style="padding: 1rem; color: #b91c1c;">Unable to load map preview.</p>';
  }
}

async function ensureLeafletLoaded() {
  if (typeof L !== "undefined") {
    return;
  }

  await new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-leaflet]");
    if (existingScript) {
      existingScript.addEventListener("load", resolve);
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Leaflet.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.dataset.leaflet = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet."));
    document.head.appendChild(script);
  });
}

/**
 * Render similar complaints
 */
function renderSimilarComplaints(similarities) {
  const list = document.getElementById("similar-list");
  const masterSelect = document.getElementById("master-complaint");

  list.innerHTML = similarities.map(sim => `
    <div class="similar-item">
      <h4>${sim.similar_complaint?.title || "Unknown"}</h4>
      <div class="similar-meta">
        ${sim.similar_complaint?.category || sim.similar_complaint?.type || ""} | 
        ${sim.similar_complaint?.workflow_status || sim.similar_complaint?.status || ""} | 
        ${formatDate(sim.similar_complaint?.submitted_at)}
        <span class="similarity-score">${Math.round(sim.similarity_score * 100)}% match</span>
      </div>
    </div>
  `).join("");

  // Populate master complaint dropdown
  masterSelect.innerHTML = `<option value="">Select master complaint...</option>${
    similarities.map(sim => `
      <option value="${sim.similar_complaint_id}">
        ${sim.similar_complaint?.title} (${Math.round(sim.similarity_score * 100)}% match)
      </option>
    `).join("")}`;
}
/**
 * Modal functions
 */
window.openAssignModal = function() {
  document.getElementById("assign-modal").classList.add("active");
  // Pre-fill priority from complaint
  const {complaint} = currentComplaint;
  document.getElementById("assign-priority").value = complaint.priority || "medium";
  // Reset search input
  const searchInput = document.getElementById("department-search-input");
  if (searchInput) {
    searchInput.value = "";
  }
  // Reset filtered departments
  filteredDepartments = allDepartments.length > 0 ? [...allDepartments] : [];
  // Load departments dynamically
  loadDepartmentsForAssignment();
};
window.openDuplicateModal = function() {
  document.getElementById("duplicate-modal").classList.add("active");
};
window.linkRelatedComplaints = function() {
  Toast.info("Link related complaints feature coming soon");
};
window.showRejectModal = function() {
  document.getElementById("reject-modal").classList.add("active");
};
window.openFalseComplaintModal = function() {
  document.getElementById("false-complaint-modal").classList.add("active");
};
window.closeModal = function(modalId) {
  document.getElementById(modalId).classList.remove("active");
};
/**
 * Handle assign to department
 */
window.handleAssign = async function(event) {
  event.preventDefault();
  const selectedDepartments = Array.from(document.querySelectorAll(".dept-check:checked")).map(el => el.value);
  const priority = document.getElementById("assign-priority").value;
  const deadline = document.getElementById("deadline").value;
  const notes = document.getElementById("notes").value;
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "assign_department",
        data: {
          departments: selectedDepartments,
          options: {
            priority,
            deadline: deadline || null,
            notes: notes || null
          }
        }
      })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to assign complaint");
    }
    Toast.success("Complaint assigned successfully!");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  } catch (error) {
    console.error("[REVIEW] Assign error:", error);
    Toast.error(error.message);
  }
};
/**
 * Handle mark as duplicate
 */
window.handleDuplicate = async function(event) {
  event.preventDefault();
  const masterComplaintId = document.getElementById("master-complaint").value;
  const reason = document.getElementById("duplicate-reason").value;
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "mark_duplicate",
        data: {
          masterComplaintId,
          reason
        }
      })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to mark as duplicate");
    }
    Toast.success("Complaint marked as duplicate");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  } catch (error) {
    console.error("[REVIEW] Duplicate error:", error);
    Toast.error(error.message);
  }
};
/**
 * Handle reject complaint
 */
window.handleReject = async function(event) {
  event.preventDefault();
  const reason = document.getElementById("reject-reason").value;
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "reject",
        data: {
          reason
        }
      })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to reject complaint");
    }
    Toast.success("Complaint rejected");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  } catch (error) {
    console.error("[REVIEW] Reject error:", error);
    Toast.error(error.message);
  }
};
/**
 * Handle mark as false complaint
 */
window.handleFalseComplaint = async function(event) {
  event.preventDefault();
  const reason = document.getElementById("false-complaint-reason").value;
  const notes = document.getElementById("false-complaint-notes").value;
  // Validate that a reason is selected
  if (!reason) {
    Toast.error("Please select a reason for marking this complaint as false.");
    return;
  }
  // Combine reason and notes
  const fullReason = notes ? `${reason}: ${notes}` : reason;
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "mark_false",
        data: {
          reason: fullReason
        }
      })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to mark as false complaint");
    }
    Toast.success("Complaint marked as false");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);
  } catch (error) {
    console.error("[REVIEW] False complaint error:", error);
    Toast.error(error.message);
  }
};
/**
 * Mark complaint as unique (no duplicates)
 */
window.markAsUnique = async function() {
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "mark_unique",
        data: {}
      })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || "Failed to mark as unique");
    }
    Toast.success("Complaint marked as unique");
    // Hide similar complaints section
    document.getElementById("similar-section").style.display = "none";
    document.getElementById("duplicate-btn").style.display = "none";
    document.getElementById("related-btn").style.display = "none";
    document.getElementById("unique-btn").style.display = "none";
  } catch (error) {
    console.error("[REVIEW] Unique error:", error);
    Toast.error(error.message);
  }
};
/**
 * Load departments for assignment modal
 */
let allDepartments = [];
let filteredDepartments = [];

async function loadDepartmentsForAssignment() {
  try {
    allDepartments = await getActiveDepartments();
    filteredDepartments = [...allDepartments];

    if (allDepartments && allDepartments.length > 0) {
      renderDepartmentsList();
      setupDepartmentSearch();
      updateSelectedCount();
    } else {
      throw new Error("No departments available");
    }
  } catch (error) {
    console.error("Error loading departments:", error);
    const departmentsList = document.getElementById("departments-list");
    if (departmentsList) {
      departmentsList.innerHTML = '<p style="color: #e74c3c; padding: 10px;">Failed to load departments. Please refresh the page or contact support.</p>';
    }
  }
}

function renderDepartmentsList() {
  const departmentsList = document.getElementById("departments-list");
  if (!departmentsList) return;

  if (filteredDepartments.length === 0) {
    departmentsList.innerHTML = '<div class="no-results">No departments match your search</div>';
    return;
  }

  // Get currently selected departments before re-rendering
  const selectedDepts = new Set(
    Array.from(document.querySelectorAll(".dept-check:checked")).map(cb => cb.value)
  );

  departmentsList.innerHTML = filteredDepartments.map(dept => {
    const deptId = dept.code || dept.id;
    const isChecked = selectedDepts.has(deptId);
    return `
      <label class="department-checkbox-label">
        <input type="checkbox" class="dept-check" value="${deptId}" data-dept-name="${escapeHtml(dept.name)}" ${isChecked ? "checked" : ""}>
        <span class="department-checkbox-text">
          <span class="dept-name">${escapeHtml(dept.name)}</span>
          ${dept.code ? `<span class="dept-code">${escapeHtml(dept.code)}</span>` : ""}
        </span>
      </label>
    `;
  }).join("");

  // Attach change listeners
  document.querySelectorAll(".dept-check").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      updateSelectedCount();
    });
  });
}

function setupDepartmentSearch() {
  const searchInput = document.getElementById("department-search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (searchTerm === "") {
      filteredDepartments = [...allDepartments];
    } else {
      filteredDepartments = allDepartments.filter(dept => {
        const name = (dept.name || "").toLowerCase();
        const code = (dept.code || "").toLowerCase();
        return name.includes(searchTerm) || code.includes(searchTerm);
      });
    }

    renderDepartmentsList();
    updateSelectedCount();
  });
}

function updateSelectedCount() {
  const selectedCheckboxes = document.querySelectorAll(".dept-check:checked");
  const count = selectedCheckboxes.length;
  const countEl = document.getElementById("selected-departments-count");
  const countTextEl = document.getElementById("selected-count-text");

  if (countEl && countTextEl) {
    if (count > 0) {
      countEl.style.display = "block";
      countTextEl.textContent = count;
    } else {
      countEl.style.display = "none";
    }
  }
}

/**
 * Show error message
 */
function showError(message) {
  document.getElementById("loading").style.display = "none";
  document.getElementById("error-message").style.display = "block";
  document.getElementById("error-text").textContent = message;
}
/**
 * Render complainant information panel
 */
function renderComplainantInfo(profile) {
  const contentEl = document.getElementById("complainant-info-content");
  if (!contentEl) return;

  if (!profile) {
    contentEl.innerHTML = '<div class="complainant-empty">No complainant information available</div>';
    return;
  }

  const name = profile.name || profile.email || "Unknown";
  const email = profile.email || "Not provided";
  const firstName = profile.firstName || "";
  const lastName = profile.lastName || "";

  // Get phone number from multiple possible fields
  const rawMeta = profile.raw_user_meta_data || {};
  const phoneNumber = profile.mobileNumber ||
                     profile.mobile ||
                     rawMeta.mobile_number ||
                     rawMeta.mobile ||
                     rawMeta.phone_number ||
                     rawMeta.phone ||
                     null;

  // Get address from metadata - check multiple formats
  const address = rawMeta.address || {};
  const addressParts = [];

  // Check for address_line_1, address_line_2 format
  if (rawMeta.address_line_1) addressParts.push(rawMeta.address_line_1);
  if (rawMeta.address_line_2) addressParts.push(rawMeta.address_line_2);

  // Check for nested address object
  if (address.line1) addressParts.push(address.line1);
  if (address.line2) addressParts.push(address.line2);

  // Check for old format
  if (rawMeta.addressLine1 && !addressParts.includes(rawMeta.addressLine1)) {
    addressParts.push(rawMeta.addressLine1);
  }
  if (rawMeta.addressLine2 && !addressParts.includes(rawMeta.addressLine2)) {
    addressParts.push(rawMeta.addressLine2);
  }

  // Add city, province, barangay, postal code if available
  if (rawMeta.city || address.city) addressParts.push(rawMeta.city || address.city);
  if (rawMeta.barangay || address.barangay) addressParts.push(rawMeta.barangay || address.barangay);
  if (rawMeta.province || address.province) addressParts.push(rawMeta.province || address.province);
  if (rawMeta.postal_code || address.postalCode) addressParts.push(rawMeta.postal_code || address.postalCode);

  const fullAddress = addressParts.filter(Boolean).join(", ") || null;

  contentEl.innerHTML = `
    <div class="complainant-details">
      <div class="complainant-field">
        <div class="complainant-label">Name</div>
        <div class="complainant-value">${escapeHtml(name)}</div>
      </div>
      ${firstName || lastName ? `
      <div class="complainant-field">
        <div class="complainant-label">Full Name</div>
        <div class="complainant-value">${escapeHtml(`${firstName} ${lastName}`.trim() || name)}</div>
      </div>
      ` : ""}
      <div class="complainant-field">
        <div class="complainant-label">Email</div>
        <div class="complainant-value">
          <a href="mailto:${escapeHtml(email)}" class="complainant-link">${escapeHtml(email)}</a>
        </div>
      </div>
      <div class="complainant-field">
        <div class="complainant-label">Phone Number</div>
        <div class="complainant-value">
          ${phoneNumber ? `
          <a href="tel:${escapeHtml(phoneNumber)}" class="complainant-link">${escapeHtml(phoneNumber)}</a>
          ` : '<span style="color: #9ca3af;">Not provided</span>'}
        </div>
      </div>
      <div class="complainant-field">
        <div class="complainant-label">Address</div>
        <div class="complainant-value">
          ${fullAddress ? escapeHtml(fullAddress) : '<span style="color: #9ca3af;">Not provided</span>'}
        </div>
      </div>
      ${profile.id ? `
      <div class="complainant-field">
        <div class="complainant-label">User ID</div>
        <div class="complainant-value complainant-id">${escapeHtml(profile.id.substring(0, 8))}...</div>
      </div>
      ` : ""}
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
