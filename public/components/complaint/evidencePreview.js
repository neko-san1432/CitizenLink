/**
 * Evidence Preview Modal Component
 * Handles previewing evidence files in a popup modal
 */
class EvidencePreview {

  constructor() {
    this.modal = null;
    this.currentFile = null;
    this.init();
  }
  init() {
    this.createModal();
    this.bindEvents();
  }
  createModal() {
    // Create modal HTML
    const modalHTML = `
      <div id="evidence-preview-modal" class="evidence-preview-modal" style="display: none;">
        <div class="evidence-preview-overlay"></div>
        <div class="evidence-preview-container">
          <div class="evidence-preview-header">
            <h3 id="evidence-preview-title">Evidence Preview</h3>
            <button id="evidence-preview-close" class="evidence-preview-close">&times;</button>
          </div>
          <div class="evidence-preview-content">
            <div id="evidence-preview-body">
              <!-- Content will be loaded here -->
            </div>
            <div class="evidence-preview-actions">
              <button id="evidence-download-btn" class="btn btn-primary">
                <i class="fas fa-download"></i> Download
              </button>
              <button id="evidence-close-btn" class="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    // Add to body if not exists
    if (!document.getElementById('evidence-preview-modal')) {
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    this.modal = document.getElementById('evidence-preview-modal');
  }
  bindEvents() {
    // Close button events
    const closeBtn = document.getElementById('evidence-preview-close');
    const closeBtn2 = document.getElementById('evidence-close-btn');
    const overlay = this.modal.querySelector('.evidence-preview-overlay');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    if (closeBtn2) closeBtn2.addEventListener('click', () => this.close());
    if (overlay) overlay.addEventListener('click', () => this.close());
    // Download button
    const downloadBtn = document.getElementById('evidence-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadFile());
    }
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display !== 'none') {
        this.close();
      }
    });
  }
  show(file) {
    this.currentFile = file;
    this.loadContent(file);
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  close() {
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
    this.currentFile = null;
  }
  loadContent(file) {
    const title = document.getElementById('evidence-preview-title');
    const body = document.getElementById('evidence-preview-body');
    if (title) title.textContent = file.fileName || 'Evidence Preview';
    // Check for both publicUrl and signedUrl (from coordinator repository)
    const fileUrl = file.publicUrl || file.signedUrl || file.url;
    if (!fileUrl) {
      body.innerHTML = '<div class="evidence-error">Unable to load file preview</div>';
      return;
    }
    const fileType = this.getFileType(file.fileType || file.mimeType);
    switch (fileType) {
      case 'image':
        this.loadImagePreview(body, file);
        break;
      case 'pdf':
        this.loadPdfPreview(body, file);
        break;
      case 'video':
        this.loadVideoPreview(body, file);
        break;
      case 'audio':
        this.loadAudioPreview(body, file);
        break;
      default:
        this.loadGenericPreview(body, file);
    }
  }
  getFileType(mimeType) {
    if (!mimeType) return 'unknown';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'unknown';
  }
  loadImagePreview(container, file) {
    const fileUrl = file.publicUrl || file.signedUrl || file.url;
    container.innerHTML = `
      <div class="evidence-image-container">
        <img src="${fileUrl}" alt="${file.fileName}" class="evidence-image" />
        <div class="evidence-image-info">
          <p><strong>File:</strong> ${file.fileName}</p>
          <p><strong>Size:</strong> ${this.formatFileSize(file.fileSize)}</p>
          <p><strong>Type:</strong> ${file.fileType}</p>
        </div>
      </div>
    `;
  }
  loadPdfPreview(container, file) {
    const fileUrl = file.publicUrl || file.signedUrl || file.url;
    container.innerHTML = `
      <div class="evidence-pdf-container">
        <iframe src="${fileUrl}" class="evidence-pdf-iframe" frameborder="0"></iframe>
        <div class="evidence-pdf-info">
          <p><strong>File:</strong> ${file.fileName}</p>
          <p><strong>Size:</strong> ${this.formatFileSize(file.fileSize)}</p>
          <p><strong>Type:</strong> PDF Document</p>
        </div>
      </div>
    `;
  }
  loadVideoPreview(container, file) {
    const fileUrl = file.publicUrl || file.signedUrl || file.url;
    container.innerHTML = `
      <div class="evidence-video-container">
        <video controls class="evidence-video">
          <source src="${fileUrl}" type="${file.fileType}">
          Your browser does not support the video tag.
        </video>
        <div class="evidence-video-info">
          <p><strong>File:</strong> ${file.fileName}</p>
          <p><strong>Size:</strong> ${this.formatFileSize(file.fileSize)}</p>
          <p><strong>Type:</strong> ${file.fileType}</p>
        </div>
      </div>
    `;
  }
  loadAudioPreview(container, file) {
    const fileUrl = file.publicUrl || file.signedUrl || file.url;
    container.innerHTML = `
      <div class="evidence-audio-container">
        <audio controls class="evidence-audio">
          <source src="${fileUrl}" type="${file.fileType}">
          Your browser does not support the audio tag.
        </audio>
        <div class="evidence-audio-info">
          <p><strong>File:</strong> ${file.fileName}</p>
          <p><strong>Size:</strong> ${this.formatFileSize(file.fileSize)}</p>
          <p><strong>Type:</strong> ${file.fileType}</p>
        </div>
      </div>
    `;
  }
  loadGenericPreview(container, file) {
    container.innerHTML = `
      <div class="evidence-generic-container">
        <div class="evidence-generic-icon">
          <i class="fas fa-file"></i>
        </div>
        <div class="evidence-generic-info">
          <h4>${file.fileName}</h4>
          <p><strong>Size:</strong> ${this.formatFileSize(file.fileSize)}</p>
          <p><strong>Type:</strong> ${file.fileType}</p>
          <p>This file type cannot be previewed. Click download to view the file.</p>
        </div>
      </div>
    `;
  }
  downloadFile() {
    if (!this.currentFile) return;
    const fileUrl = this.currentFile.publicUrl || this.currentFile.signedUrl || this.currentFile.url;
    if (!fileUrl) return;
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = this.currentFile.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}
// Export for use in other modules
window.EvidencePreview = EvidencePreview;
// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.evidencePreview = new EvidencePreview();
  });
} else {
  window.evidencePreview = new EvidencePreview();
}
