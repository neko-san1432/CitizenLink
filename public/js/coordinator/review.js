// Basic initialization
// import { initMap, addMarker } from '../components/complaint/complaintMap.js';

document.addEventListener("DOMContentLoaded", async () => {
  // Wait for Sidebar/Auth
  setTimeout(initPage, 100);
});

async function initPage() {
  const complaintId = window.location.pathname.split("/").pop();
  const loadingEl = document.getElementById("loading");
  const contentEl = document.getElementById("complaint-content");
  const errorEl = document.getElementById("error-message");
  const errorText = document.getElementById("error-text");

  if (!complaintId) {
    showError("Invalid Complaint ID");
    return;
  }

  try {
    const response = await fetch(`/api/complaints/${complaintId}`);
    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.message || "Failed to load complaint details");
    }

    const complaint = data.data;
    renderComplaint(complaint);

    // Hide loading, show content
    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";

    // Initialize Map if location exists
    if (complaint.latitude && complaint.longitude) {
      setTimeout(() => {
        // Ensure Leaflet is loaded via the class if not already
        if (window.ComplaintMap) {
          const map = new window.ComplaintMap("location-map", {
            center: [complaint.latitude, complaint.longitude],
            zoom: 16
          });
          map.setLocation(
            complaint.latitude,
            complaint.longitude,
            complaint.location_text || "Complaint Location"
          );
        } else {
          console.error("ComplaintMap class not found");
        }
      }, 500);
    }

    // Status Update Listener
    const updateStatusBtn = document.getElementById("update-status-btn");
    if (updateStatusBtn) {
      updateStatusBtn.addEventListener("click", async () => {
        const newStatus = document.getElementById("status-select").value;
        const notes = document.getElementById("status-notes").value;
        const btnOriginal = updateStatusBtn.textContent;
        updateStatusBtn.textContent = "...";
        updateStatusBtn.disabled = true;

        try {
          const response = await fetch(`/api/complaints/${complaintId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: newStatus,
              notes
            })
          });
          const res = await response.json();

          if (res.success) {
            setText("complaint-status", formatStatus(newStatus));
            document.getElementById("status-notes").value = ""; // Clear notes
            alert("Status updated successfully");
            window.location.reload(); // Reload to show update in timeline/history
          } else {
            alert(res.message || "Failed to update status");
          }
        } catch (err) {
          console.error(err);
          alert("Error updating status");
        } finally {
          updateStatusBtn.textContent = btnOriginal;
          updateStatusBtn.disabled = false;
        }
      });
    }

    // Reject / Mark as False Listener
    const rejectBtn = document.getElementById("reject-btn");
    const rejectModal = document.getElementById("reject-modal");
    const rejectTypeSelect = document.getElementById("reject-type");
    const falseReasonContainer = document.getElementById("false-reason-container");
    const rejectFalseReason = document.getElementById("reject-false-reason");

    if (rejectBtn && rejectModal) {
      rejectBtn.addEventListener("click", () => {
        rejectModal.classList.add("active");
      });

      if (rejectTypeSelect) {
        rejectTypeSelect.addEventListener("change", () => {
          if (rejectTypeSelect.value === "false") {
            falseReasonContainer.style.display = "block";
            rejectFalseReason.required = true;
          } else {
            falseReasonContainer.style.display = "none";
            rejectFalseReason.required = false;
          }
        });
      }

      document.getElementById("cancel-reject-btn").addEventListener("click", () => {
        rejectModal.classList.remove("active");
      });

      document.getElementById("close-reject-modal").addEventListener("click", () => {
        rejectModal.classList.remove("active");
      });

      document.getElementById("reject-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const type = rejectTypeSelect.value;
        const reason = document.getElementById("reject-reason").value;
        const falseReason = rejectFalseReason.value;

        if (type === "false" && !falseReason) {
          return alert("Please select a reason for marking as false");
        }

        try {
          let response;
          if (type === "false") {
            // Mark as false logic
            response = await fetch(`/api/complaints/${complaintId}/mark-false`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reason: falseReason,
                notes: reason
              })
            });
          } else {
            // Standard rejection logic
            response = await fetch(`/api/complaints/${complaintId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "rejected",
                notes: reason
              })
            });
          }

          const res = await response.json();
          if (res.success) {
            alert(type === "false" ? "Complaint marked as false successfully" : "Complaint rejected successfully");
            window.location.reload();
          } else {
            alert(res.message || "Failed to process request");
          }
        } catch (err) {
          console.error(err);
          alert("Error processing request");
        }
      });
    }

  } catch (error) {
    console.error("Error fetching complaint:", error);
    showError(error.message);
  }
}

const WORKFLOW_STEPS = [
  { status: "submitted", label: "Submitted", description: "Complaint received" },
  { status: "verified", label: "Verified", description: "Being assessed/Verified" },
  { status: "action_taken", label: "Action Taken", description: "Action being taken" },
  { status: "resolved", label: "Resolved", description: "Resolution provided" }
];

function renderComplaint(complaint) {
  // Header Info
  setText("complaint-id-header", `#${complaint.id}`);

  // Resolve Category Name
  let catName = complaint.category || "GENERAL";
  if (complaint.categories && complaint.categories.name) {
    catName = complaint.categories.name;
  } else if (complaint.category_name) {
    catName = complaint.category_name;
  }
  setText("complaint-category-badge", catName);

  // Build "Category - Subcategory" heading
  const subName = complaint.subcategory || complaint.subtype || "";
  const catSubLabel = subName ? `${catName} - ${subName}` : catName;
  setText("complaint-cat-subcat", catSubLabel);

  // Meta Info
  const dateStr = new Date(complaint.submitted_at || complaint.created_at).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
  setText("submitted-date", dateStr);
  setText("complaint-status", formatStatus(complaint.workflow_status));

  // Status color class
  const statusEl = document.getElementById("complaint-status");
  if (statusEl) {
    statusEl.className = `complaint-status status-${(complaint.workflow_status || "pending").toLowerCase()}`;
  }

  setText("complaint-priority", complaint.priority || "Medium");
  const priorityEl = document.getElementById("complaint-priority");
  if (priorityEl) {
    priorityEl.className = `complaint-priority priority-${(complaint.priority || "medium").toLowerCase()}`;
  }

  // Details Mapping
  setText("complaint-type", complaint.category || complaint.type || "General");
  setText("complaint-subtype", (complaint.subcategory || complaint.subtype) ? ` • ${complaint.subcategory || complaint.subtype}` : "");
  setText("complaint-description", complaint.descriptive_su || complaint.description || "No description provided");
  setText("complaint-location", complaint.location_text || "No location details");

  // Reject Button visibility (vanish if verified or above)
  const wf = (complaint.workflow_status || "").toLowerCase();
  const rejectBtn = document.getElementById("reject-btn");
  if (rejectBtn) {
    const terminalOrProcessed = ["verified", "under_review", "action_taken", "resolved", "closed", "rejected", "cancelled"].includes(wf);
    rejectBtn.style.display = terminalOrProcessed ? "none" : "block";
  }

  // Complainant Info Panel
  const complainantInfo = document.getElementById("complainant-info-content");
  if (complainantInfo) {
    if (complaint.user) {
      complainantInfo.innerHTML = `
                <div class="complainant-details">
                    <div class="detail-row">
                        <span style="font-weight: 600; font-size: 0.9rem;">Name:</span>
                        <span>${complaint.user.first_name} ${complaint.user.last_name}</span>
                    </div>
                    <div class="detail-row">
                        <span style="font-weight: 600; font-size: 0.9rem;">Email:</span>
                        <span>${complaint.user.email}</span>
                    </div>
                    <div class="detail-row">
                        <span style="font-weight: 600; font-size: 0.9rem;">Phone:</span>
                        <span>${complaint.user.mobile_number || "N/A"}</span>
                    </div>
                </div>
            `;
    } else {
      complainantInfo.innerHTML = '<p class="text-gray-500 italic">Submitter information not available</p>';
    }
  }

  // Colors for badges
  const categoryBadge = document.getElementById("complaint-category-badge");
  if (categoryBadge) {
    categoryBadge.style.backgroundColor = getCategoryColor(complaint.category);
  }

  // Set initial status in dropdown
  const statusSelect = document.getElementById("status-select");
  if (statusSelect && complaint.workflow_status) {
    statusSelect.value = complaint.workflow_status;
  }

  renderTimeline(complaint);
}

function renderTimeline(complaint) {
  const timelineContainer = document.getElementById("timeline-items");
  if (!timelineContainer) return;

  const currentStatus = (complaint.workflow_status || "submitted").toLowerCase();
  const commentData = complaint.comment || {};
  const isRejected = currentStatus === "rejected";
  const isCancelled = currentStatus === "cancelled";

  // Map current status to UI steps
  let activeIndex = -1;
  let checkStatus = currentStatus;
  if (checkStatus === "pending") checkStatus = "submitted";
  if (checkStatus === "under_review" || checkStatus === "assigned") checkStatus = "verified";
  if (checkStatus === "in_progress" || checkStatus === "action_taken") checkStatus = "action_taken";
  if (checkStatus === "completed" || checkStatus === "closed") checkStatus = "resolved";

  activeIndex = WORKFLOW_STEPS.findIndex(s => s.status === checkStatus);

  let html = '<div class="stepper-wrapper" style="display: flex; flex-direction: column; gap: 16px;">';

  WORKFLOW_STEPS.forEach((step, index) => {
    const isActive = index <= activeIndex;
    const isCurrent = index === activeIndex;
    const stepData = commentData[step.status]; // Logic matches WORKFLOW_STEPS status

    let commentHtml = "";
    if (stepData && stepData.comment) {
      const dateStr = new Date(stepData.date).toLocaleDateString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });
      commentHtml = `
                <div class="step-comment-box" style="margin-top: 8px; padding: 8px; background: rgba(59, 130, 246, 0.05); border-left: 3px solid #3b82f6; border-radius: 4px; font-size: 0.85rem;">
                    <div style="font-weight: 600; color: #1e40af; display: flex; justify-content: space-between;">
                        <span>Update Note</span>
                        <span style="font-weight: 400; font-size: 0.75rem; color: #6b7280;">${dateStr}</span>
                    </div>
                    <div style="color: #374151; margin-top: 4px;">"${stepData.comment}"</div>
                </div>
            `;
    }

    html += `
            <div class="timeline-step-item" style="display: flex; gap: 12px;">
                <div class="step-indicator" style="display: flex; flex-direction: column; align-items: center;">
                    <div class="step-node" style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${isActive ? "#3b82f6" : "#e5e7eb"}; color: white; font-size: 0.75rem; font-weight: bold; z-index: 2;">
                        ${isActive ? "✓" : index + 1}
                    </div>
                    ${index < WORKFLOW_STEPS.length - 1 ? `
                        <div class="step-line" style="width: 2px; flex: 1; background: ${index < activeIndex ? "#3b82f6" : "#e5e7eb"}; margin: 4px 0;"></div>
                    ` : ""}
                </div>
                <div class="step-content" style="flex: 1; padding-bottom: ${index < WORKFLOW_STEPS.length - 1 ? "16px" : "0"};">
                    <div class="step-label" style="font-weight: 600; color: ${isActive ? "#1f2937" : "#9ca3af"};">${step.label}</div>
                    <div class="step-desc" style="font-size: 0.75rem; color: #6b7280;">${step.description}</div>
                    ${commentHtml}
                </div>
            </div>
        `;
  });

  // Handle terminal states (Rejected / Mark as False)
  if (isRejected || isCancelled) {
    const terminalKey = isRejected ? "rejected" : "cancelled";
    const terminalData = commentData[terminalKey];
    const label = isRejected ? "Rejected" : "Cancelled";
    const icon = isRejected ? "❌" : "🛑";

    let terminalCommentHtml = "";
    if (terminalData && (terminalData.comment || terminalData.reason)) {
      const comment = terminalData.comment || terminalData.reason;
      const dateStr = terminalData.date ? new Date(terminalData.date).toLocaleDateString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      }) : "";
      terminalCommentHtml = `
                <div class="step-comment-box" style="margin-top: 8px; padding: 8px; background: rgba(239, 68, 68, 0.05); border-left: 3px solid #ef4444; border-radius: 4px; font-size: 0.85rem;">
                    <div style="font-weight: 600; color: #991b1b; display: flex; justify-content: space-between;">
                        <span>${isRejected ? "Rejection Reason" : "Cancellation Reason"}</span>
                        <span style="font-weight: 400; font-size: 0.75rem; color: #6b7280;">${dateStr}</span>
                    </div>
                    <div style="color: #374151; margin-top: 4px;">"${comment}"</div>
                </div>
            `;
    }

    html += `
            <div class="timeline-step-item" style="display: flex; gap: 12px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #fee2e2;">
                <div class="step-indicator" style="display: flex; flex-direction: column; align-items: center;">
                    <div class="step-node" style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #ef4444; color: white; font-size: 1rem; z-index: 2;">
                        ${icon}
                    </div>
                </div>
                <div class="step-content" style="flex: 1;">
                    <div class="step-label" style="font-weight: 600; color: #b91c1c;">${label}</div>
                    ${terminalCommentHtml}
                </div>
            </div>
        `;
  }

  html += "</div>";
  timelineContainer.innerHTML = html;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showError(msg) {
  const loadingEl = document.getElementById("loading");
  const errorEl = document.getElementById("error-message");
  const errorText = document.getElementById("error-text");

  if (loadingEl) loadingEl.style.display = "none";
  if (errorEl) errorEl.style.display = "block";
  if (errorText) errorText.textContent = msg;
}

function formatStatus(status) {
  if (!status) return "Unknown";
  return status.replace(/_/g, " ").toUpperCase();
}

function getCategoryColor(category) {
  const colors = {
    "Infrastructure": "#3b82f6", // blue
    "Sanitation": "#10b981", // green
    "Environment": "#84cc16", // lime
    "Safety": "#ef4444", // red
    "Community": "#f59e0b", // amber
  };
  return colors[category] || "#6b7280"; // gray default
}
