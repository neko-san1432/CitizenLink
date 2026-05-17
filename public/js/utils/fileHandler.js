/**
 * File Handling Utilities
 * Centralized file management for complaint forms
 */
import { validateFiles } from "./validation.js";
import showMessage from "../components/toast.js";

/**
 * File Handler Class
 * Manages file selection, validation, and preview
 */

export class FileHandler {

  constructor(options = {}) {
    this.selectedFiles = [];
    this.maxFiles = options.maxFiles || 5;
    this.onFilesChange = options.onFilesChange || (() => {});
    this.previewContainer = options.previewContainer || null;
    this.uploadStatus = new Map(); // Track upload status for each file: 'pending', 'uploading', 'completed', 'error'
    this.uploadProgress = new Map(); // Track upload progress (0-100) for each file
    this.isUploading = false; // Track if any upload is in progress
    this.onUploadStateChange = options.onUploadStateChange || (() => {}); // Callback when upload state changes
    this.objectURLs = new Map(); // Track object URLs for cleanup: file -> objectURL
  }
  /**
   * Add files to the handler
   * @param {FileList|Array} files - Files to add
   */
  addFiles(files) {
    const validation = validateFiles(files, this.selectedFiles);
    if (validation.errors.length > 0) {
      // Show errors but still add valid files
      validation.errors.forEach(error => {
        const type = error.includes("already selected") ? "warning" : "error";
        showMessage(type, error);
      });
    }
    if (validation.validFiles.length > 0) {
      validation.validFiles.forEach(file => {
        this.selectedFiles.push(file);
        // Initialize upload status as pending
        this.uploadStatus.set(file, "pending");
        this.uploadProgress.set(file, 0);
      });
      if (validation.errors.length === 0) {
        showMessage("success", `${validation.validFiles.length} file(s) added successfully`);
      }
      this.onFilesChange(this.selectedFiles);
      this.renderPreviews();
    }
  }
  /**
   * Remove file by index
   * @param {number} index - Index of file to remove
   */
  removeFile(index) {
    if (index >= 0 && index < this.selectedFiles.length) {
      const removedFile = this.selectedFiles.splice(index, 1)[0];
      this.removeFileAndCleanup(removedFile);
    }
  }

  /**
   * Remove file by file object and clean up resources
   * @param {File} file - File to remove
   */
  removeFileAndCleanup(file) {
    // Clean up upload tracking
    this.uploadStatus.delete(file);
    this.uploadProgress.delete(file);

    // Clean up object URL cache
    const objectURL = this.objectURLs.get(file);
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
      this.objectURLs.delete(file);
    }

    // Remove from selected files
    const index = this.selectedFiles.indexOf(file);
    if (index > -1) {
      this.selectedFiles.splice(index, 1);
    }

    // Update upload state
    this.updateUploadState();

    // Notify and re-render
    this.onFilesChange(this.selectedFiles);
    this.renderPreviews();
  }

  /**
   * Remove all failed uploads
   */
  removeFailedUploads() {
    const failedFiles = this.selectedFiles.filter(file =>
      this.uploadStatus.get(file) === "error"
    );

    failedFiles.forEach(file => {
      this.removeFileAndCleanup(file);
    });

    return failedFiles.length;
  }
  /**
   * Clear all files
   */
  clearAll() {
    // Clean up all object URLs
    this.objectURLs.forEach((objectURL) => {
      URL.revokeObjectURL(objectURL);
    });
    this.objectURLs.clear();

    this.selectedFiles = [];
    this.uploadStatus.clear();
    this.uploadProgress.clear();
    this.isUploading = false;
    this.onUploadStateChange(false);
    this.onFilesChange(this.selectedFiles);
    this.renderPreviews();
    this.updateDragZoneVisibility();
  }

  /**
   * Update upload state and notify callback
   */
  updateUploadState() {
    const wasUploading = this.isUploading;
    this.isUploading = Array.from(this.uploadStatus.values()).some(status => status === "uploading");
    if (wasUploading !== this.isUploading) {
      this.onUploadStateChange(this.isUploading);
    }
  }

  /**
   * Set upload status for a file
   * @param {File} file - File to update
   * @param {string} status - Upload status: 'pending', 'uploading', 'completed', 'error'
   * @param {number} progress - Upload progress (0-100)
   */
  setUploadStatus(file, status, progress = 0) {
    this.uploadStatus.set(file, status);
    this.uploadProgress.set(file, progress);
    this.updateUploadState();
    this.renderPreviews(); // Re-render to show updated status
  }

  /**
   * Get upload status for a file
   * @param {File} file - File to check
   * @returns {string} Upload status
   */
  getUploadStatus(file) {
    return this.uploadStatus.get(file) || "pending";
  }

  /**
   * Get upload progress for a file
   * @param {File} file - File to check
   * @returns {number} Upload progress (0-100)
   */
  getUploadProgress(file) {
    return this.uploadProgress.get(file) || 0;
  }

  /**
   * Check if any files are currently uploading
   * @returns {boolean} True if uploading
   */
  hasUploadingFiles() {
    return this.isUploading;
  }

  /**
   * Check if all files are uploaded successfully
   * @returns {boolean} True if all files are completed
   */
  allFilesUploaded() {
    if (this.selectedFiles.length === 0) return true;
    return this.selectedFiles.every(file => this.uploadStatus.get(file) === "completed");
  }
  /**
   * Get current files
   * @returns {Array} Current selected files
   */
  getFiles() {
    return [...this.selectedFiles];
  }
  /**
   * Render file previews
   */
  renderPreviews() {
    if (!this.previewContainer) return;
    this.previewContainer.innerHTML = "";
    this.previewContainer.className = "file-preview-list-container";
    
    // Hide/show drag zone based on files
    this.updateDragZoneVisibility();
    
    // Render file previews
    this.selectedFiles.forEach((file, index) => {
      const previewItem = this.createPreviewItem(file, index);
      this.previewContainer.appendChild(previewItem);
    });
    
    // Add plus button if not at max files
    if (this.selectedFiles.length < this.maxFiles) {
      const addButton = this.createAddButton();
      this.previewContainer.appendChild(addButton);
    }
  }
  /**
   * Update drag zone visibility
   */
  updateDragZoneVisibility() {
    const dropZone = document.getElementById("fileDropZone");
    if (!dropZone) return;
    if (this.selectedFiles.length > 0) {
      dropZone.style.display = "none";
    } else {
      dropZone.style.display = "block";
    }
  }
  /**
   * Create preview item element
   * @param {File} file - File to create preview for
   * @param {number} index - File index
   * @returns {HTMLElement} Preview element
   */
  createPreviewItem(file, index) {
    const previewItem = document.createElement("div");
    previewItem.className = "file-preview-list-item";
    const uploadStatus = this.getUploadStatus(file);
    const uploadProgress = this.getUploadProgress(file);

    if (uploadStatus === "uploading") previewItem.classList.add("status-uploading");
    if (uploadStatus === "completed") previewItem.classList.add("status-completed");
    if (uploadStatus === "error") previewItem.classList.add("status-error");

    // File Info (Left)
    const fileInfo = document.createElement("div");
    fileInfo.className = "file-info";
    
    const fileName = document.createElement("div");
    fileName.className = "file-name";
    fileName.textContent = file.name;
    
    const fileSize = document.createElement("div");
    fileSize.className = "file-size";
    fileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);

    // Upload Progress (Optional overlay or bar)
    if (uploadStatus === "uploading") {
      const progressBar = document.createElement("div");
      progressBar.className = "file-progress-bar";
      progressBar.innerHTML = `<div class="progress-fill" style="width: ${uploadProgress}%"></div>`;
      fileInfo.appendChild(progressBar);
    }

    // Thumbnail (Right)
    const thumbnail = document.createElement("div");
    thumbnail.className = "file-thumbnail";
    
    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      let objectURL = this.objectURLs.get(file);
      if (!objectURL) {
        objectURL = URL.createObjectURL(file);
        this.objectURLs.set(file, objectURL);
      }
      img.src = objectURL;
      thumbnail.appendChild(img);
    } else {
      const icon = document.createElement("div");
      icon.className = "file-type-icon";
      if (file.type.startsWith("video/")) icon.textContent = "🎥";
      else if (file.type.startsWith("audio/")) icon.textContent = "🎵";
      else icon.textContent = "📄";
      thumbnail.appendChild(icon);
    }

    // Remove Button
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-file-btn-list";
    removeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"></path>
      </svg>
    `;
    removeBtn.disabled = uploadStatus === "uploading";
    if (uploadStatus !== "uploading") {
      removeBtn.addEventListener("click", () => this.removeFile(index));
    }

    previewItem.appendChild(fileInfo);
    previewItem.appendChild(thumbnail);
    previewItem.appendChild(removeBtn);
    
    return previewItem;
  }
  /**
   * Create add more files button
   * @returns {HTMLElement} Add button element
   */
  createAddButton() {
    const addButton = document.createElement("div");
    addButton.className = "add-file-list-button";
    addButton.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      <span>Add More Files (${this.selectedFiles.length}/${this.maxFiles})</span>
    `;
    addButton.addEventListener("click", () => {
      const fileInput = document.getElementById("evidenceFiles");
      if (fileInput) fileInput.click();
    });
    return addButton;
  }
}
/**
 * Setup drag and drop functionality
 * @param {HTMLElement} dropZone - Drop zone element
 * @param {FileHandler} fileHandler - File handler instance
 * @param {HTMLInputElement} fileInput - File input element
 */

export function setupDragAndDrop(dropZone, fileHandler, fileInput) {
  if (!dropZone || !fileHandler) return;
  // Drag and drop events
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const {files} = e.dataTransfer;
    if (files.length > 0) {
      fileHandler.addFiles(files);
    }
  });
  // Click to browse
  dropZone.addEventListener("click", () => {
    if (fileInput) {
      fileInput.click();
    }
  });
  // File input change
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        fileHandler.addFiles(e.target.files);
        // Clear the input so the same file can be selected again
        e.target.value = "";
      }
    });
  }
}
/**
 * Create a file handler for complaint forms
 * @param {Object} options - Configuration options
 * @returns {FileHandler} Configured file handler
 */

export function createcomplaintFileHandler(options = {}) {
  const defaults = {
    maxFiles: 5,
    onFilesChange: (files) => {
      // Make files globally available for form submission
      window.selectedFiles = files;
    }
  };
  return new FileHandler({ ...defaults, ...options });
}
