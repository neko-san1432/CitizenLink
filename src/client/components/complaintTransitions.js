// Minimal client-side binder for officer/admin/citizen transitions

async function sendTransition(complaintId, payload = {}, files = []) {
  const form = new FormData();
  // Status and optional text fields
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, v);
  });
  // Evidence files (optional)
  files.forEach((file) => form.append('evidenceFiles', file));

  const res = await fetch(`/api/complaints/${encodeURIComponent(complaintId)}/transition`, {
    method: 'PATCH',
    body: form
  });
  if (!res.ok) throw new Error('Transition failed');
  return res.json();
}

function collectEvidenceFiles(scopeEl) {
  const input = scopeEl.querySelector('input[type="file"][data-evidence]');
  if (!input || !input.files) return [];
  return Array.from(input.files);
}

export function initComplaintTransitions(root = document) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-transition]');
    if (!btn) return;

    const action = btn.getAttribute('data-transition');
    const container = btn.closest('[data-complaint-id]') || root;
    const complaintId = container.getAttribute('data-complaint-id') || btn.getAttribute('data-complaint-id');
    if (!complaintId) return;

    btn.disabled = true;
    try {
      let payload = {};
      let files = [];
      switch (action) {
      case 'officer-submit-approval': {
        const notes = (container.querySelector('[data-resolution-notes]') || {}).value || '';
        payload = { status: 'pending_approval', resolution_notes: notes };
        files = collectEvidenceFiles(container);
        break;
      }
      case 'admin-approve': {
        payload = { status: 'pending_citizen_confirmation' };
        break;
      }
      case 'admin-request-changes': {
        const notes = (container.querySelector('[data-admin-notes]') || {}).value || '';
        payload = { status: 'in progress', admin_notes: notes };
        break;
      }
      case 'citizen-confirm': {
        payload = { status: 'resolved' };
        break;
      }
      // Citizens cannot send a not-satisfied transition anymore
      default:
        btn.disabled = false;
        return;
      }
      const result = await sendTransition(complaintId, payload, files);
      // Simple UI hint; integrate with your toast if desired
      console.log('[TRANSITION] OK', result);
      btn.dispatchEvent(new CustomEvent('transition:success', { bubbles: true, detail: { complaintId, action, result } }));
    } catch (err) {
      console.error('[TRANSITION] Failed', err);
      btn.dispatchEvent(new CustomEvent('transition:error', { bubbles: true, detail: { complaintId, action, error: err } }));
      alert('Failed to update. Please try again.');
    } finally {
      btn.disabled = false;
    }
  });
}

