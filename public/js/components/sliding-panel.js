/**
 * Sliding Panel Component
 * Handles the seamless slide-in experience for viewing complaint details.
 */

class SlidingPanel {
  constructor() {
    this.overlay = null;
    this.panel = null;
    this.body = null;
    this.closeBtn = null;
    this.isOpen = false;
    this.currentComplaintId = null;
    this.detailsInstance = null;
    this.originalUrl = window.location.href;
    this.init();
  }

  init() {
    this.ensureElements();
    this.attachEventListeners();
    this.checkInitialState();
  }

  ensureElements() {
    // Always create elements if any required piece is missing
    if (!this.overlay || !this.panel || !this.body || !this.closeBtn) {
      const existing = document.getElementById("sliding-panel-container");
      if (existing) existing.remove();
      this.createElements();
    }
  }

  createElements() {
    const container = document.createElement("div");
    container.id = "sliding-panel-container";
    container.innerHTML = `
            <div class="sliding-panel-overlay"></div>
            <div class="sliding-panel">
                <div class="sliding-panel-header">
                    <button class="sliding-panel-close-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m15 18-6-6 6-6"/>
                        </svg>
                        Back to Queue
                    </button>
                    <div id="sliding-panel-title-area" style="margin-left: 20px; font-weight: 600; color: #1e293b;"></div>
                </div>
                <div class="sliding-panel-body">
                    <!-- Complaint details will be rendered here -->
                    <div id="panel-loader" style="display: none; padding: 40px; text-align: center;">
                        <div class="spinner mx-auto"></div>
                        <p style="margin-top: 10px; color: #64748b;">Loading details...</p>
                    </div>
                    <div id="panel-content-container"></div>
                </div>
            </div>
        `;
    document.body.appendChild(container);

    this.overlay = container.querySelector(".sliding-panel-overlay");
    this.panel = container.querySelector(".sliding-panel");
    this.body = container.querySelector(".sliding-panel-body");
    this.closeBtn = container.querySelector(".sliding-panel-close-btn");
  }

  attachEventListeners() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", () => this.close());
    }
    if (this.overlay) {
      this.overlay.addEventListener("click", () => this.close());
    }

    // Handle browser back button
    window.addEventListener("popstate", (event) => {
      if (this.isOpen) {
        this.close(false); // Close without pushing new state
      } else if (event.state && event.state.complaintId) {
        this.open(event.state.complaintId, false);
      }
    });

    // Listen for global open events if needed
    window.addEventListener("open-complaint-panel", (e) => {
      if (e.detail && e.detail.complaintId) {
        this.open(e.detail.complaintId);
      }
    });
  }

  checkInitialState() {
    // If we load the page with a complaint ID in the URL on a page that supports panels
    // For now, let's keep it simple and just listen for events or manual calls
  }

  async open(complaintId, pushState = true) {
    if (!complaintId) return;
    this.ensureElements();

    this.isOpen = true;
    this.currentComplaintId = complaintId;

    // Show panel and overlay
    this.overlay.classList.add("active");
    this.panel.classList.add("active");
    document.body.style.overflow = "hidden"; // Prevent background scroll

    // Update URL and history
    if (pushState) {
      const newUrl = `/review/${complaintId}?view=panel`; // Use a visual indicator in URL
      history.pushState({ complaintId }, "", newUrl);
    }

    // Load content
    await this.loadComplaint(complaintId);
  }

  async close(pushState = true) {
    if (!this.isOpen) return;

    this.isOpen = false;
    this.currentComplaintId = null;

    // Hide panel and overlay
    this.overlay.classList.remove("active");
    this.panel.classList.remove("active");
    document.body.style.overflow = ""; // Restore scroll

    // Restore URL
    if (pushState) {
      // Go back to the original view (e.g., /review-queue)
      // If the user came from a direct link, this might be tricky,
      // but usually they click from a list.
      if (history.state && history.state.complaintId) {
        history.back();
      } else {
        history.pushState({}, "", this.originalUrl);
      }
    }

    // Cleanup the renderer instance
    if (this.detailsInstance) {
      this.detailsInstance.cleanup();
      this.detailsInstance = null;
    }
  }

  async loadComplaint(id) {
    const container = document.getElementById("panel-content-container");
    const loader = document.getElementById("panel-loader");

    container.innerHTML = "";
    loader.style.display = "block";

    // Cleanup previous instance if any
    if (this.detailsInstance) {
      this.detailsInstance.cleanup();
      this.detailsInstance = null;
    }

    try {
      // Dynamically import the ComplaintDetails class
      const { ComplaintDetails } = await import("../pages/complaint-details.js");

      container.innerHTML = `
                <div id="complaint-details" class="complaint-details" style="display: none;">
                    <div class="details-header mb-4">
                        <div class="flex items-center justify-between">
                            <h2 id="complaint-title" class="text-xl font-bold"></h2>
                            <span id="complaint-category-badge" class="badge"></span>
                        </div>
                        <div class="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <span id="complaint-id"></span>
                            <span>•</span>
                            <span id="complaint-date"></span>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Left Column: Description & Evidence -->
                        <div class="md:col-span-2 space-y-6">
                            <section class="glass-card p-4">
                                <h3 class="font-semibold mb-2">Description</h3>
                                <p id="complaint-description" class="whitespace-pre-wrap"></p>
                            </section>

                            <section class="glass-card p-4">
                                <h3 class="font-semibold mb-2">Evidence / Attachments</h3>
                                <div id="complaint-attachments" class="grid grid-cols-2 gap-2"></div>
                            </section>
                        </div>

                        <!-- Right Column: Status & Location -->
                        <div class="space-y-6">
                            <section class="glass-card p-4">
                                <h3 class="font-semibold mb-2">Status & Priority</h3>
                                <div class="flex flex-col gap-3">
                                    <div class="flex justify-between items-center">
                                        <span class="text-sm">Status:</span>
                                        <span id="complaint-status" class="complaint-status"></span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span class="text-sm">Priority:</span>
                                        <span id="complaint-priority" class="complaint-priority"></span>
                                    </div>
                                </div>
                                <div id="complaint-actions" class="mt-4 flex flex-col gap-2"></div>
                            </section>

                            <section id="ai-analytics-section" class="glass-card p-4" style="display: none;">
                                <h3 class="font-semibold mb-2 flex items-center gap-2">
                                    <i class="fas fa-brain text-purple-600"></i> AI Intelligence
                                </h3>
                                <div id="ai-analytics-content" class="text-sm space-y-2"></div>
                            </section>

                            <section class="glass-card p-4">
                                <h3 class="font-semibold mb-2">Location</h3>
                                <div id="complaint-location" style="height: 200px; border-radius: 8px; overflow: hidden; background: #eee;"></div>
                            </section>
                            
                            <section id="complainant-section" class="glass-card p-4" style="display: none;">
                                <h3 class="font-semibold mb-2">Complainant Info</h3>
                                <div id="complainant-info" class="text-sm space-y-1"></div>
                            </section>
                        </div>
                    </div>
                    
                    <!-- Timeline -->
                    <section class="glass-card p-4 mt-6">
                        <h3 class="font-semibold mb-4">History & Progress</h3>
                        <div id="timeline-items" class="space-y-4"></div>
                    </section>
                </div>
            `;

      // Initialize the ComplaintDetails renderer in the specified container
      this.detailsInstance = new ComplaintDetails(container, id);
      const details = this.detailsInstance;

      // Update panel title area once data is loaded (via listener or polling)
      const checkData = setInterval(() => {
        if (details.complaint) {
          const titleArea = document.getElementById("sliding-panel-title-area");
          if (titleArea) {
            titleArea.textContent = `Complaint Details`;
          }
          clearInterval(checkData);
        }
      }, 100);

    } catch (error) {
      console.error("Failed to load complaint in panel:", error);
      container.innerHTML = `<div style="padding: 20px; color: #ef4444;">Error loading details: ${error.message}</div>`;
    } finally {
      loader.style.display = "none";
    }
  }
}

// Global instance
const slidingPanel = new SlidingPanel();
export default slidingPanel;
