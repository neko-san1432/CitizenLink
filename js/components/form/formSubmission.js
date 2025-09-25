// Supabase Complaint Form Submission Template
// Usage:
// 1) Import this module on the complaint page:
//    <script type="module" src="../js/components/form/formSubmission.js"></script>
// 2) Call registerComplaintForm() after DOMContentLoaded OR rely on auto-init below
// 3) Ensure there is a form with id="complaintForm" and hidden fields
//    for latitude/longitude and file input with id="evidenceFiles" (optional)

import { supabase } from '../../config/config.js';

// Optional toast helper if available in your project
let showMessage = (type, text) => console.log(`[${type}]`, text);
try {
  const m = await import('../toast.js');
  showMessage = m.default || m.showMessage || showMessage;
} catch {}

async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = data?.session?.user;
  if (!user) {
    showMessage('error', 'You must be signed in to submit a complaint.');
    throw new Error('No authenticated user');
  }
  return user;
}

function normalizeString(value) {
  return (value == null ? '' : String(value)).trim();
}

function parseJsonOrString(value) {
  if (Array.isArray(value)) return value;
  const s = normalizeString(value);
  if (!s) return [];
  try { return JSON.parse(s); } catch { return [s]; }
}

async function uploadEvidenceFiles(files, userId) {
  if (!files || files.length === 0) return [];
  // Configure your bucket name here
  const bucket = 'evidence';
  const uploaded = [];
  for (const file of files) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) {
      console.warn('File upload failed:', file.name, error.message);
      continue;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    uploaded.push({ path, url: pub?.publicUrl || null, name: file.name, type: file.type, size: file.size });
  }
  return uploaded;
}

async function insertComplaint(payload) {
  // Configure your table name here
  const table = 'complaints';
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function handleComplaintSubmit(formEl) {
  const submitBtn = formEl.querySelector('.submit-btn');
  const original = submitBtn ? submitBtn.textContent : '';
  try {
    if (submitBtn) { submitBtn.textContent = 'Submitting...'; submitBtn.disabled = true; }

    const user = await requireSession();

    // Collect basic fields
    const title = normalizeString(formEl.complaintTitle?.value);
    const type = normalizeString(formEl.complaintType?.value);
    const subtype = normalizeString(formEl.complaintSubtype?.value);
    const description = normalizeString(formEl.description?.value);
    const locationText = normalizeString(formEl.location?.value);
    const latitude = Number(normalizeString(formEl.latitude?.value)) || null;
    const longitude = Number(normalizeString(formEl.longitude?.value)) || null;

    // Departments (checkboxes name="department")
    const departments = Array.from(formEl.querySelectorAll('input[name="department"]:checked'))
      .map(cb => normalizeString(cb.value));

    // Evidence files
    const evidenceInput = formEl.querySelector('#evidenceFiles');
    const files = evidenceInput?.files || [];
    const uploaded = await uploadEvidenceFiles(files, user.id);

    // Build payload
    const payload = {
      user_id: user.id,
      title,
      type,
      subtype,
      description,
      location_text: locationText,
      latitude,
      longitude,
      departments,
      evidence: uploaded, // array of { path, url, name, type, size }
      status: 'submitted'
    };

    // Basic validation
    if (!payload.title || !payload.description || !payload.location_text) {
      showMessage('error', 'Please complete the required fields.');
      return;
    }

    const saved = await insertComplaint(payload);
    showMessage('success', 'Complaint submitted successfully.');
    return saved;
  } catch (e) {
    console.error('Complaint submission failed:', e);
    showMessage('error', e?.message || 'Failed to submit complaint.');
    throw e;
  } finally {
    if (submitBtn) { submitBtn.textContent = original; submitBtn.disabled = false; }
  }
}

export function registerComplaintForm(formId = 'complaintForm') {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleComplaintSubmit(form);
  });
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  registerComplaintForm();
});


