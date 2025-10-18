let modalEl = null;
let overlayEl = null;
let lastFocus = null;

function ensureModal() {
  if (modalEl) return;
  overlayEl = document.createElement('div');
  overlayEl.className = 'media-modal-overlay';
  overlayEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;z-index:10000;';

  modalEl = document.createElement('div');
  modalEl.className = 'media-modal';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.style.cssText = 'position:fixed;inset:auto;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90vw;max-height:90vh;background:#fff;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.3);display:none;z-index:10001;overflow:auto;';
  modalEl.innerHTML = `
    <div class="media-modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #eee;">
      <div id="media-modal-title" style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70vw;"></div>
      <div>
        <button type="button" id="media-modal-open" class="btn" style="margin-right:8px;">Open</button>
        <button type="button" id="media-modal-close" class="btn">Close</button>
      </div>
    </div>
    <div id="media-modal-body" style="padding:12px 16px;min-width:300px;min-height:200px;display:flex;align-items:center;justify-content:center;"></div>
  `;

  document.body.appendChild(overlayEl);
  document.body.appendChild(modalEl);

  overlayEl.addEventListener('click', closeModal);
  document.getElementById('media-modal-close').addEventListener('click', closeModal);
  document.getElementById('media-modal-open').addEventListener('click', () => {
    const link = modalEl.getAttribute('data-url');
    if (link) window.open(link, '_blank');
  });
  document.addEventListener('keydown', (e) => {
    if (modalEl.style.display !== 'none' && e.key === 'Escape') closeModal();
  });
}

export function openMediaModal({ url, mime, title }) {
  ensureModal();
  lastFocus = document.activeElement;
  const body = document.getElementById('media-modal-body');
  const titleEl = document.getElementById('media-modal-title');
  titleEl.textContent = title || '';
  modalEl.setAttribute('data-url', url);

  // Clear
  body.innerHTML = '';

  // Render by mime
  if (mime && mime.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = title || 'Image';
    img.style.maxWidth = '85vw';
    img.style.maxHeight = '75vh';
    img.style.objectFit = 'contain';
    body.appendChild(img);
  } else if (mime && mime.startsWith('video/')) {
    const vid = document.createElement('video');
    vid.controls = true;
    vid.src = url;
    vid.style.maxWidth = '85vw';
    vid.style.maxHeight = '75vh';
    body.appendChild(vid);
  } else if (mime && mime.startsWith('audio/')) {
    const aud = document.createElement('audio');
    aud.controls = true;
    aud.src = url;
    aud.style.width = '80vw';
    body.appendChild(aud);
  } else if (mime === 'application/pdf') {
    const ifr = document.createElement('iframe');
    ifr.src = url;
    ifr.style.width = '85vw';
    ifr.style.height = '75vh';
    body.appendChild(ifr);
  } else {
    const div = document.createElement('div');
    div.innerHTML = `<div>Preview not available. <a href="${url}" target="_blank" rel="noopener">Open</a></div>`;
    body.appendChild(div);
  }

  overlayEl.style.display = 'block';
  modalEl.style.display = 'block';
  document.getElementById('media-modal-close').focus();
}

export function closeModal() {
  if (!modalEl) return;
  overlayEl.style.display = 'none';
  modalEl.style.display = 'none';
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
}

