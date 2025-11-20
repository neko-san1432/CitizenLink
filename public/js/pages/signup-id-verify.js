// ID Verification: upload/camera capture, optional OCR call, and form autofill
// Expected OCR API response shape (example):
// {
//   fields: {
//     firstName: "...",
//     lastName: "...",
//     middleName: "...",
//     addressLine1: "...",
//     addressLine2: "...",
//     barangay: "...",
//     sex: "Male|Female|M|F",
//     idNumber: "...",
//     birthDate: "YYYY-MM-DD",
//     expiryDate: "YYYY-MM-DD"
//   },
//   rawText: "...",
//   provider: "textract|vision|tesseract|custom"
// }

(function () {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const modeBtns = qsa('.id-mode-btn');
  const uploadPanel = qs('[data-mode-panel="upload"]');
  const cameraPanel = qs('[data-mode-panel="camera"]');

  const fileInput = qs('#id-file-input');
  const previewWrap = qs('#id-preview');
  const previewImg = qs('#id-preview-img');
  const clearBtn = qs('#id-clear-btn');

  const cameraVideo = qs('#id-camera');
  const cameraCanvas = qs('#id-canvas');
  const cameraStartBtn = qs('#camera-start-btn');
  const cameraCaptureBtn = qs('#camera-capture-btn');
  const cameraStopBtn = qs('#camera-stop-btn');
  const cameraPreviewWrap = qs('#id-camera-preview');
  const cameraPreviewImg = qs('#id-captured-img');
  const cameraRetakeBtn = qs('#camera-retake-btn');

  const consent = qs('#id-consent-checkbox');
  const scanBtn = qs('#id-scan-btn');
  const statusEl = qs('#id-verify-status');
  const review = qs('#id-review');
  const reviewGrid = qs('#id-review-grid');

  const form = qs('#regForm');

  let mediaStream = null;
  let capturedBlob = null;

  function setMode(mode) {
    modeBtns.forEach((b) => {
      const active = b.dataset.mode === mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    const isUpload = mode === 'upload';
    uploadPanel.hidden = !isUpload;
    cameraPanel.hidden = isUpload;
    if (!isUpload) {
      previewWrap.hidden = true;
      fileInput.value = '';
    } else {
      stopCamera();
      cameraPreviewWrap.hidden = true;
      capturedBlob = null;
    }
    updateScanEnabled();
  }

  function updateScanEnabled() {
    const hasUpload = !!fileInput.files?.[0];
    const hasCapture = !!capturedBlob;
    const ok = consent.checked && (hasUpload || hasCapture);
    scanBtn.disabled = !ok;
  }

  // Upload handling
  fileInput?.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) {
      previewWrap.hidden = true;
      previewImg.src = '';
      return updateScanEnabled();
    }
    // Preview if image
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      previewImg.src = url;
      previewWrap.hidden = false;
    } else {
      previewWrap.hidden = true;
      previewImg.src = '';
    }
    updateScanEnabled();
  });

  clearBtn?.addEventListener('click', () => {
    fileInput.value = '';
    previewWrap.hidden = true;
    previewImg.src = '';
    updateScanEnabled();
  });

  // Camera handling
  async function startCamera() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      cameraVideo.srcObject = mediaStream;
      cameraCaptureBtn.disabled = false;
      cameraStopBtn.disabled = false;
      status('Camera enabled');
    } catch (e) {
      status('Unable to access camera. Please allow permissions or use Upload mode.', 'error');
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    cameraCaptureBtn.disabled = true;
    cameraStopBtn.disabled = true;
  }

  cameraStartBtn?.addEventListener('click', startCamera);
  cameraStopBtn?.addEventListener('click', () => {
    stopCamera();
    status('Camera stopped');
  });

  cameraCaptureBtn?.addEventListener('click', () => {
    if (!cameraVideo.videoWidth) return;
    const w = cameraVideo.videoWidth;
    const h = cameraVideo.videoHeight;
    cameraCanvas.width = w;
    cameraCanvas.height = h;
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, w, h);
    cameraCanvas.toBlob((blob) => {
      capturedBlob = blob;
      const url = URL.createObjectURL(blob);
      cameraPreviewImg.src = url;
      cameraPreviewWrap.hidden = false;
      updateScanEnabled();
      status('Image captured. You may proceed to Extract & Autofill.');
    }, 'image/jpeg', 0.95);
  });

  cameraRetakeBtn?.addEventListener('click', () => {
    capturedBlob = null;
    cameraPreviewImg.src = '';
    cameraPreviewWrap.hidden = true;
    updateScanEnabled();
  });

  // Mode toggle
  modeBtns.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

  consent?.addEventListener('change', updateScanEnabled);

  // Scan and autofill
  scanBtn?.addEventListener('click', async () => {
    const usingUpload = !uploadPanel.hidden;
    const file = usingUpload ? fileInput.files?.[0] : null;
    const blob = usingUpload ? file : capturedBlob;
    if (!blob) return;

    scanBtn.disabled = true;
    status('Processing ID… This may take a few seconds.');

    try {
      const fd = new FormData();
      fd.append('file', blob, (file && file.name) || 'capture.jpg');
      const res = await fetch('/api/identity/ocr', {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        throw new Error(`OCR service returned ${res.status}`);
      }
      const data = await res.json();
      renderReview(data?.fields || {}, data?.provider);
      autofillForm(data?.fields || {});
      status('ID processed. Extracted fields shown below. Please review before submitting.', 'success');
    } catch (err) {
      console.warn('OCR error', err);
      status('Could not process the ID automatically. You can continue filling out the form manually.', 'error');
    } finally {
      scanBtn.disabled = false;
    }
  });

  function renderReview(fields, provider) {
    if (!fields || Object.keys(fields).length === 0) {
      review.hidden = true;
      reviewGrid.innerHTML = '';
      return;
    }
    const entries = Object.entries(fields);
    reviewGrid.innerHTML = entries.map(([k, v]) => {
      const safeK = escapeHtml(k);
      const safeV = escapeHtml(String(v ?? ''));
      return `<div class="kv"><div class="k">${safeK}</div><div class="v">${safeV}</div></div>`;
    }).join('');
    review.hidden = false;
  }

  function autofillForm(fields) {
    // Map OCR keys to form inputs
    const map = [
      ['firstName', '#firstName'],
      ['lastName', '#lastName'],
      ['middleName', '#middleName'], // may not exist
      ['addressLine1', '#addressLine1'],
      ['addressLine2', '#addressLine2'],
      ['barangay', '#barangay'],
      ['sex', '#gender'],
    ];

    map.forEach(([key, sel]) => {
      const el = qs(sel);
      if (!el) return;
      const val = normalizeField(key, fields[key]);
      if (!val) return;
      try {
        if (el.tagName === 'SELECT') {
          // Try to match option text/value (case-insensitive)
          const options = Array.from(el.options);
          const found = options.find(o => (o.value || o.textContent).toLowerCase() === String(val).toLowerCase());
          if (found) el.value = found.value; else el.value = '';
        } else {
          if (!el.value) el.value = String(val);
        }
        el.classList.add('autofilled');
        setTimeout(() => el.classList.remove('autofilled'), 2600);
      } catch {}
    });
  }

  function normalizeField(key, value) {
    if (value == null) return '';
    const v = String(value).trim();
    if (!v) return '';
    if (key === 'sex') {
      const x = v.toLowerCase();
      if (x.startsWith('m')) return 'he';
      if (x.startsWith('f')) return 'she';
      return '';
    }
    return v;
  }

  function status(text, kind = 'info') {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = kind === 'error' ? 'var(--error-600)' : kind === 'success' ? 'var(--success-600)' : 'var(--gray-600)';
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Initialize
  setMode('upload');
  updateScanEnabled();
})();
