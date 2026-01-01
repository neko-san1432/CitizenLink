// Office Selection Modal for Coordinator Approval
class DepartmentSelectionModal {

  constructor() {
    this.modal = null;
    this.selectedDepartments = [];
    this.preferredDepartments = [];
    this.complaintId = null;
    this.callback = null;
  }
  async show(complaintId, preferredDepartments = [], callback) {
    this.complaintId = complaintId;
    this.preferredDepartments = preferredDepartments || [];
    this.callback = callback;
    this.selectedDepartments = [...this.preferredDepartments]; // Pre-select preferred
    await this.createModal();
    this.attachEventListeners();
    this.modal.style.display = "flex";
  }
  async createModal() {
    // Remove existing modal if any
    if (this.modal) {
      this.modal.remove();
    }
    // Get departments from API
    const departments = await this.fetchDepartments();
    this.modal = document.createElement("div");
    this.modal.className = "modal-overlay";
    this.modal.innerHTML = `
      <div class="modal-content department-selection-modal">
        <div class="modal-header">
          <h3>Approve Complaint & Assign Offices</h3>
          <button class="modal-close" type="button">&times;</button>
        </div>
        <div class="modal-body">
          <p>Select the office(s) to assign this complaint to:</p>
          <div class="department-list">
            ${departments.map(dept => `
              <label class="department-item ${this.preferredDepartments.includes(dept.code) ? "preferred" : ""}">
                <input type="checkbox" 
                       value="${dept.code}" 
                       ${this.selectedDepartments.includes(dept.code) ? "checked" : ""}
                       class="department-checkbox">
                <div class="department-info">
                  <div class="department-name">${dept.name}</div>
                  <div class="department-code">${dept.code}</div>
                  ${this.preferredDepartments.includes(dept.code) ? '<span class="preferred-badge">Citizen Preferred</span>' : ""}
                </div>
              </label>
            `).join("")}
          </div>
          <div class="selected-summary">
            <strong>Selected: <span id="selected-count">${this.selectedDepartments.length}</span> office(s)</strong>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="cancel-approval">Cancel</button>
          <button type="button" class="btn btn-primary" id="confirm-approval" disabled>
            Approve & Assign
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.updateSelectedCount();
  }

  async fetchDepartments() {
    try {
      const response = await fetch("/api/departments", {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.data || data.departments || [];
    } catch (error) {
      console.error("Error fetching departments:", error);
      return [];
    }
  }
  attachEventListeners() {
    // Close modal
    this.modal.querySelector(".modal-close").addEventListener("click", () => this.hide());
    this.modal.querySelector("#cancel-approval").addEventListener("click", () => this.hide());
    // Close on overlay click
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
    // Department checkboxes
    this.modal.querySelectorAll(".department-checkbox").forEach(checkbox => {
      checkbox.addEventListener("change", (e) => {
        const deptCode = e.target.value;
        if (e.target.checked) {
          if (!this.selectedDepartments.includes(deptCode)) {
            this.selectedDepartments.push(deptCode);
          }
        } else {
          this.selectedDepartments = this.selectedDepartments.filter(d => d !== deptCode);
        }
        this.updateSelectedCount();
        this.updateConfirmButton();
      });
    });
    // Confirm approval
    this.modal.querySelector("#confirm-approval").addEventListener("click", () => {
      this.confirmApproval();
    });
  }
  updateSelectedCount() {
    const countElement = this.modal.querySelector("#selected-count");
    if (countElement) {
      countElement.textContent = this.selectedDepartments.length;
    }
  }
  updateConfirmButton() {
    const confirmBtn = this.modal.querySelector("#confirm-approval");
    if (confirmBtn) {
      confirmBtn.disabled = this.selectedDepartments.length === 0;
    }
  }
  async confirmApproval() {
    if (this.selectedDepartments.length === 0) {
      alert("Please select at least one office");
      return;
    }
    try {
      const confirmBtn = this.modal.querySelector("#confirm-approval");
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Processing...";
      const response = await fetch(`/api/coordinator/review-queue/${this.complaintId}/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          decision: "approve",
          data: {
            departments: this.selectedDepartments,
            options: {
              notes: "Approved by coordinator"
            }
          }
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        // Show success message
        if (typeof showToast === "function") {
          showToast("success", result.message || "Complaint approved successfully");
        }
        // Call callback to refresh the queue
        if (this.callback) {
          this.callback();
        }
        this.hide();
      } else {
        throw new Error(result.error || "Failed to approve complaint");
      }
    } catch (error) {
      console.error("Error approving complaint:", error);
      alert(`Failed to approve complaint: ${  error.message}`);
      // Re-enable button
      const confirmBtn = this.modal.querySelector("#confirm-approval");
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Approve & Assign";
    }
  }
  hide() {

    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}
// Export for use in other files
window.DepartmentSelectionModal = DepartmentSelectionModal;
