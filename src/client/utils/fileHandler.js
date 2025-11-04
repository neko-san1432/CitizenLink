/**
 * File Handling Utilities
 * Centralized file management for complaint forms
 */

import { validateFiles } from './validation.js';
import showMessage from '../components/toast.js';

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
        const type = error.includes('already selected') ? 'warning' : 'error';
        showMessage(type, error);
      });
    }

    if (validation.validFiles.length > 0) {
      this.selectedFiles.push(...validation.validFiles);

      if (validation.errors.length === 0) {
        showMessage('success', `${validation.validFiles.length} file(s) added successfully`);
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
      // console.log removed for security

      this.onFilesChange(this.selectedFiles);
      this.renderPreviews();
    }
  }

  /**
   * Clear all files
   */
  clearAll() {
    this.selectedFiles = [];
    this.onFilesChange(this.selectedFiles);
    this.renderPreviews();
    this.updateDragZoneVisibility();
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

    this.previewContainer.innerHTML = '';

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
    const dropZone = document.getElementById('fileDropZone');
    if (!dropZone) return;

    if (this.selectedFiles.length > 0) {
      dropZone.style.display = 'none';
    } else {
      dropZone.style.display = 'block';
    }
  }

  /**
   * Create preview item element
   * @param {File} file - File to create preview for
   * @param {number} index - File index
   * @returns {HTMLElement} Preview element
   */
  createPreviewItem(file, index) {
    const previewItem = document.createElement('div');
    previewItem.className = 'file-preview-item';
    previewItem.style.cssText = `
      display: inline-block;
      position: relative;
      margin: 8px;
      width: 120px;
      height: 120px;
      border: 2px solid #dee2e6;
      border-radius: 8px;
      overflow: hidden;
      background-color: #f8f9fa;
    `;

    // Create preview based on file type
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
      `;
      previewItem.appendChild(img);
    } else {
      // For non-image files, show file icon
      const fileIcon = document.createElement('div');
      fileIcon.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #6c757d;
      `;

      const icon = document.createElement('div');
      icon.style.cssText = 'font-size: 32px; margin-bottom: 4px;';
      if (file.type.startsWith('video/')) {
        icon.textContent = '🎥';
      } else if (file.type.startsWith('audio/')) {
        icon.textContent = '🎵';
      } else {
        icon.textContent = '📄';
      }

      const fileName = document.createElement('div');
      fileName.textContent = file.name.length > 12 ? `${file.name.substring(0, 12)  }...` : file.name;
      fileName.style.cssText = 'font-size: 10px; text-align: center; word-break: break-all;';

      fileIcon.appendChild(icon);
      fileIcon.appendChild(fileName);
      previewItem.appendChild(fileIcon);
    }

    // Add remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-file-btn';
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    removeBtn.addEventListener('click', () => this.removeFile(index));
    previewItem.appendChild(removeBtn);

    return previewItem;
  }

  /**
   * Create add more files button
   * @returns {HTMLElement} Add button element
   */
  createAddButton() {
    const addButton = document.createElement('div');
    addButton.className = 'add-file-button';
    addButton.style.cssText = `
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 8px;
      width: 120px;
      height: 120px;
      border: 2px dashed #6c757d;
      border-radius: 8px;
      cursor: pointer;
      background-color: #f8f9fa;
      color: #6c757d;
      transition: all 0.2s ease;
    `;

    addButton.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 8px;">+</div>
      <div style="font-size: 12px; text-align: center;">Add More<br/>(${this.selectedFiles.length}/${this.maxFiles})</div>
    `;

    addButton.addEventListener('click', () => {
      const fileInput = document.getElementById('evidenceFiles');
      if (fileInput) {
        fileInput.click();
      }
    });

    addButton.addEventListener('mouseenter', () => {
      addButton.style.borderColor = '#007bff';
      addButton.style.color = '#007bff';
      addButton.style.backgroundColor = '#e3f2fd';
    });

    addButton.addEventListener('mouseleave', () => {
      addButton.style.borderColor = '#6c757d';
      addButton.style.color = '#6c757d';
      addButton.style.backgroundColor = '#f8f9fa';
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
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const {files} = e.dataTransfer;
    if (files.length > 0) {
      fileHandler.addFiles(files);
    }
  });

  // Click to browse
  dropZone.addEventListener('click', () => {
    if (fileInput) {
      fileInput.click();
    }
  });

  // File input change
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        fileHandler.addFiles(e.target.files);
        // Clear the input so the same file can be selected again
        e.target.value = '';
      }
    });
  }
}

/**
 * Create a file handler for complaint forms
 * @param {Object} options - Configuration options
 * @returns {FileHandler} Configured file handler
 */
export function createComplaintFileHandler(options = {}) {
  const defaults = {
    maxFiles: 5,
    onFilesChange: (files) => {
      // Make files globally available for form submission
      window.selectedFiles = files;
    }
  };

  return new FileHandler({ ...defaults, ...options });
}
