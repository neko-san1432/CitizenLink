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
      console.log(`[FILE] Removed file: ${removedFile.name}`);
      
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

    this.selectedFiles.forEach((file, index) => {
      const previewItem = this.createPreviewItem(file, index);
      this.previewContainer.appendChild(previewItem);
    });
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
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      margin: 4px 0;
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
    `;

    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.style.flex = '1';

    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    fileName.style.cssText = 'display: block; font-weight: 500; color: #495057;';

    const fileSize = document.createElement('span');
    fileSize.className = 'file-size';
    fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    fileSize.style.cssText = 'display: block; font-size: 12px; color: #6c757d;';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-file-btn';
    removeBtn.textContent = '×';
    removeBtn.style.cssText = `
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      margin-left: 8px;
    `;

    removeBtn.addEventListener('click', () => this.removeFile(index));

    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    previewItem.appendChild(fileInfo);
    previewItem.appendChild(removeBtn);

    return previewItem;
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
    
    const files = e.dataTransfer.files;
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
