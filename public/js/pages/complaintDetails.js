import showToast from "../components/toast.js";

export class complaintDetails {
  constructor(container = null, complaintId = null) {
    this.container = container;
    this.complaintId = complaintId;
    this.complaint = null;
    this.userRole = null;
    this.map = null;
    this.routingControl = null;
    this.userLocation = null;
    this.boundaryData = null;
    this.boundaryLayer = null;
    this.boundaryVisible = false;
    this.boundaryToggleButton = null;
    this.systemConfig = { legacyRolesEnabled: false }; // Default config
    this.init();
    // Cleanup map when page is unloaded
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }

  cleanup() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  getElement(id) {
    if (this.container) {
      return this.container.querySelector(`#${id}`);
    }
    return document.getElementById(id);
  }
  async init() {
    try {
      // Clean up any stuck modal overlays
      this.cleanupStuckModals();

      // Show loading spinner immediately
      this.showLoading();

      // Load system config
      try {
        const configResp = await fetch("/api/config");
        if (configResp.ok) {
          this.systemConfig = await configResp.json();
        }
      } catch (e) {
        console.warn("Failed to load config", e);
      }

      // Hide complaint details container initially to prevent showing dummy content
      const detailsContainer = this.getElement("complaint-details");
      if (detailsContainer) {
        detailsContainer.style.display = "none";
      }

      // Clear placeholder text immediately to prevent showing dummy content
      const descriptionEl = this.getElement("complaint-description");
      if (descriptionEl) {
        descriptionEl.textContent = "";
      }
      const catSubEl = this.getElement("complaint-cat-subcat");
      if (catSubEl) {
        catSubEl.textContent = "";
      }
      const idEl = document.getElementById("complaint-id");
      if (idEl) {
        idEl.textContent = "";
      }
      const statusEl = document.getElementById("complaint-status");
      if (statusEl) {
        statusEl.textContent = "";
      }
      const priorityEl = document.getElementById("complaint-priority");
      if (priorityEl) {
        priorityEl.textContent = "";
      }
      const locationEl = document.getElementById("complaint-location");
      if (locationEl) {
        locationEl.innerHTML = "";
      }
      const attachmentsEl = document.getElementById("complaint-attachments");
      if (attachmentsEl) {
        attachmentsEl.innerHTML = "";
      }
      const timelineEl = document.getElementById("timeline-items");
      if (timelineEl) {
        timelineEl.innerHTML = "";
      }

      // Use provided ID or get from URL
      if (!this.complaintId) {
        const pathParts = window.location.pathname.split("/");
        let complaintId = pathParts[pathParts.length - 1];
        // If the last part is 'complaint-details', try query parameter
        if (!complaintId || complaintId === "complaint-details" || complaintId === "review") {
          const urlParams = new URLSearchParams(window.location.search);
          complaintId = urlParams.get("id");
        }

        // If it's something like /review/UUID, the last part is the UUID
        if (!complaintId || complaintId === "complaint-details") {
          // Check if we are in /review/:id format
          if (pathParts.includes("review") || pathParts.includes("complaint-details")) {
            complaintId = pathParts[pathParts.indexOf("review") + 1] || pathParts[pathParts.indexOf("complaint-details") + 1];
          }
        }

        if (!complaintId) {
          throw new Error("Invalid complaint ID");
        }

        // Validate UUID format (basic check)
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(complaintId)) {
          throw new Error("Invalid complaint ID format");
        }
        this.complaintId = complaintId;
      }
      // Get user role
      this.userRole = await this.getUserRole();
      // Load complaint details
      await this.loadcomplaintDetails();
      // Setup role-specific UI only if complaint was successfully loaded
      if (this.complaint) {
        this.setupRoleSpecificUI();
      }
    } catch (error) {
      console.error("Error initializing complaint details:", error);
      this.showError(`Failed to load complaint details: ${error.message}`);
    }
  }
  // ... (lines 103-1900 skipped) ...
  setupRoleSpecificActionsV2() {
    const actionsContainer = document.getElementById("complaint-actions");
    if (!actionsContainer) return;
    // Return early if complaint is not loaded
    if (!this.complaint) return;
    const actions = [];

    // Universal Print Button for all roles
    actions.push({
      text: "Print / Export",
      class: "btn btn-secondary",
      action: "print-complaint"
    });

    switch (this.userRole) {
      case "lgu":
        // LGU staff can approve/reject if status is submitted/new
        if (this.complaint.workflow_status === "submitted" || this.complaint.workflow_status === "new") {
          actions.push(
            { text: "Approve", class: "btn btn-success", action: "approve" },
            { text: "Reject", class: "btn btn-danger", action: "reject" }
          );
        }
        // LGU Actions: Mark as Resolved (if verified/active)
        if (
          this.complaint.workflow_status === "verified" ||
          this.complaint.workflow_status === "under_review" ||
          this.complaint.workflow_status === "action_taken" ||
          this.complaint.workflow_status === "assigned"
        ) {
          actions.push({
            text: "Mark as Resolved",
            class: "btn btn-success",
            action: "mark-resolved",
          });
        }

        // 2. Reject complaint (if not already resolved/rejected)
        if (
          this.complaint.workflow_status !== "dresolved" &&
          this.complaint.workflow_status !== "completed" &&
          this.complaint.workflow_status !== "rejected"
        ) {
          actions.push({
            text: "Reject complaint",
            class: "btn btn-danger",
            action: "reject"
          });
        }

        // 3. Add Comment (Always available)
        actions.push({
          text: "Add Comment",
          class: "btn btn-secondary",
          action: "add-comment"
        });
        break;

      case "citizen":
        // Citizen Actions
        // REMOVED: Cancel complaint (Workflow simplification)

        // Show confirmation button when all assignments are complete and citizen hasn't confirmed
        if (this.shouldShowConfirmationButton()) {
          actions.push({
            text: "Confirm Resolution",
            class: "btn btn-success",
            action: "confirm-resolution",
          });
        }
        if (
          this.complaint.workflow_status !== "cancelled" &&
          this.complaint.workflow_status !== "resolved" &&
          this.complaint.workflow_status !== "closed" &&
          this.complaint.workflow_status !== "rejected"
        ) {
          actions.push({
            text: "Set Reminder",
            class: "btn btn-info",
            action: "remind",
          });
        }
        break;
    }
    // Hide Confirm Resolution if already resolved/completed
    const wf = (this.complaint.workflow_status || "").toLowerCase();
    const confirmedByCitizen = Boolean(this.complaint.confirmed_by_citizen);
    const filteredActions = actions.filter((a) => {
      if (a.action === "confirm-resolution") {
        if (wf === "completed" || confirmedByCitizen) return false;
      }
      if (a.action === "remind") {
        // Hide reminder when already resolved/completed or cancelled
        if (wf === "completed" || wf === "cancelled") return false;
      }
      return true;
    });
    actionsContainer.innerHTML = filteredActions
      .map(
        (action) => `
            <button type="button" class="${action.class}" data-action="${action.action}">
                ${action.text}
            </button>
        `
      )
      .join("");
    // Attach event listeners
    actionsContainer
      .querySelectorAll("button[data-action]")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const action = e.target.getAttribute("data-action");
          this.handleActionV2(action);
        });
      });
  }
  async handleActionV2(action) {
    switch (action) {
      case "approve":
        await this.approvecomplaint();
        break;
      case "reject":
        await this.rejectcomplaint();
        break;
      case "assign-officer":
        await this.assignToOfficer();
        break;
      case "mark-resolved":
        await this.markAsResolved();
        break;
      case "cancel":
        await this.cancelcomplaint();
        break;
      case "confirm-resolution":
        await this.confirmResolution();
        break;
      case "remind":
        await this.sendReminder();
        break;
      case "print-complaint":
        window.print();
        break;
    }
  }
  async getUserRole() {
    try {
      const response = await fetch("/api/user/role", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to get user role");
      }
      const data = await response.json();
      return data.data.role;
    } catch (error) {
      console.error("Error getting user role:", error);
      return "citizen"; // Default fallback
    }
  }
  async loadcomplaintDetails() {
    try {
      this.showLoading();
      const response = await fetch(`/api/complaints/${this.complaintId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!response.ok) {
        // Handle 404 specifically with a user-friendly message
        if (response.status === 404) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || "complaint not found";
          // Provide more context for 404 errors
          if (
            errorMsg.toLowerCase().includes("not found") ||
            errorMsg.toLowerCase().includes("does not exist")
          ) {
            throw new Error(
              "The complaint you are looking for does not exist or may have been deleted. Please check the complaint ID and try again."
            );
          }
          throw new Error(errorMsg);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load complaint");
      }
      this.complaint = data.data;
      // Load evidence/attachments separately
      await this.loadcomplaintEvidence();
      this.rendercomplaintDetails();
    } catch (error) {
      console.error("Error loading complaint details:", error);
      // Ensure complaint is null when load fails
      this.complaint = null;
      this.showError(`Failed to load complaint details: ${error.message}`);
    } finally {
      this.hideLoading();
    }
  }
  async loadcomplaintEvidence() {
    // Return early if complaint is not loaded
    if (!this.complaint) {
      console.warn("Cannot load complaint evidence: complaint is null");
      return;
    }
    // Skip evidence loading if we're getting SSL errors to prevent infinite redirects
    if (
      window.location.protocol === "https:" &&
      window.location.hostname === "localhost"
    ) {
      console.log("Skipping evidence loading due to HTTPS redirect issue");
      this.complaint.attachments = [];
      return;
    }
    try {
      // Use absolute HTTP URL to avoid any protocol issues
      const baseUrl = "http://localhost:3000";
      const response = await fetch(
        `${baseUrl}/api/complaints/${this.complaintId}/evidence`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          mode: "cors",
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.complaint.attachments = data.data || [];
        } else {
          console.log("Evidence API returned error:", data.message);
          this.complaint.attachments = [];
        }
      } else {
        console.log(
          "Evidence API request failed with status:",
          response.status
        );
        this.complaint.attachments = [];
      }
    } catch (error) {
      console.error("Error loading complaint evidence:", error);
      // If the error is due to HTTPS redirect or SSL issues, try with relative URL
      if (
        error.message.includes("SSL") ||
        error.message.includes("HTTPS") ||
        error.message.includes("ERR_SSL_PROTOCOL_ERROR")
      ) {
        try {
          console.log("Attempting fallback with relative URL...");
          const response = await fetch(
            `/api/complaints/${this.complaintId}/evidence`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              credentials: "include",
            }
          );
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              this.complaint.attachments = data.data || [];
              console.log("Fallback request successful");
            } else {
              this.complaint.attachments = [];
            }
          } else {
            this.complaint.attachments = [];
          }
        } catch (fallbackError) {
          console.error("Fallback request also failed:", fallbackError);
          this.complaint.attachments = [];
        }
      } else {
        this.complaint.attachments = [];
      }
    }
  }
  async rendercomplaintDetails() {
    const detailsContainer = this.getElement("complaint-details");
    if (!detailsContainer) return;
    // Return early if complaint is not loaded
    if (!this.complaint) {
      console.warn("Cannot render complaint details: complaint is null");
      return;
    }
    // Populate Category - Subcategory heading
    const catSubEl = this.getElement("complaint-cat-subcat");
    if (catSubEl) {
      let catName = this.complaint.category || "General";
      if (this.complaint.categories && this.complaint.categories.name) {
        catName = this.complaint.categories.name;
      } else if (this.complaint.category_name) {
        catName = this.complaint.category_name;
      }
      const subName = this.complaint.subcategory || this.complaint.subtype || "";
      catSubEl.textContent = subName ? `${catName} - ${subName}` : catName;
    }

    this.getElement(
      "complaint-id"
    ).textContent = `#${this.complaint.id.substring(0, 8)}`;

    // Category Badge
    const categoryBadge = this.getElement("complaint-category-badge");
    if (categoryBadge) {
      // Try to find category name from joined data or heuristic
      let catName = "complaint";
      if (this.complaint.categories && this.complaint.categories.name) {
        catName = this.complaint.categories.name;
      } else if (this.complaint.category_name) {
        catName = this.complaint.category_name;
      }
      categoryBadge.textContent = catName;
    }

    // Date
    const dateEl = this.getElement("complaint-date");
    if (dateEl && this.complaint.submitted_at) {
      const date = new Date(this.complaint.submitted_at);
      dateEl.textContent =
        `${date.toLocaleDateString()
        } ${
          date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    // Prefer workflow_status, then confirmation_status; map to user-friendly text
    const wf = (this.complaint.workflow_status || "").toLowerCase();
    let displayStatus;
    if (
      this.complaint.confirmation_status &&
      this.complaint.confirmation_status !== "pending"
    ) {
      displayStatus = this.complaint.confirmation_status;
    } else if (wf === "resolved" || wf === "completed") {
      displayStatus = "resolved";
    } else if (
      wf === "under_review" ||
      wf === "in_progress" ||
      wf === "assigned" ||
      wf === "verified" || // Mapping verified -> in progress/active bucket
      wf === "action_taken"
    ) {
      displayStatus = wf; // Pass through new statuses directly, class map will handle them
    } else if (wf === "cancelled") {
      displayStatus = "cancelled";
    } else if (wf === "rejected") {
      displayStatus = "rejected";
    } else if (wf === "submitted" || wf === "new") {
      displayStatus = "submitted";
    } else {
      displayStatus = this.complaint.status || "Unknown";
    }
    const statusClass = this.getStatusClass(displayStatus);
    this.getElement("complaint-status").textContent =
      this.getStatusDisplayText(displayStatus);
    this.getElement(
      "complaint-status"
    ).className = `complaint-status ${statusClass}`;
    this.getElement("complaint-priority").textContent =
      this.complaint.priority || "Medium";
    this.getElement(
      "complaint-priority"
    ).className = `complaint-priority priority-${(
      this.complaint.priority || "medium"
    ).toLowerCase()}`;
    this.getElement("complaint-description").textContent =
      this.complaint.description || "No description provided";
    // Display assignment progress if available
    this.displayAssignmentProgress();
    // Load and display confirmation message
    await this.loadConfirmationMessage();

    // Check for duplicates (LGU and super-admin only)
    const adminRoles = [
      "lgu",
      "super-admin",
    ];
    if (adminRoles.includes(this.userRole)) {
      this.checkDuplicateAlert();
    }

    // Populate location
    this.renderLocation();
    // Populate AI Analytics block
    this.renderAIAnalytics();
    // Populate complainant info (only for admin, officers, coordinators)
    this.renderComplainantInfo();
    // Populate attachments
    this.renderAttachments();
    // Populate timeline
    this.renderTimeline();

    // Setup Admin Merge Tools
    if (adminRoles.includes(this.userRole)) {
      this.setupAdminMergeTools();
    }

    // Show the details
    detailsContainer.style.display = "grid";
  }

  /**
   * Admin: Check and Alert for Duplicates
   */
  async checkDuplicateAlert() {
    try {
      const response = await fetch(
        `/api/complaints/${this.complaintId}/potential-duplicates`,
        {
          method: "GET",
        }
      );

      if (!response.ok) return;

      const { data } = await response.json();
      if (data && data.length > 0) {
        this.showDuplicateAlert(data);
      }
    } catch (e) {
      console.error("Duplicate check failed", e);
    }
  }

  showDuplicateAlert(duplicates) {
    const container = this.getElement("complaint-details");

    // Create Alert Box
    const alertBox = document.createElement("div");
    alertBox.className = "duplicate-alert-admin";
    alertBox.style.cssText = `
        background: #fff7ed; 
        border: 1px solid #fed7aa; 
        border-left: 4px solid #f97316; 
        padding: 1rem; 
        margin-bottom: 1rem; 
        border-radius: 8px;
        grid-column: 1 / -1;
      `;

    alertBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
                <h4 style="margin: 0 0 0.5rem 0; color: #9a3412; font-weight: 600;">⚠️ Potential Duplicates Detected</h4>
                <p style="margin: 0; font-size: 0.9rem; color: #7c2d12;">
                    We found <strong>${duplicates.length}</strong> other complaints that look similar to this one.
                    <br/>
                    Consider merging them to keep the system clean.
                </p>
            </div>
            <button id="btn-review-merge" style="
                background: #f97316; 
                color: white; 
                border: none; 
                padding: 0.5rem 1rem; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 0.9rem;
                font-weight: 500;
            ">Review & Merge</button>
        </div>
      `;

    // Insert at the very top of content
    container.insertBefore(alertBox, container.firstChild);

    document
      .getElementById("btn-review-merge")
      .addEventListener("click", () => {
        this.openMergeModal(duplicates);
      });
  }

  setupAdminMergeTools() {
    // Add "Merge" button to action header if not already there
    // This allows manual trigger even if alert is dismissed
    // Can be added to "complaint-actions" container
  }

  openMergeModal(duplicates) {
    // Create Modal
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);";

    const itemsHtml = duplicates
      .map(
        (d) => `
        <div class="merge-item" style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px; display: flex; gap: 10px; align-items: flex-start;">
            <input type="checkbox" class="merge-checkbox" value="${d.id
}" id="chk-${d.id}" style="margin-top: 4px;">
            <label for="chk-${d.id}" style="flex: 1; cursor: pointer;">
                <div style="font-weight: 600; color: #374151;">${d.title || "Untitled"
}</div>
                <div style="font-size: 0.85rem; color: #6b7280;">
                    ${new Date(d.submitted_at).toLocaleDateString()} • ${(
  d.distance * 1000
).toFixed(0)}m away
                </div>
                <div style="font-size: 0.85rem; color: #4b5563; margin-top: 4px;">
                    ${d.description
    ? `${d.description.substring(0, 60)  }...`
    : ""
}
                </div>
            </label>
        </div>
     `
      )
      .join("");

    modal.innerHTML = `
      <div style="background: white; width: 600px; max-height: 80vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
        <div style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; background: #fff7ed;">
            <h3 style="margin: 0; color: #9a3412;">Merge Duplicates</h3>
            <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #7c2d12;">
                Select complaints to merge into THIS complaint (<span style="font-family: monospace;">#${this.complaintId.substring(
    0,
    8
  )}</span>).
                <br/>
                Merged complaints will be closed and their upvotes transferred here.
            </p>
        </div>
        
        <div style="padding: 1.5rem; overflow-y: auto;">
            ${itemsHtml}
        </div>

        <div style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; background: #f9fafb; display: flex; justify-content: flex-end; gap: 10px;">
            <button id="btn-cancel-merge" style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="btn-confirm-merge" style="padding: 0.5rem 1rem; border: none; background: #ea580c; color: white; border-radius: 6px; cursor: pointer; font-weight: 500;">Merge Selected</button>
        </div>
      </div>
     `;

    document.body.appendChild(modal);

    document
      .getElementById("btn-cancel-merge")
      .addEventListener("click", () => modal.remove());

    document
      .getElementById("btn-confirm-merge")
      .addEventListener("click", async () => {
        const selected = Array.from(
          modal.querySelectorAll(".merge-checkbox:checked")
        ).map((cb) => cb.value);

        if (selected.length === 0) {
          showToast("warning", "Please select at least one complaint to merge.");
          return;
        }

        const btn = document.getElementById("btn-confirm-merge");
        btn.innerHTML = "Merging...";
        btn.disabled = true;

        try {
          const res = await fetch(
            `/api/complaints/${this.complaintId}/bulk-merge`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ childIds: selected }),
            }
          );

          if (!res.ok) throw new Error("Merge failed");

          showToast("complaints merged successfully", "success");
          modal.remove();

          // Reload page to see updated state (e.g. upvote count)
          setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
          console.error(e);
          showToast("Failed to merge complaints", "error");
          btn.innerHTML = "Merge Selected";
          btn.disabled = false;
        }
      });
  }
  renderAIAnalytics() {
    const aiSection = this.getElement("ai-analytics-section");
    const aiContent = this.getElement("ai-analytics-content");

    if (!aiSection || !aiContent) return;

    // We check if the complaint has intelligence data or an NLP generated urgency_level
    const intel = this.complaint.intelligence || {};
    const nlpCategory = typeof this.complaint.category === "string" && this.complaint.category.length > 3 ? this.complaint.category : null;

    // Determine if we have enough AI data to show the panel
    const hasAI = intel.confidence_score || intel.geo_verified !== undefined || intel.requires_immediate_action || (this.complaint.urgency_level && this.complaint.priority);

    if (!hasAI) {
      aiSection.style.display = "none";
      return;
    }

    let html = '<div class="flex flex-col gap-3">';

    // Confidence Score
    if (intel.confidence_score) {
      const score = Math.round(intel.confidence_score * 100);
      let colorClass = "text-green-600";
      if (score < 60) colorClass = "text-red-500";
      else if (score < 80) colorClass = "text-orange-500";

      html += `
        <div class="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
          <span class="text-xs text-gray-500 font-medium tracking-wide">AI CONFIDENCE</span>
          <span class="font-bold ${colorClass}">${score}%</span>
        </div>
      `;
    }

    // Urgency Check
    if (intel.requires_immediate_action || this.complaint.priority === "urgent") {
      html += `
        <div class="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded text-xs">
          <i class="fas fa-exclamation-triangle"></i>
          <span class="font-semibold">Immediate Action Recommended by AI</span>
        </div>
      `;
    }

    // Geo-verification
    if (intel.geo_verified !== undefined) {
      if (intel.geo_verified) {
        html += `
          <div class="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded text-xs">
            <i class="fas fa-map-marker-check"></i>
            <span>Location Verified by AI</span>
          </div>
        `;
      } else {
        html += `
          <div class="flex items-center gap-2 text-orange-600 bg-orange-50 p-2 rounded text-xs">
            <i class="fas fa-map-marker-exclamation"></i>
            <span>Location Unverified - Crosscheck Required</span>
          </div>
        `;
      }
    }

    // Metaphor Detection
    if (intel.metaphor_probability && intel.metaphor_probability > 0.5) {
      html += `
        <div class="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded text-xs">
          <i class="fas fa-comment-dots"></i>
          <span>Contains Figurative Language</span>
        </div>
      `;
    }

    // Display parsed category if it was categorized by NLP
    if (intel.auto_categorized || (intel.method === "nlp" && nlpCategory)) {
      html += `
        <div class="text-xs text-gray-400 mt-2 italic flex items-center gap-1">
          <i class="fas fa-robot text-[10px]"></i> Auto-categorized by D.R.I.M.S. NLP
        </div>
      `;
    }

    html += "</div>";

    aiContent.innerHTML = html;
    aiSection.style.display = "block";
  }

  renderComplainantInfo() {
    const complainantSection = this.getElement("complainant-section");
    const complainantInfo = this.getElement("complainant-info");
    if (!complainantSection || !complainantInfo) return;
    // Show complainant info only for LGU staff and super-admin
    const rolesThatCanSeeComplainant = [
      "lgu",
      "super-admin",
    ];
    const canSeeComplainant = rolesThatCanSeeComplainant.includes(
      this.userRole
    );
    if (canSeeComplainant && this.complaint.submitted_by_profile) {
      const profile = this.complaint.submitted_by_profile;
      const name = profile.name || profile.email || "Unknown";
      const email = profile.email || "Not provided";
      const firstName = profile.firstName || "";
      const lastName = profile.lastName || "";

      // Get phone number from multiple possible fields
      const rawMeta = profile.raw_user_meta_data || {};
      const phoneNumber =
        profile.mobileNumber ||
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
      if (
        rawMeta.addressLine1 &&
        !addressParts.includes(rawMeta.addressLine1)
      ) {
        addressParts.push(rawMeta.addressLine1);
      }
      if (
        rawMeta.addressLine2 &&
        !addressParts.includes(rawMeta.addressLine2)
      ) {
        addressParts.push(rawMeta.addressLine2);
      }

      // Add city, province, barangay, postal code if available
      if (rawMeta.city || address.city)
        addressParts.push(rawMeta.city || address.city);
      if (rawMeta.barangay || address.barangay)
        addressParts.push(rawMeta.barangay || address.barangay);
      if (rawMeta.province || address.province)
        addressParts.push(rawMeta.province || address.province);
      if (rawMeta.postal_code || address.postalCode)
        addressParts.push(rawMeta.postal_code || address.postalCode);

      const fullAddress = addressParts.filter(Boolean).join(", ") || null;

      complainantInfo.innerHTML = `
                <div class="complainant-details">
                    <div class="complainant-field">
                        <span class="field-label">Name:</span>
                        <span class="field-value">${this.escapeHtml(
    name
  )}</span>
                    </div>
                    ${firstName || lastName
    ? `
                    <div class="complainant-field">
                        <span class="field-label">Full Name:</span>
                        <span class="field-value">${this.escapeHtml(
    `${firstName} ${lastName}`.trim() || name
  )}</span>
                    </div>
                    `
    : ""
}
                    <div class="complainant-field">
                        <span class="field-label">Email:</span>
                        <span class="field-value">
                            <a href="mailto:${this.escapeHtml(
    email
  )}" class="complainant-link">${this.escapeHtml(
  email
)}</a>
                        </span>
                    </div>
                    <div class="complainant-field">
                        <span class="field-label">Phone Number:</span>
                        <span class="field-value">
                            ${phoneNumber
    ? `
                            <a href="tel:${this.escapeHtml(
    phoneNumber
  )}" class="complainant-link">${this.escapeHtml(
  phoneNumber
)}</a>
                            `
    : '<span style="color: #9ca3af;">Not provided</span>'
}
                        </span>
                    </div>
                    <div class="complainant-field">
                        <span class="field-label">Address:</span>
                        <span class="field-value">
                            ${fullAddress
    ? this.escapeHtml(fullAddress)
    : '<span style="color: #9ca3af;">Not provided</span>'
}
                        </span>
                    </div>
                </div>
            `;
      complainantSection.style.display = "block";
    } else {
      complainantSection.style.display = "none";
    }
  }
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  getStatusClass(status) {
    const statusMap = {
      // Legacy / Standard
      pending: "status-pending",
      waiting_for_responders: "status-warning",
      waiting_for_complainant: "status-info",
      confirmed: "status-success",
      disputed: "status-danger",
      "in progress": "status-info",
      resolved: "status-success",
      cancelled: "status-secondary",
      rejected: "status-danger",
      // New Workflow Statuses
      submitted: "status-pending",
      verified: "status-info",
      under_review: "status-warning",
      action_taken: "status-success", // Or info?
      // Legacy mapping
      new: "status-pending",
      assigned: "status-info",
      in_progress: "status-warning",
      completed: "status-success"
    };
    return statusMap[status] || "status-pending";
  }
  getStatusDisplayText(status) {
    const displayMap = {
      pending: "Pending",
      waiting_for_responders: "Waiting for LGU Responders",
      waiting_for_complainant: "Ready for Your Confirmation",
      confirmed: "Resolution Confirmed by You",
      disputed: "Disputed",
      "in progress": "In Progress",
      resolved: "Resolved",
      cancelled: "Cancelled",
      rejected: "Rejected",
      // New Workflow Statuses
      submitted: "Submitted",
      verified: "Verified",
      under_review: "Under Review",
      action_taken: "Action Taken",
      // Legacy
      new: "New complaint",
      assigned: "Assigned to Coordinator",
      completed: "Completed - Awaiting Confirmation",
      in_progress: "In Progress"
    };
    return displayMap[status] || status || "Unknown";
  }
  displayAssignmentProgress() {
    const progress = this.complaint.assignment_progress;
    if (!progress || progress.totalAssignments === 0) {
      return; // No assignments to show progress for
    }
    // Find or create assignment progress element
    let progressElement = document.getElementById("assignment-progress");
    if (!progressElement) {
      const statusElement = document.getElementById("complaint-status");
      if (statusElement && statusElement.parentNode) {
        progressElement = document.createElement("div");
        progressElement.id = "assignment-progress";
        progressElement.className = "assignment-progress";
        statusElement.parentNode.insertBefore(
          progressElement,
          statusElement.nextSibling
        );
      }
    }
    if (progressElement) {
      const isCompleted =
        progress.completedAssignments === progress.totalAssignments;
      const progressBar = `
                <div class="progress-container">
                    <div class="progress-info">
                        <span class="progress-text">${progress.progressText
}</span>
                        <span class="progress-percentage">${progress.progressPercentage
}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${isCompleted ? "completed" : ""
}"
                             style="width: ${progress.progressPercentage
}%"></div>
                    </div>
                </div>
            `;
      progressElement.innerHTML = progressBar;
    }
  }
  async loadConfirmationMessage() {
    try {
      const response = await fetch(
        `/api/complaints/${this.complaintId}/confirmation-message`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.message) {
          this.displayConfirmationMessage(data.data.message);
        }
      }
    } catch (error) {
      console.error("Error loading confirmation message:", error);
    }
  }
  shouldShowConfirmationButton() {
    // Match backend validation logic closely, but do not block on delayed confirmation_status updates
    // Show confirmation button ONLY after coordinator has assigned to officers
    // 1. Check if citizen already confirmed
    if (this.complaint.confirmed_by_citizen) {
      return false;
    }
    // 2. Check workflow status - show button after coordinator assigns to officers
    const coordinatorAssignedStatuses = [
      "assigned",
      "in_progress",
      "pending_approval",
      "completed",
    ];
    if (!coordinatorAssignedStatuses.includes(this.complaint.workflow_status)) {
      return false;
    }
    // 3. If assignments exist and all assignments are complete, show the button regardless of confirmation_status
    const progress = this.complaint.assignment_progress;
    if (progress && progress.totalAssignments > 0) {
      if (progress.completedAssignments === progress.totalAssignments) {
        return true;
      }
      // If not all completed, fall through to stricter checks
      return false;
    }
    // 4. Fallback to confirmation_status gate when no assignment info is available
    const validConfirmationStatuses = [
      "waiting_for_complainant",
      "confirmed",
      "disputed",
      "pending",
    ];
    if (
      !validConfirmationStatuses.includes(this.complaint.confirmation_status)
    ) {
      return false;
    }
    return true;
  }
  displayConfirmationMessage(message) {
    // Find or create confirmation status element
    let confirmationElement = document.getElementById("confirmation-status");
    if (!confirmationElement) {
      // Create confirmation status element after the complaint status
      const statusElement = document.getElementById("complaint-status");
      if (statusElement && statusElement.parentNode) {
        confirmationElement = document.createElement("div");
        confirmationElement.id = "confirmation-status";
        confirmationElement.className = "confirmation-status";
        statusElement.parentNode.insertBefore(
          confirmationElement,
          statusElement.nextSibling
        );
      }
    }
    if (confirmationElement) {
      confirmationElement.textContent = message;
      // Add appropriate styling based on message content and complaint status
      let cssClass = "confirmation-status";
      if (
        message.includes("Please confirm") ||
        message.includes("Waiting for your")
      ) {
        cssClass += " action-required";
      } else if (
        message.includes("confirmed") ||
        message.includes("Completed")
      ) {
        cssClass += " confirmed";
      } else if (message.includes("Waiting for")) {
        cssClass += " waiting";
      } else {
        cssClass += " info";
      }
      confirmationElement.className = cssClass;
    }
  }
  renderLocation() {
    const locationContainer = this.getElement("complaint-location");
    if (!locationContainer) return;

    // Check if we have valid coordinates
    const hasCoordinates =
      this.complaint.latitude !== null &&
      this.complaint.longitude !== null &&
      !isNaN(parseFloat(this.complaint.latitude)) &&
      !isNaN(parseFloat(this.complaint.longitude));

    // Check if we have text
    const hasText = this.complaint.location_text && this.complaint.location_text.trim().length > 0;

    if (hasText || hasCoordinates) {
      const canUseBoundaryToggle = this.canUseBoundaryToggle();

      let addressHtml = "";
      if (hasText) {
        addressHtml = `<div class="location-address">${this.complaint.location_text}</div>`;
      } else {
        addressHtml = `<div class="location-address" style="color: #6b7280; font-style: italic;">Location pinned on map</div>`;
      }

      locationContainer.innerHTML = `
        ${addressHtml}
        ${hasCoordinates
    ? `
          <div class="location-coordinates" style="color: #6b7280; font-size: 0.85rem; margin-top: 4px;">
              ${parseFloat(this.complaint.latitude).toFixed(6)}, ${parseFloat(this.complaint.longitude).toFixed(6)}
          </div>
          <div class="location-actions" style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
            ${canUseBoundaryToggle
    ? `
              <button id="toggle-boundary-btn" class="btn btn-secondary btn-xs" type="button" style="font-size: 0.7rem; padding: 2px 8px;">
                Show Boundary
              </button>
            `
    : ""
}
          </div>
        `
    : ""
}
      `;

      // Setup Full Map listener if button exists
      const fullMapBtn = this.getElement("view-on-map-btn") || this.getElement("show-map-modal-btn");
      if (fullMapBtn) {
        fullMapBtn.onclick = () => this.showMapModal();
      }

      // Initialize map if coordinates are available
      if (hasCoordinates) {
        // slight delay to ensure container size
        setTimeout(() => {
          this.initializeMap();
          if (this.canUseBoundaryToggle()) {
            this.setupBoundaryToggle();
          }
          // Setup map modal button
          const mapModalBtn = this.getElement("show-map-modal-btn");
          if (mapModalBtn) {
            mapModalBtn.addEventListener("click", () => {
              this.showMapModal();
            });
          }
        }, 50);
      }
    } else {
      locationContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; color: #9ca3af; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📍</div>
            <p>No location information provided</p>
        </div>
      `;
    }
  }

  canUseBoundaryToggle() {
    const allowedRoles = new Set([
      "lgu",
      "super-admin",
    ]);
    return allowedRoles.has(this.userRole);
  }

  setupBoundaryToggle() {
    const toggleBtn = document.getElementById("toggle-boundary-btn");
    this.boundaryToggleButton = toggleBtn;
    if (!toggleBtn) return;

    this.updateBoundaryToggleText();

    toggleBtn.addEventListener("click", async () => {
      if (toggleBtn.disabled) return;
      toggleBtn.disabled = true;
      try {
        await this.handleBoundaryToggle();
      } finally {
        toggleBtn.disabled = false;
      }
    });
  }

  updateBoundaryToggleText() {
    if (!this.boundaryToggleButton) return;
    const label = this.boundaryVisible
      ? "Hide Digos City Boundary"
      : "Show Digos City Boundary";
    this.boundaryToggleButton.textContent = label;
    this.boundaryToggleButton.setAttribute(
      "aria-pressed",
      this.boundaryVisible ? "true" : "false"
    );
  }

  async handleBoundaryToggle() {
    if (!this.map) {
      showToast(
        "Map is still loading. Please try again in a moment.",
        "warning"
      );
      return;
    }

    if (!this.boundaryLayer) {
      try {
        await this.ensureBoundaryData();
        this.boundaryLayer = this.createBoundaryLayer(this.map);
      } catch (error) {
        console.error(
          "[COMPLAINT_DETAILS] Failed to prepare boundary layer:",
          error
        );
        showToast(error.message || "Unable to load city boundary.", "error");
        return;
      }

      if (!this.boundaryLayer) {
        showToast("Boundary data is unavailable for this map.", "error");
        return;
      }
    }

    if (this.boundaryVisible) {
      if (this.map.hasLayer(this.boundaryLayer)) {
        this.map.removeLayer(this.boundaryLayer);
      }
      this.boundaryVisible = false;
      showToast("Digos City boundary hidden.", "info");
    } else {
      this.boundaryLayer.addTo(this.map);
      this.boundaryVisible = true;
      showToast("Digos City boundary displayed.", "success");
    }

    this.updateBoundaryToggleText();
  }

  async ensureBoundaryData() {
    if (Array.isArray(this.boundaryData) && this.boundaryData.length > 0) {
      return this.boundaryData;
    }

    const response = await fetch("/api/boundaries");
    if (!response.ok) {
      throw new Error("Failed to load Digos City boundary data.");
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Digos City boundary data is not available.");
    }

    this.boundaryData = data.filter((item) => item && item.geojson);
    if (this.boundaryData.length === 0) {
      throw new Error("Boundary geo data is missing.");
    }

    return this.boundaryData;
  }

  createBoundaryLayer(_map) {
    if (!Array.isArray(this.boundaryData) || this.boundaryData.length === 0) {
      return null;
    }

    const layerGroup = L.layerGroup();
    this.boundaryData.forEach((barangay) => {
      if (!barangay?.geojson) return;
      const geoLayer = L.geoJSON(barangay.geojson, {
        style: {
          color: "#3b82f6",
          weight: 1.5,
          opacity: 0.8,
          dashArray: "6, 4",
          fillOpacity: 0,
        },
        interactive: false,
      });

      if (barangay.name) {
        geoLayer.bindTooltip(barangay.name, {
          permanent: false,
          direction: "center",
          className: "boundary-tooltip",
          interactive: false,
        });
      }

      geoLayer.addTo(layerGroup);
    });

    return layerGroup;
  }

  showMapModal() {
    if (!this.complaint.latitude || !this.complaint.longitude) {
      showToast("warning", "No coordinates available for this complaint");
      return;
    }

    // Remove existing modal if present
    const existingModal = document.getElementById("map-modal");
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal overlay
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.id = "map-modal";
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 90vw; max-height: 90vh; width: 800px; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); display: flex; flex-direction: column; overflow: hidden;">
        <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb;">
          <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: #1f2937;">📍 complaint Location</h2>
          <button class="modal-close" id="close-map-modal" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280; padding: 0.25rem; width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; border-radius: 4px;">&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.5rem; flex: 1; overflow-y: auto;">
          <div id="modal-map" style="width: 100%; height: 500px; border-radius: 8px; margin-bottom: 1rem;"></div>
          <div style="margin-top: 10px; padding: 1rem; background: #f9fafb; border-radius: 8px;">
            <div style="margin-bottom: 0.5rem;"><strong>Address:</strong> ${this.complaint.location_text || "N/A"
}</div>
            <div><strong>Coordinates:</strong> ${this.complaint.latitude}, ${this.complaint.longitude
}</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close button handler
    const closeBtn = document.getElementById("close-map-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        modal.remove();
      });
      // Add hover effect
      closeBtn.addEventListener("mouseenter", () => {
        closeBtn.style.background = "#f3f4f6";
        closeBtn.style.color = "#374151";
      });
      closeBtn.addEventListener("mouseleave", () => {
        closeBtn.style.background = "none";
        closeBtn.style.color = "#6b7280";
      });
    }

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === "Escape" && document.getElementById("map-modal")) {
        modal.remove();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);

    // Initialize map in modal
    setTimeout(async () => {
      try {
        if (typeof L === "undefined") {
          await this.loadLeaflet();
        }
        const mapContainer = document.getElementById("modal-map");
        if (!mapContainer) return;

        const lat = parseFloat(this.complaint.latitude);
        const lng = parseFloat(this.complaint.longitude);

        if (isNaN(lat) || isNaN(lng)) {
          mapContainer.innerHTML = "<p>Invalid coordinates</p>";
          return;
        }

        const map = L.map("modal-map").setView([lat, lng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map);

        // Load and display Digos City boundaries in modal
        try {
          const boundaryResponse = await fetch("/api/boundaries");
          if (boundaryResponse.ok) {
            const brgyData = await boundaryResponse.json();
            if (Array.isArray(brgyData)) {
              // Add each barangay boundary to the map
              brgyData.forEach((barangay) => {
                if (barangay.geojson) {
                  const geojsonLayer = L.geoJSON(barangay.geojson, {
                    style: {
                      color: "#3b82f6",
                      weight: 1.5,
                      opacity: 0.6,
                      fillOpacity: 0,
                      fillColor: "transparent",
                      dashArray: "5, 5",
                      interactive: false,
                    },
                    interactive: false,
                    onEachFeature(feature, layer) {
                      // Disable all interactions to prevent black box on click
                      layer.options.interactive = false;
                      layer.off("click");
                      layer.off("mouseover");
                      layer.off("mouseout");

                      if (barangay.name) {
                        layer.bindTooltip(barangay.name, {
                          permanent: false,
                          direction: "center",
                          className: "boundary-tooltip",
                          interactive: false,
                        });
                      }
                    },
                  });
                  geojsonLayer.addTo(map);
                }
              });
            }
          }
        } catch (error) {
          console.warn(
            "[COMPLAINT_DETAILS] Failed to load boundaries in modal:",
            error
          );
        }

        // Add marker
        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(
            `<strong>${this.complaint.title || "complaint"}</strong><br>${this.complaint.location_text || "Location pinned on map"
            }`
          )
          .openPopup();
      } catch (error) {
        console.error(
          "[COMPLAINT_DETAILS] Error initializing modal map:",
          error
        );
        const mapContainer = document.getElementById("modal-map");
        if (mapContainer) {
          mapContainer.innerHTML = "<p>Error loading map</p>";
        }
      }
    }, 100);
  }

  async initializeMap() {
    // Wait a bit for the DOM to be ready
    const mapContainer = document.getElementById("complaint-map");
    if (!mapContainer) {
      console.warn("[COMPLAINT_DETAILS] Map container not found");
      return;
    }

    try {
      // Ensure Leaflet is loaded
      if (typeof L === "undefined") {
        await this.loadLeaflet();
      }

      // Wait for container to have dimensions
      let attempts = 0;
      while (
        (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) &&
        attempts < 10
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
        console.warn("[COMPLAINT_DETAILS] Map container has no dimensions");
        return;
      }

      // Validate coordinates
      const lat = parseFloat(this.complaint.latitude);
      const lng = parseFloat(this.complaint.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        console.warn("[COMPLAINT_DETAILS] Invalid coordinates:", { lat, lng });
        mapContainer.innerHTML = "<p>Invalid coordinates provided</p>";
        return;
      }

      // Initialize the map

      if (
        this.boundaryLayer &&
        this.map &&
        this.map.hasLayer(this.boundaryLayer)
      ) {
        this.map.removeLayer(this.boundaryLayer);
      }
      this.boundaryLayer = null;
      this.boundaryVisible = false;
      this.updateBoundaryToggleText();

      const map = L.map("complaint-map", {
        zoomControl: true,
        preferCanvas: false,
      }).setView([lat, lng], 15);

      // Add OpenStreetMap tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Add a marker for the complaint location
      const complaintMarker = L.marker([lat, lng]).addTo(map);

      // Add popup with complaint information
      complaintMarker
        .bindPopup(
          `
          <div class="map-popup">
          <h4>${this.escapeHtml(
    this.complaint.title || "complaint Location"
  )}</h4>
          <p><strong>Address:</strong> ${this.escapeHtml(
    this.complaint.location_text || "Location pinned on map"
  )}</p>
          <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(
  6
)}</p>
          </div>
                `
        )
        .openPopup();

      // Store map reference for potential cleanup
      this.map = map;
      this.updateBoundaryToggleText();

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 200);
    } catch (error) {
      console.error("[COMPLAINT_DETAILS] Error initializing map:", error);
      const mapContainer = document.getElementById("complaint-map");
      if (mapContainer) {
        // UI-01 FIX: Use textContent to prevent XSS
        mapContainer.textContent = `Unable to load map. Error: ${error.message}`;
      }
    }
  }

  async loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (typeof L !== "undefined") {
        resolve();
        return;
      }

      // Check if Leaflet CSS is loaded
      if (!document.querySelector('link[href*="leaflet"]')) {
        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        cssLink.integrity =
          "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        cssLink.crossOrigin = "";
        document.head.appendChild(cssLink);
      }

      // Load Leaflet JS
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Leaflet"));
      document.head.appendChild(script);
    });
  }

  addRouteControls(map) {
    // Only show route controls for LGU users
    if (this.userRole !== "lgu") {
      return;
    }
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      console.log("Geolocation not supported, skipping route controls");
      return;
    }
    // Create control container
    const routeControlContainer = L.control({ position: "topright" });
    routeControlContainer.onAdd = function (_map) {
      const div = L.DomUtil.create("div", "route-controls");
      div.innerHTML = `
                     <div class="route-control-panel">
                         <h4>Route Options</h4>
                         <button id="get-route-btn" class="route-btn">
                             <i class="icon-navigation"></i> Get Route
                         </button>
                         <button id="clear-route-btn" class="route-btn" style="display: none;">
                             <i class="icon-close"></i> Clear Route
                         </button>
                         <div id="route-info" class="route-info" style="display: none;">
                             <p id="route-distance"></p>
                             <p id="route-duration"></p>
                         </div>
                         <div id="manual-location" class="manual-location" style="display: none;">
                             <p>Location not available. You can still view the complaint location on the map.</p>
                         </div>
                </div>
            `;
      return div;
    };
    routeControlContainer.addTo(map);
    // Add event listeners with error handling
    const getRouteBtn = document.getElementById("get-route-btn");
    const clearRouteBtn = document.getElementById("clear-route-btn");
    if (getRouteBtn) {
      getRouteBtn.addEventListener("click", () => {
        this.getUserLocationAndShowRoute(map);
      });
    }
    if (clearRouteBtn) {
      clearRouteBtn.addEventListener("click", () => {
        this.clearRoute();
      });
    }
  }
  getUserLocationAndShowRoute(map) {
    if (!navigator.geolocation) {
      console.log("Geolocation is not supported by this browser");
      showToast("Geolocation is not supported by this browser.", "error");
      return;
    }

    // Most mobile browsers require HTTPS for geolocation when not on localhost.
    // Avoid repeated failures that feel like a loop.
    if (!window.isSecureContext) {
      const host = window.location.hostname;
      const isLocalhost = host === "localhost" || host === "127.0.0.1";
      if (!isLocalhost) {
        showToast(
          "Location requires HTTPS on most phones. Open this page over HTTPS or use manual map viewing.",
          "error"
        );
        const manualLocation = document.getElementById("manual-location");
        if (manualLocation) {
          manualLocation.style.display = "block";
        }
        return;
      }
    }
    const getRouteBtn = document.getElementById("get-route-btn");
    const clearRouteBtn = document.getElementById("clear-route-btn");
    const routeInfo = document.getElementById("route-info");
    if (getRouteBtn) {
      getRouteBtn.textContent = "Getting Location...";
      getRouteBtn.disabled = true;
    }
    // Check if geolocation is available and not blocked
    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "denied") {
            console.log("Geolocation permission denied");
            showToast(
              "Location access is denied. Please enable location permissions in your browser settings.",
              "error"
            );
            if (getRouteBtn) {
              getRouteBtn.textContent = "Get Route";
              getRouteBtn.disabled = false;
            }
            // Show manual location message
            const manualLocation = document.getElementById("manual-location");
            if (manualLocation) {
              manualLocation.style.display = "block";
            }
            return;
          }
          this.attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo);
        })
        .catch(() => {
          // Fallback if permissions API is not supported
          this.attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo);
        });
    } else {
      // Fallback if permissions API is not supported
      this.attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo);
    }
  }
  attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location obtained successfully");
        this.userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        this.showRoute(map);
        if (getRouteBtn) {
          getRouteBtn.textContent = "Update Route";
          getRouteBtn.disabled = false;
        }
        if (clearRouteBtn) clearRouteBtn.style.display = "inline-block";
        if (routeInfo) routeInfo.style.display = "block";
        showToast("Location obtained successfully!", "success");
      },
      (error) => {
        console.error("Error getting location:", error);
        let errorMessage = "Unable to get your location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage +=
              "Location access was denied. Please enable location permissions in your browser settings and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage +=
              "Location information is unavailable. This might be due to GPS being disabled, poor signal, or browser security policies.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out. Please try again.";
            break;
          default:
            errorMessage += "An unknown error occurred. Please try again.";
            break;
        }
        showToast(errorMessage, "error");
        if (getRouteBtn) {
          getRouteBtn.textContent = "Get Route";
          getRouteBtn.disabled = false;
        }
        // Show manual location message
        const manualLocation = document.getElementById("manual-location");
        if (manualLocation) {
          manualLocation.style.display = "block";
        }
      },
      {
        enableHighAccuracy: false, // Changed to false for better compatibility
        timeout: 10000, // Reduced timeout
        maximumAge: 60000, // 1 minute
      }
    );
  }
  showRoute(map) {
    if (
      !this.userLocation ||
      !this.complaint.latitude ||
      !this.complaint.longitude
    ) {
      return;
    }
    // Clear existing route
    this.clearRoute();
    try {
      // Create routing control
      this.routingControl = L.Routing.control({
        waypoints: [
          L.latLng(this.userLocation.lat, this.userLocation.lng),
          L.latLng(this.complaint.latitude, this.complaint.longitude),
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        createMarker: function (i, waypoint, _n) {
          // Custom markers
          if (i === 0) {
            // User location marker
            return L.marker(waypoint.latLng, {
              icon: L.divIcon({
                className: "user-location-marker",
                html: '<div class="marker-icon user-marker">📍</div>',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              }),
            }).bindPopup("Your Location");
          }
          // complaint location marker
          return L.marker(waypoint.latLng, {
            icon: L.divIcon({
              className: "complaint-location-marker",
              html: '<div class="marker-icon complaint-marker">🚨</div>',
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            }),
          }).bindPopup(`
                            <div class="map-popup">
                                <h4>${this.complaint.title || "complaint Location"
}</h4>
                                <p><strong>Address:</strong> ${this.complaint.location_text
}</p>
                            </div>
                        `);
        }.bind(this),
        lineOptions: {
          styles: [
            {
              color: "#3b82f6",
              weight: 6,
              opacity: 0.8,
            },
          ],
        },
      }).addTo(map);
      // Listen for route calculation
      this.routingControl.on("routesfound", (e) => {
        const { routes } = e;
        const { summary } = routes[0];
        // Update route info
        const distanceEl = document.getElementById("route-distance");
        const durationEl = document.getElementById("route-duration");
        if (distanceEl) {
          distanceEl.textContent = `Distance: ${(
            summary.totalDistance / 1000
          ).toFixed(2)} km`;
        }
        if (durationEl) {
          durationEl.textContent = `Duration: ${Math.round(
            summary.totalTime / 60
          )} minutes`;
        }
        showToast("Route calculated successfully!", "success");
      });
      this.routingControl.on("routingerror", (e) => {
        console.error("Routing error:", e);
        showToast("Unable to calculate route. Please try again.", "error");
      });
    } catch (error) {
      console.error("Error creating route:", error);
      showToast("Error creating route. Please try again.", "error");
    }
  }
  clearRoute() {
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }
    const clearRouteBtn = document.getElementById("clear-route-btn");
    const routeInfo = document.getElementById("route-info");
    if (clearRouteBtn) clearRouteBtn.style.display = "none";
    if (routeInfo) routeInfo.style.display = "none";
  }
  renderAttachments() {
    const attachmentsContainer = this.getElement(
      "complaint-attachments"
    );
    if (!attachmentsContainer) return;
    const attachments = this.complaint.attachments || [];
    // Separate attachments by type
    const initialEvidence = attachments.filter((att) => att.type === "initial");
    const completionEvidence = attachments.filter(
      (att) => att.type === "completion"
    );
    if (attachments.length === 0) {
      attachmentsContainer.innerHTML = "<p>No attachments</p>";
      return;
    }
    let html = "";
    // Render Initial Evidence section
    if (initialEvidence.length > 0) {
      html += `
                <div class="evidence-section">
                    <h4 class="evidence-type-title">📎 Initial Evidence (Submitted with complaint)</h4>
                    <div class="evidence-list">
                        ${initialEvidence
    .map(
      (attachment) => `
                            <a href="${attachment.url
}" class="attachment-item" target="_blank" rel="noopener noreferrer">
                                <span class="attachment-icon">📎</span>
                                <span class="attachment-name">${attachment.name || "Attachment"
}</span>
                                <span class="attachment-size">${this.formatFileSize(
    attachment.size || 0
  )}</span>
                            </a>
                        `
    )
    .join("")}
                    </div>
                </div>
            `;
    }

    // Render Completion Evidence section
    if (completionEvidence.length > 0) {
      html += `
                <div class="evidence-section">
                    <h4 class="evidence-type-title">✅ Completion Evidence (Uploaded by Officers/Admins)</h4>
                    <div class="evidence-list">
                        ${completionEvidence
    .map(
      (attachment) => `
                            <a href="${attachment.url
}" class="attachment-item completion-evidence" target="_blank" rel="noopener noreferrer">
                                <span class="attachment-icon">✅</span>
                                <span class="attachment-name">${attachment.name || "Attachment"
}</span>
                                <span class="attachment-size">${this.formatFileSize(
    attachment.size || 0
  )}</span>
                            </a>
                        `
    )
    .join("")}
                    </div>
                </div>
            `;
    }

    // If no attachments categorized, show all
    if (html === "") {
      html = attachments
        .map(
          (attachment) => `
                <a href="${attachment.url
}" class="attachment-item" target="_blank" rel="noopener noreferrer">
                    <span class="attachment-icon">📎</span>
                    <span class="attachment-name">${attachment.name || "Attachment"
}</span>
                    <span class="attachment-size">${this.formatFileSize(
    attachment.size || 0
  )}</span>
                </a>
            `
        )
        .join("");
    }
    attachmentsContainer.innerHTML = html;
  }
  formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }
  async renderTimeline() {
    const timelineContainer = this.getElement("timeline-items");
    if (!timelineContainer) return;

    const commentData = this.complaint.comment || {};
    const steps = [
      { key: "submitted", label: "Submitted", icon: "📝", statuses: ["new", "submitted", "pending"] },
      { key: "verified", label: "Verified", icon: "✅", statuses: ["assigned", "verified", "under_review"] },
      { key: "action_taken", label: "Action Taken", icon: "🛠️", statuses: ["pending_approval", "action_taken", "in_progress"] },
      { key: "resolved", label: "Resolved", icon: "🎉", statuses: ["resolved", "completed", "closed"] }
    ];

    const currentStatus = (this.complaint.workflow_status || "new").toLowerCase();
    const isCancelled = currentStatus === "cancelled";
    const isRejected = currentStatus === "rejected";
    let currentStepIndex = steps.findIndex(s => s.statuses.includes(currentStatus));
    if (currentStepIndex === -1) currentStepIndex = 0;

    let html = '<div class="timeline-stepper-v2">';

    steps.forEach((step, index) => {
      let state = "future";
      if (isCancelled && index === 0) state = "completed";
      else if (index < currentStepIndex) state = "completed";
      else if (index === currentStepIndex) state = "current";

      const stepData = commentData[step.key];
      let commentContent = "";
      let dateDisplay = "";

      if (stepData && stepData.comment) {
        const dateObj = new Date(stepData.date);
        dateDisplay = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        commentContent = `<div class="timeline-comment-v2">"${stepData.comment}"</div>`;
      } else {
        // Hide empty comment boxes to save space
        commentContent = "";
      }

      const isActive = state === "current";
      const isPast = state === "completed";
      const isLast = index === steps.length - 1;

      html += `
        <div class="timeline-item-v2 ${state}">
          <div class="timeline-left-v2">
            <div class="timeline-node-v2 ${state}">${isPast || isActive ? step.icon : ""}</div>
            ${!isLast ? `<div class="timeline-line-v2 ${isPast ? "active" : ""}"></div>` : ""}
          </div>
          <div class="timeline-content-v2">
            <div class="timeline-header-v2">
              <span class="timeline-label-v2">${step.label}</span>
              <span class="timeline-date-v2">${dateDisplay}</span>
            </div>
            ${commentContent}
          </div>
        </div>
      `;
    });

    if (isRejected || isCancelled) {
      const type = isRejected ? "rejected" : "cancelled";
      html += `
        <div class="timeline-item-v2 terminal ${type}">
          <div class="timeline-left-v2">
            <div class="timeline-node-v2 terminal">${isRejected ? "❌" : "🛑"}</div>
          </div>
          <div class="timeline-content-v2">
            <div class="timeline-header-v2">
              <span class="timeline-label-v2">${isRejected ? "Rejected" : "Cancelled"}</span>
            </div>
          </div>
        </div>
      `;
    }

    html += "</div>";

    timelineContainer.innerHTML = html;
  }
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
      : [0, 0, 0];
  }
  getNextColor(currentColor) {
    const colorMap = {
      "#f97316": "#ef4444", // Orange -> Red
      "#ef4444": "#ec4899", // Red -> Pink
      "#ec4899": "#9333ea", // Pink -> Purple
      "#9333ea": "#9ca3af", // Purple -> Grey
    };
    return colorMap[currentColor] || currentColor;
  }
  setupRoleSpecificUI() {
    this.setupReturnButton();
    this.setupRoleSpecificActions();
  }
  setupReturnButton() {
    const returnLink = document.getElementById("return-link");
    const returnText = document.getElementById("return-text");
    if (!returnLink) return;

    // Check URL parameter first (explicit flag)
    const urlParams = new URLSearchParams(window.location.search);
    const fromParam = urlParams.get("from"); // e.g., ?from=dashboard or ?from=profile

    // Check referrer to determine where user came from (fallback)
    const { referrer } = document;
    const isFromDashboard =
      fromParam === "dashboard" ||
      referrer.includes("/dashboard") ||
      referrer.includes("/citizen/dashboard");
    const isFromprofile =
      fromParam === "profile" || referrer.includes("/myprofile");
    const isFromReviewQueue =
      referrer.includes("/review-queue") ||
      referrer.includes("/review");
    const isFromAssignments = referrer.includes("/assignments");

    // For citizens coming from dashboard or profile previews, always go to profile
    if (this.userRole === "citizen") {
      if (isFromDashboard) {
        returnLink.href = "/dashboard";
        if (returnText) returnText.textContent = "Return to Dashboard";
      } else if (isFromprofile || !referrer) {
        returnLink.href = "/myprofile";
        if (returnText) returnText.textContent = "Return to Your profile";
      } else {
        returnLink.href = "/myprofile";
        if (returnText) returnText.textContent = "Return to Your profile";
      }
      return;
    }

    // Otherwise use role-based navigation
    switch (this.userRole) {
      case "lgu":
        returnLink.href = isFromReviewQueue
          ? "/review-queue"
          : isFromAssignments
            ? "/assignments"
            : "/dashboard";
        if (returnText) {
          returnText.textContent = isFromReviewQueue
            ? "Return to Review Queue"
            : isFromAssignments
              ? "Return to Assigned complaints"
              : "Return to Dashboard";
        }
        break;
      case "super-admin":
        returnLink.href = "/dashboard";
        if (returnText) returnText.textContent = "Return to Dashboard";
        break;
      case "citizen":
      default:
        returnLink.href = "/myprofile";
        if (returnText) returnText.textContent = "Return to Your profile";
        break;
    }
  }
  setupRoleSpecificActions() {
    const actionsContainer = document.getElementById("complaint-actions");
    if (!actionsContainer) return;
    // Return early if complaint is not loaded
    if (!this.complaint) return;
    const actions = [];

    // Universal Print Button for all roles
    actions.push({
      text: "Print / Export",
      class: "btn btn-secondary",
      action: "print-complaint"
    });

    switch (this.userRole) {
      case "lgu":
        // LGU staff: approve/reject pending, assign, and resolve
        if (this.complaint.status === "pending review") {
          actions.push(
            { text: "Approve", class: "btn btn-success", action: "approve" },
            { text: "Reject", class: "btn btn-danger", action: "reject" }
          );
        }
        if (
          this.complaint.status === "assigned" ||
          this.complaint.status === "in progress" ||
          this.complaint.status === "approved"
        ) {
          actions.push({
            text: "Mark as Resolved",
            class: "btn btn-success",
            action: "mark-resolved",
          });
        }
        break;
        if (
          this.complaint.status === "assigned" ||
          this.complaint.status === "in progress" ||
          (!this.systemConfig.legacyRolesEnabled && this.complaint.status === "approved") // Allow picking up approved items directly
        ) {
          actions.push({
            text: "Mark as Resolved",
            class: "btn btn-success",
            action: "mark-resolved",
          });
        }
        break;
      case "citizen":
        if (
          this.complaint.status === "pending review" ||
          this.complaint.status === "approved"
        ) {
          actions.push({
            text: "Cancel complaint",
            class: "btn btn-warning",
            action: "cancel",
          });
        }
        // Show confirmation button when all assignments are complete and citizen hasn't confirmed
        if (this.shouldShowConfirmationButton()) {
          actions.push({
            text: "Confirm Resolution",
            class: "btn btn-success",
            action: "confirm-resolution",
          });
        }
        if (
          this.complaint.status !== "cancelled" &&
          this.complaint.status !== "closed"
        ) {
          actions.push({
            text: "Set Reminder",
            class: "btn btn-info",
            action: "remind",
          });
        }
        break;
    }
    // Hide Confirm Resolution if already resolved/completed
    const wf = (this.complaint.workflow_status || "").toLowerCase();
    const confirmedByCitizen = Boolean(this.complaint.confirmed_by_citizen);
    const filteredActions = actions.filter((a) => {
      if (a.action === "confirm-resolution") {
        if (wf === "completed" || confirmedByCitizen) return false;
      }
      if (a.action === "remind") {
        // Hide reminder when already resolved/completed or cancelled/rejected
        if (wf === "completed" || wf === "resolved" || wf === "cancelled" || wf === "rejected") return false;
      }
      return true;
    });
    actionsContainer.innerHTML = filteredActions
      .map(
        (action) => `
  <button type="button" class="${action.class}" data-action="${action.action}">
    ${action.text}
  </button>
  `
      )
      .join("");
    // Attach event listeners
    actionsContainer
      .querySelectorAll("button[data-action]")
      .forEach((button) => {
        button.addEventListener("click", (e) => {
          const action = e.target.getAttribute("data-action");
          this.handleAction(action);
        });
      });
  }
  async handleAction(action) {
    switch (action) {
      case "approve":
        await this.approvecomplaint();
        break;
      case "reject":
        await this.rejectcomplaint();
        break;
      case "assign-officer":
        await this.assignToOfficer();
        break;
      case "mark-resolved":
        await this.markAsResolved();
        break;
      case "confirm-resolution":
        await this.confirmResolution();
        break;
      case "remind":
        await this.sendReminder();
        break;
      case "print-complaint":
        window.print();
        break;
      case "add-comment":
        await this.addComment();
        break;
    }
  }
  async approvecomplaint() {
    // Redirect to coordinator review queue with approval action
    window.location.href = `/ coordinator / review - queue ? action = approve & id=${this.complaintId} `;
  }

  showReasonModal(title, placeholder, confirmLabel, onConfirm) {
    const existing = document.getElementById("action-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "action-modal";
    modal.className = "modal active";
    modal.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px);";

    modal.innerHTML = `
  < div class="modal-content" style = "width: 500px; background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);" >
        <h2 style="margin-top: 0; font-size: 1.25rem; font-weight: 600; color: #1f2937;">${title}</h2>
        <textarea id="modal-input" placeholder="${placeholder}" style="width: 100%; height: 100px; margin: 1rem 0; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-family: inherit; resize: vertical;"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modal-cancel" class="btn btn-secondary">Cancel</button>
            <button id="modal-confirm" class="btn btn-primary">${confirmLabel}</button>
        </div>
      </div >
  `;

    document.body.appendChild(modal);

    const input = modal.querySelector("#modal-input");
    input.focus();

    const close = () => modal.remove();

    modal.querySelector("#modal-cancel").onclick = close;
    modal.querySelector("#modal-confirm").onclick = async () => {
      const value = input.value.trim();
      if (!value) {
        showToast("Please enter a value", "warning");
        return;
      }
      const btn = modal.querySelector("#modal-confirm");
      const originalText = btn.textContent;
      btn.textContent = "Processing...";
      btn.disabled = true;

      try {
        await onConfirm(value);
        close();
      } catch (e) {
        btn.textContent = originalText;
        btn.disabled = false;
        console.error(e);
        showToast(e.message, "error");
      }
    };

    // Close on click outside
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };
  }

  async rejectcomplaint() {
    this.showReasonModal(
      "Reject complaint",
      "Please provide a reason for rejection...",
      "Reject complaint",
      async (reason) => {
        const response = await fetch(
          `/ api / coordinator / review - queue / ${this.complaintId}/decide`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision: "reject",
              data: { reason },
            }),
          }
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.success) {
          showToast("complaint rejected successfully", "success");
          this.loadcomplaintDetails();
        } else {
          throw new Error(result.error || "Failed to reject complaint");
        }
      }
    );
  }
  async assignToOfficer() {
    // This would open a modal or redirect to assignment page
    showToast("Officer assignment feature coming soon", "info");
  }
  async markAsResolved() {
    const notes = prompt("Please provide resolution notes:");
    if (!notes) return;
    try {
      const response = await fetch(
        `/api/lgu/complaints/${this.complaintId}/resolve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            resolution_notes: notes,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        showToast("complaint marked as resolved", "success");
        this.loadcomplaintDetails(); // Refresh
      } else {
        throw new Error(result.error || "Failed to mark as resolved");
      }
    } catch (error) {
      console.error("Error marking as resolved:", error);
      showToast(`Failed to mark as resolved: ${error.message}`, "error");
    }
  }
  async updateStatus() {
    // Simple prompt for status - in a real app, use a modal with dropdown
    // For now, prompt for status and comment
    const validStatuses = ["verified", "under_review", "action_taken", "resolved", "rejected"];
    let status = prompt(`Enter new status:\n(${validStatuses.join(", ")})`);

    if (!status) return;
    status = status.toLowerCase().trim();
    status = status.replace(" ", "_"); // handle 'under review' -> 'under_review'

    if (!validStatuses.includes(status)) {
      showToast("warning", "Invalid status. Please use one of the allowed statuses.");
      return;
    }

    const comment = prompt("Enter a comment/note for this update:");
    if (!comment) return;

    try {
      const response = await fetch(
        `/api/lgu/complaints/${this.complaintId}/update-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            status,
            comment
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        showToast("Status updated successfully", "success");
        this.loadcomplaintDetails(); // Refresh
      } else {
        throw new Error(result.error || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showToast(`Failed to update status: ${error.message}`, "error");
    }
  }
  async addComment() {
    this.showReasonModal(
      "Add Comment / Note",
      "Enter your comment here...",
      "Add Comment",
      async (comment) => {
        const response = await fetch(
          `/api/lgu/complaints/${this.complaintId}/update-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // Send current status to just add a note without changing status
              status: this.complaint.workflow_status,
              comment
            }),
          }
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.success) {
          showToast("Comment added successfully", "success");
          this.loadcomplaintDetails();
        } else {
          throw new Error(result.error || "Failed to add comment");
        }
      }
    );
  }
  async confirmResolution() {
    if (!confirm("Are you satisfied with the resolution of this complaint?")) {
      return;
    }
    try {
      const response = await fetch(
        `/api/complaints/${this.complaintId}/confirm-resolution`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            confirmed: true,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        showToast("Resolution confirmed successfully", "success");
        this.loadcomplaintDetails(); // Refresh to update UI
      } else {
        // Show the specific backend validation error to the user
        showToast(result.error || "Failed to confirm resolution", "error");
        console.log("Backend validation error:", result.error);
        // Optionally refresh the complaint details to update the UI state
        this.loadcomplaintDetails();
      }
    } catch (error) {
      console.error("Error confirming resolution:", error);
      showToast(`Failed to confirm resolution: ${error.message}`, "error");
    }
  }
  async sendReminder() {
    try {
      const response = await fetch(
        `/api/complaints/${this.complaintId}/remind`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        showToast("Reminder sent successfully", "success");
      } else {
        throw new Error(result.error || "Failed to send reminder");
      }
    } catch (error) {
      console.error("Error sending reminder:", error);
      showToast(`Failed to send reminder: ${error.message}`, "error");
    }
  }
  showLoading() {
    const loader = this.getElement("loading");
    if (loader) {
      loader.style.setProperty("display", "flex", "important");
      loader.classList.remove("hidden");
    }
    const details = this.getElement("complaint-details");
    if (details) {
      details.style.setProperty("display", "none", "important");
    }
    const error = this.getElement("error-state");
    if (error) {
      error.style.setProperty("display", "none", "important");
    }
  }

  hideLoading() {
    const loader = this.getElement("loading");
    if (loader) {
      loader.style.setProperty("display", "none", "important");
      loader.classList.add("hidden");
    }
  }
  cleanupStuckModals() {
    // Remove any stuck modal overlays
    const stuckModals = document.querySelectorAll(
      '.modal.active, .modal-overlay.active, #map-modal, [id^="modal-"]'
    );
    stuckModals.forEach((modal) => {
      if (modal.id !== "modal-overlay" || modal.classList.contains("active")) {
        modal.classList.remove("active");
        modal.style.display = "none";
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";
        // Only remove if it's not the main modal-overlay managed by ModalManager
        if (modal.id !== "modal-overlay" && modal.id !== "map-modal") {
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

  showError(message) {
    const error = document.getElementById("error-state");
    const errorMessage = document.getElementById("error-message");
    const loading = document.getElementById("loading");
    const details = document.getElementById("complaint-details");
    if (error) {
      error.style.display = "block";
      if (errorMessage) errorMessage.textContent = message;
    }
    if (loading) loading.style.display = "none";
    if (details) details.style.display = "none";
  }
  formatDate(dateString) {
    if (!dateString) return "Unknown date";
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch (error) {
      return "Invalid date";
    }
  }
}
// Initialize when DOM is loaded - only if on the dedicated details page
document.addEventListener("DOMContentLoaded", () => {
  const isDetailsPage = window.location.pathname.includes("/complaint-details") ||
    window.location.pathname.includes("/review/");

  if (isDetailsPage && !window.location.search.includes("view=panel")) {
    new complaintDetails();
  }
});
