import { getComplaintDetails, formatBytes, getSignedUrl } from './complaintDetailsCache.js';
import { openMediaModal } from './MediaPreviewModal.js';

function mediaType(mime) {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

function groupEvidence(evidence = []) {
  const groups = { image: [], video: [], audio: [], pdf: [], other: [] };
  evidence.forEach((e) => groups[mediaType(e.fileType)].push(e));
  return groups;
}

function renderMediaList(complaintId, evidence = []) {
  const groups = groupEvidence(evidence);
  const section = (label, items) => {
    if (!items || items.length === 0) return '';
    const itemsHtml = items.map((e, idx) => {
      const btnAttrs = [
        'data-media-preview' ,
        `data-complaint-id="${complaintId}"`,
        `data-file-name="${e.fileName || ''}"`,
        `data-file-type="${e.fileType || ''}"`,
        e.publicUrl ? `data-public-url="${e.publicUrl}"` : '',
        e.filePath ? `data-file-path="${e.filePath}"` : ''
      ].filter(Boolean).join(' ');
      return `
        <div class="media-row" style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;">
          <div>
            <div style="font-weight:600;font-size:13px;">${e.fileName || 'File'}</div>
            <div style="color:#7f8c8d;font-size:12px;">${e.fileType || 'unknown'} • ${formatBytes(e.fileSize)}</div>
          </div>
          <div>
            <button type="button" class="btn btn-small" ${btnAttrs}>Preview</button>
          </div>
        </div>
      `;
    }).join('');
    return `
      <div class="media-section" style="margin-top:10px;">
        <div style="font-weight:700;color:#2c3e50;margin-bottom:6px;">${label}</div>
        ${itemsHtml}
      </div>
    `;
  };

  return `
    ${section('Images', groups.image)}
    ${section('Videos', groups.video)}
    ${section('Audio', groups.audio)}
    ${section('PDFs', groups.pdf)}
    ${section('Other Files', groups.other)}
  `;
}

function renderDetails(data) {
  const info = `
    <div style="padding:8px 0;">
      <div><strong>Type:</strong> ${data.type || ''}</div>
      <div><strong>Status:</strong> ${data.status || ''}</div>
      <div><strong>Location:</strong> ${data.location_text || ''}</div>
      <div><strong>Departments:</strong> ${(data.department_r || []).join(', ')}</div>
    </div>
  `;
  const media = renderMediaList(data.id, data.evidence || []);
  return info + media;
}

async function handleDropdownClick(button) {
  const id = button.getAttribute('data-complaint-id');
  const panel = document.querySelector(`[data-complaint-panel="${id}"]`);
  const open = panel.getAttribute('data-open') === 'true';
  if (open) {
    panel.setAttribute('data-open', 'false');
    panel.style.display = 'none';
    return;
  }
  panel.innerHTML = '<div class="loading">Loading…</div>';
  panel.style.display = '';
  try {
    const data = await getComplaintDetails(id);
    panel.innerHTML = renderDetails(data);
    panel.setAttribute('data-open', 'true');
  } catch (e) {
    panel.innerHTML = `<div class="error">Failed to load. <button data-retry="${id}">Retry</button></div>`;
  }
}

async function handlePreviewClick(btn) {
  const complaintId = btn.getAttribute('data-complaint-id');
  const fileType = btn.getAttribute('data-file-type') || 'application/octet-stream';
  const title = btn.getAttribute('data-file-name') || 'File';
  const publicUrl = btn.getAttribute('data-public-url');
  const filePath = btn.getAttribute('data-file-path');
  let url = publicUrl;
  if (!url && filePath) {
    try {
      url = await getSignedUrl(complaintId, filePath);
    } catch (e) {
      // fallback: open in new tab endpoint if available
    }
  }
  if (!url) return;
  openMediaModal({ url, mime: fileType, title });
}

export function initComplaintDropdowns(root = document) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-complaint-dropdown]');
    if (btn) {
      e.preventDefault();
      await handleDropdownClick(btn);
      return;
    }
    const retry = e.target.closest('[data-retry]');
    if (retry) {
      const id = retry.getAttribute('data-retry');
      const trigger = root.querySelector(`[data-complaint-dropdown][data-complaint-id="${id}"]`);
      if (trigger) handleDropdownClick(trigger);
      return;
    }
    const previewBtn = e.target.closest('[data-media-preview]');
    if (previewBtn) {
      e.preventDefault();
      await handlePreviewClick(previewBtn);
    }
  });
}

