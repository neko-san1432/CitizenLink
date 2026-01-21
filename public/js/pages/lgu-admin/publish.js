import apiClient from "../../config/apiClient.js";
import showMessage from "../../components/toast.js";

function renderForm(type) {
  const container = document.getElementById("publish-form");
  if (!container) return;

  const inputClass =
    "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";
  const labelClass =
    "block mb-2 text-sm font-medium text-gray-900 dark:text-white";
  const btnPrimaryClass =
    "text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800";
  const btnSecondaryClass =
    "py-2.5 px-5 me-2 mb-2 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700";

  if (type === "news") {
    container.innerHTML = `
      <form id="news-form" class="space-y-6">
        <div>
          <label class="${labelClass}" for="news-title">Title</label>
          <input id="news-title" class="${inputClass}" required placeholder="Enter news title" />
        </div>
        
        <div class="grid gap-6 mb-6 md:grid-cols-2">
          <div>
            <label class="${labelClass}" for="news-category">Category</label>
            <select id="news-category" class="${inputClass}">
              <option value="">Select Category</option>
              <option value="General">General</option>
              <option value="Announcement">Announcement</option>
              <option value="Health">Health</option>
              <option value="Education">Education</option>
              <option value="Infrastructure">Infrastructure</option>
            </select>
          </div>
          <div>
             <label class="${labelClass}" for="news-image">Cover Image</label>
             <input class="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" id="news-image" type="file" accept="image/*">
             <p class="mt-1 text-xs text-gray-500 dark:text-gray-300">SVG, PNG, JPG or GIF (MAX. 2MB).</p>
          </div>
        </div>

        <div>
           <label class="${labelClass}" for="news-excerpt">Excerpt</label>
           <input id="news-excerpt" class="${inputClass}" placeholder="Short summary for preview cards" />
        </div>

        <div>
          <label class="${labelClass}" for="news-content">Content</label>
          <textarea id="news-content" class="${inputClass}" rows="8" required placeholder="Write the news content here..."></textarea>
        </div>
        
        <div class="flex items-center">
          <button id="news-submit" class="${btnPrimaryClass}" type="submit">Publish News</button>
          <button id="news-draft" class="${btnSecondaryClass}" type="button">Save as Draft</button>
        </div>
      </form>
    `;
  } else if (type === "events") {
    container.innerHTML = `
      <form id="event-form" class="space-y-6">
        <div>
          <label class="${labelClass}" for="event-title">Event Title</label>
          <input id="event-title" class="${inputClass}" required placeholder="Enter event title" />
        </div>
        
        <div class="grid gap-6 mb-6 md:grid-cols-2">
           <div>
            <label class="${labelClass}" for="event-category">Category</label>
            <select id="event-category" class="${inputClass}">
              <option value="">Select Category</option>
              <option value="Community">Community</option>
              <option value="Government">Government</option>
              <option value="Sports">Sports</option>
              <option value="Cultural">Cultural</option>
            </select>
           </div>
           <div>
             <label class="${labelClass}" for="event-location">Location</label>
             <input id="event-location" class="${inputClass}" placeholder="Event venue or link" />
           </div>
        </div>

        <div class="grid gap-6 mb-6 md:grid-cols-2">
          <div>
            <label class="${labelClass}" for="event-date">Start Date & Time</label>
            <input id="event-date" class="${inputClass}" type="datetime-local" required />
          </div>
          <div>
            <label class="${labelClass}" for="event-end-date">End Date & Time</label>
            <input id="event-end-date" class="${inputClass}" type="datetime-local" />
          </div>
        </div>
        
        <div>
           <label class="${labelClass}" for="event-image">Event Banner</label>
           <input class="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" id="event-image" type="file" accept="image/*">
        </div>

        <div>
          <label class="${labelClass}" for="event-description">Description</label>
          <textarea id="event-description" class="${inputClass}" rows="6" required placeholder="Describe the event..."></textarea>
        </div>
        
        <div class="flex items-center">
          <button id="event-submit" class="${btnPrimaryClass}" type="submit">Publish Event</button>
          <button id="event-draft" class="${btnSecondaryClass}" type="button">Save as Draft</button>
        </div>
      </form>
    `;
  } else if (type === "notices") {
    container.innerHTML = `
      <form id="notice-form" class="space-y-6">
        <div>
          <label class="${labelClass}" for="notice-title">Notice Title</label>
          <input id="notice-title" class="${inputClass}" required placeholder="e.g., Scheduled Maintenance, Road Closure" />
        </div>

        <div class="grid gap-6 mb-6 md:grid-cols-2">
           <div>
            <label class="${labelClass}" for="notice-priority">Priority Level</label>
            <select id="notice-priority" class="${inputClass}">
              <option value="low">Low</option>
              <option value="normal" selected>Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
           </div>
           <div>
            <!-- Spacer or another field -->
           </div>
        </div>

        <div class="grid gap-6 mb-6 md:grid-cols-2">
          <div>
            <label class="${labelClass}" for="notice-valid-from">Valid From</label>
            <input id="notice-valid-from" class="${inputClass}" type="datetime-local" />
          </div>
          <div>
            <label class="${labelClass}" for="notice-valid-until">Valid Until</label>
            <input id="notice-valid-until" class="${inputClass}" type="datetime-local" />
          </div>
        </div>

        <div>
          <label class="${labelClass}" for="notice-content">Message</label>
          <textarea id="notice-content" class="${inputClass}" rows="4" required placeholder="Enter the notice message..."></textarea>
        </div>
        
        <div class="flex items-center">
          <button id="notice-submit" class="${btnPrimaryClass}" type="submit">Publish Notice</button>
          <button id="notice-draft" class="${btnSecondaryClass}" type="button">Save as Draft</button>
        </div>
      </form>
    `;
  }
  wireFormHandlers(type);
}
function toIsoOrNull(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}
function wireFormHandlers(type) {
  // Helper to handle form submission
  const handleSubmission = async (
    formId,
    endpoint,
    payloadBuilder,
    successMsg,
    isDraft = false
  ) => {
    try {
      const payload = payloadBuilder();
      if (isDraft) {
        payload.status = "draft";
      }

      // Log image selection (UI only for now as backend might not support it yet)
      const fileInput = document.querySelector(`#${formId} input[type="file"]`);
      if (fileInput && fileInput.files.length > 0) {
        console.log("[PUBLISH] Image selected:", fileInput.files[0].name);
        // In a real implementation, we would upload this file first or convert to base64
        // payload.cover_image = ...
      }

      const response = await apiClient.post(endpoint, payload);
      if (response && response.success) {
        showMessage(
          "success",
          isDraft ? "Draft saved successfully" : successMsg
        );
        document.getElementById(formId).reset();
      } else {
        const errorMsg =
          response?.error || response?.details || "Operation failed";
        console.error(
          `[PUBLISH] ${isDraft ? "Draft save" : "Publish"} failed:`,
          errorMsg
        );
        showMessage("error", errorMsg);
      }
    } catch (err) {
      console.error(`[PUBLISH] Error:`, err);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.details ||
        err.message ||
        "Operation failed. Please check console.";
      showMessage("error", errorMsg);
    }
  };

  if (type === "news") {
    const form = document.getElementById("news-form");
    if (!form) return;

    const getPayload = () => ({
      title: document.getElementById("news-title").value.trim(),
      content: document.getElementById("news-content").value.trim(),
      excerpt: document.getElementById("news-excerpt").value.trim() || null,
      category: document.getElementById("news-category").value || null,
      status: "published", // Default, overridden if draft
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmission(
        "news-form",
        "/api/content/news",
        getPayload,
        "News published successfully"
      );
    });

    document.getElementById("news-draft")?.addEventListener("click", () => {
      // Validate required fields manually since we are not using form submit
      const title = document.getElementById("news-title").value.trim();
      if (!title) {
        showMessage("error", "Title is required for drafts");
        return;
      }
      handleSubmission("news-form", "/api/content/news", getPayload, "", true);
    });
  }

  if (type === "events") {
    const form = document.getElementById("event-form");
    if (!form) return;

    const getPayload = () => ({
      title: document.getElementById("event-title").value.trim(),
      description: document.getElementById("event-description").value.trim(),
      location: document.getElementById("event-location").value.trim() || null,
      event_date: toIsoOrNull(document.getElementById("event-date").value),
      end_date: toIsoOrNull(document.getElementById("event-end-date").value),
      category: document.getElementById("event-category").value || null,
      status: "upcoming",
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const desc = document.getElementById("event-description").value.trim();
      const date = document.getElementById("event-date").value;
      if (!desc) {
        showMessage("error", "Description is required");
        return;
      }
      if (!date) {
        showMessage("error", "Start date is required");
        return;
      }
      handleSubmission(
        "event-form",
        "/api/content/events",
        getPayload,
        "Event published successfully"
      );
    });

    document.getElementById("event-draft")?.addEventListener("click", () => {
      const title = document.getElementById("event-title").value.trim();
      if (!title) {
        showMessage("error", "Title is required for drafts");
        return;
      }
      handleSubmission(
        "event-form",
        "/api/content/events",
        getPayload,
        "",
        true
      );
    });
  }

  if (type === "notices") {
    const form = document.getElementById("notice-form");
    if (!form) return;

    const getPayload = () => ({
      title: document.getElementById("notice-title").value.trim(),
      content: document.getElementById("notice-content").value.trim(),
      priority: document.getElementById("notice-priority").value,
      valid_from:
        toIsoOrNull(document.getElementById("notice-valid-from").value) ||
        new Date().toISOString(),
      valid_until: toIsoOrNull(
        document.getElementById("notice-valid-until").value
      ),
      status: "active",
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmission(
        "notice-form",
        "/api/content/notices",
        getPayload,
        "Notice published successfully"
      );
    });

    document.getElementById("notice-draft")?.addEventListener("click", () => {
      const title = document.getElementById("notice-title").value.trim();
      if (!title) {
        showMessage("error", "Title is required for drafts");
        return;
      }
      handleSubmission(
        "notice-form",
        "/api/content/notices",
        getPayload,
        "",
        true
      );
    });
  }
}
function init() {
  const typeSelect = document.getElementById("content-type");
  if (!typeSelect) return;
  // Preselect from query param
  try {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    if (type && ["news", "events", "notices"].includes(type)) {
      typeSelect.value = type;
    }
  } catch {}
  renderForm(typeSelect.value);
  typeSelect.addEventListener("change", (e) => renderForm(e.target.value));
}
document.addEventListener("DOMContentLoaded", init);
