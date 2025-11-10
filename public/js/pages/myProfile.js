import { getUserRole, refreshMetaFromSession } from '../auth/authChecker.js';
import showMessage from '../components/toast.js';

async function checkAuthentication() {
  try {
    // Check if user is authenticated
    let role = await getUserRole({ refresh: false });
    if (!role) {
      const refreshed = await refreshMetaFromSession();
      role = refreshed?.role || null;
    }
    if (!role) {
      // No role means not authenticated, redirect to login
      window.location.href = '/login';
      return false;
    }
    // All authenticated users (regardless of role) can access profile
    return true;
  } catch {
    window.location.href = '/login';
    return false;
  }
}
async function fetchProfile() {
  const res = await fetch('/api/auth/profile');
  if (!res.ok) throw new Error('Failed to load profile');
  const json = await res.json();
  return json?.data || {};
}
async function fetchMyComplaints(role) {
  try {
    // For staff roles, fetch assignments instead of complaints
    const roleLower = role?.toLowerCase() || 'citizen';
    if (roleLower === 'lgu' || roleLower === 'lgu-officer') {
      // LGU Officer: fetch assigned tasks
      const res = await fetch('/api/lgu/assigned-tasks?limit=20');
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          return [];
        }
        throw new Error('Failed to load assignments');
      }
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    } else if (roleLower === 'lgu-admin') {
      // LGU Admin: fetch department assignments
      const res = await fetch('/api/lgu-admin/department-assignments?limit=20');
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          return [];
        }
        throw new Error('Failed to load assignments');
      }
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    }
    // Citizen and other roles: fetch complaints
    const res = await fetch('/api/complaints/my?limit=20');
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        return [];
      }
      throw new Error('Failed to load complaints');
    }
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];

  } catch (error) {
    console.warn('Could not fetch data:', error.message);
    return [];
  }
}
function formatRoleDisplay(role) {
  if (!role) return '—';
  const roleLower = role.toLowerCase();
  // Format role names for display
  const roleMap = {
    'citizen': 'Citizen',
    'super-admin': 'Super Admin',
    'complaint-coordinator': 'Complaint Coordinator',
    'lgu-admin': 'LGU Admin',
    'lgu': 'LGU Officer',
    'lgu-hr': 'LGU HR',
    'lgu-officer': 'LGU Officer'
  };
  return roleMap[roleLower] || role.charAt(0).toUpperCase() + role.slice(1).replace(/-/g, ' ');
}

function renderProfile(profile) {
  const name = profile?.name || profile?.full_name || 'User';
  const email = profile?.email || '—';
  // Mobile number from raw_user_meta_data (already extracted in backend)
  const mobile = profile?.mobileNumber || profile?.mobile_number || profile?.mobile || '—';
  // Get role and department
  const role = profile?.role || profile?.normalizedRole || profile?.normalized_role || 'citizen';
  const department = profile?.department || profile?.dpt || null;
  const employeeId = profile?.employeeId || profile?.employee_id || null;

  // Update profile name display
  const nameDisplayEl = document.getElementById('profile-name-display');
  if (nameDisplayEl) {
    nameDisplayEl.textContent = name;
  }

  // Update email display
  const emailDisplayEl = document.getElementById('profile-email-display');
  const currentEmailDisplayEl = document.getElementById('current-email-display');
  if (emailDisplayEl) {
    emailDisplayEl.textContent = email;
  }
  if (currentEmailDisplayEl) {
    currentEmailDisplayEl.textContent = email;
  }

  // Update avatar initial
  const initialEl = document.getElementById('profile-initial');
  if (initialEl && name !== '—') {
    initialEl.textContent = name.charAt(0).toUpperCase();
  }

  // Update mobile display
  const mobileDisplayEl = document.getElementById('profile-mobile-display');
  if (mobileDisplayEl) {
    mobileDisplayEl.textContent = mobile || '—';
  }

  // Update role
  const roleEl = document.getElementById('profile-role');
  if (roleEl) {
    roleEl.textContent = formatRoleDisplay(role);
  }

  // Update office/department - only show for lgu-admin and lgu (officer) roles
  const officeItemEl = document.getElementById('profile-office-item');
  const officeEl = document.getElementById('profile-office');
  const roleLower = role.toLowerCase().trim();

  const shouldShowOffice = (roleLower === 'lgu-admin' || roleLower === 'lgu' || roleLower === 'lgu-officer') &&
                           !['citizen', 'super-admin', 'complaint-coordinator'].includes(roleLower);

  if (officeItemEl && officeEl) {
    if (shouldShowOffice && department) {
      officeItemEl.style.display = 'flex';
      officeEl.textContent = department || '—';
    } else {
      officeItemEl.style.display = 'none';
    }
  }

  // Update Position ID (only if user has value)
  const positionIdItemEl = document.getElementById('profile-position-id-item');
  const positionIdEl = document.getElementById('profile-position-id');
  if (positionIdItemEl && positionIdEl) {
    if (employeeId) {
      positionIdItemEl.style.display = 'flex';
      positionIdEl.textContent = employeeId;
    } else {
      positionIdItemEl.style.display = 'none';
    }
  }

  // Update member since date
  const memberSinceEl = document.getElementById('member-since');
  const createdDate = profile?.created_at || profile?.timestamps?.created;
  if (memberSinceEl && createdDate) {
    const date = new Date(createdDate);
    if (!isNaN(date.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      memberSinceEl.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } else {
      memberSinceEl.textContent = '—';
    }
  } else if (memberSinceEl) {
    memberSinceEl.textContent = '—';
  }

  // Update address display
  const address = profile?.address || {};
  const addressLine1 = address?.line1 || address?.address_line_1 || null;
  const addressLine2 = address?.line2 || address?.address_line_2 || null;
  const city = address?.city || null;
  const province = address?.province || null;
  const postalCode = address?.postalCode || address?.postal_code || null;
  const barangay = address?.barangay || null;

  const addressLine1Display = document.getElementById('address-line-1-display');
  const addressLine2Display = document.getElementById('address-line-2-display');
  const cityDisplay = document.getElementById('address-city-display');
  const provinceDisplay = document.getElementById('address-province-display');
  const postalDisplay = document.getElementById('address-postal-display');
  const barangayDisplay = document.getElementById('address-barangay-display');

  if (addressLine1Display) addressLine1Display.textContent = addressLine1 || '—';
  if (addressLine2Display) {
    if (addressLine2) {
      addressLine2Display.textContent = addressLine2;
      addressLine2Display.style.display = 'block';
    } else {
      addressLine2Display.style.display = 'none';
    }
  }
  if (cityDisplay) cityDisplay.textContent = city || '—';
  if (provinceDisplay) provinceDisplay.textContent = province || '—';
  if (postalDisplay) postalDisplay.textContent = postalCode ? `(${postalCode})` : '';
  if (barangayDisplay) barangayDisplay.textContent = barangay || '—';
}
function renderComplaints(list, role) {
  const container = document.getElementById('my-complaints');
  const empty = document.getElementById('complaints-empty');
  const emptyTitle = document.getElementById('empty-title');
  const emptyMessage = document.getElementById('empty-message');
  if (!container || !empty) return;

  const roleLower = role?.toLowerCase() || 'citizen';
  const isStaff = roleLower === 'lgu' || roleLower === 'lgu-officer' || roleLower === 'lgu-admin';

  container.innerHTML = '';
  if (!list.length) {
    empty.classList.remove('hidden');
    if (emptyTitle) {
      emptyTitle.textContent = isStaff ? 'No assignments yet' : 'No complaints yet';
    }
    if (emptyMessage) {
      emptyMessage.textContent = isStaff
        ? 'You don\'t have any active assignments at the moment.'
        : 'You haven\'t filed any complaints yet. Click "File a complaint" to get started!';
    }
    return;
  }
  empty.classList.add('hidden');

  for (const itemData of list) {
    const item = document.createElement('div');
    item.className = 'complaint-card';

    // Handle assignments (for staff) vs complaints (for citizens)
    const title = itemData.title || itemData.complaints?.title || 'Assignment';
    const complaintId = itemData.complaint_id || itemData.id;
    const date = itemData.submitted_at || itemData.assigned_at || itemData.created_at;
    const status = (itemData.status || itemData.workflow_status || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const statusLabel = formatStatus(itemData.status || itemData.workflow_status);

    const dateStr = date ? new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : '';

    item.innerHTML = `
      <div class="complaint-card-header">
        <div class="complaint-title">${title}</div>
        <a class="btn-secondary" href="/complaint-details/${complaintId}" style="text-decoration: none; flex-shrink: 0;">View</a>
      </div>
      <div class="complaint-meta">
        <span class="status-badge status-${status}">${statusLabel}</span>
        <span class="complaint-date">${dateStr}</span>
      </div>
    `;
    container.appendChild(item);
  }
}
function formatStatus(status) {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
function updateStatistics(complaints) {
  // Statistics are no longer displayed in the compact layout
  // This function is kept for backward compatibility but does nothing
}
function scrollToAnchorIfNeeded() {
  // Anchor scrolling no longer needed with new layout
  // This function is kept for backward compatibility but does nothing
}
function wireChangePassword() {
  const form = document.getElementById('change-password-form');
  const messageEl = document.getElementById('email-confirmation-message');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password')?.value || '';
    const newPassword = document.getElementById('new-password')?.value || '';
    const confirmNewPassword = document.getElementById('confirm-new-password')?.value || '';
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showMessage('error', 'All password fields are required', 4000);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showMessage('error', 'New passwords do not match', 4000);
      return;
    }
    try {
      const res = await fetch('/api/auth/request-password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to request password change');
      // Show success message with email confirmation info
      if (messageEl) {
        messageEl.textContent = json.message || 'A confirmation email has been sent to your email address. Please check your inbox and click the confirmation link to complete the password change.';
        messageEl.classList.remove('hidden');
      }
      showMessage('success', 'Password change request sent! Please check your email for confirmation.', 5000);
      form.reset();
      // Hide message after 10 seconds
      setTimeout(() => {
        if (messageEl) messageEl.classList.add('hidden');
      }, 10000);
    } catch (err) {
      showMessage('error', err.message || 'Failed to request password change', 4000);
      if (messageEl) messageEl.classList.add('hidden');
    }
  });
}

// Form toggle handler
function wireFormToggle() {
  const toggleBtn = document.getElementById('toggle-edit-form');
  const form = document.getElementById('profile-edit-form');
  const cancelBtn = document.getElementById('cancel-edit-form');

  if (toggleBtn && form) {
    toggleBtn.addEventListener('click', () => {
      form.style.display = 'flex';
      toggleBtn.style.display = 'none';
    });
  }

  if (cancelBtn && form && toggleBtn) {
    cancelBtn.addEventListener('click', () => {
      form.style.display = 'none';
      toggleBtn.style.display = 'block';
      form.reset();
    });
  }
}

// Name inline editing
function wireNameEdit() {
  const editIcon = document.getElementById('edit-name-icon');
  const nameDisplay = document.getElementById('profile-name-display');
  const nameEdit = document.getElementById('profile-name-edit');
  const nameInput = document.getElementById('edit-name-input');
  const saveBtn = document.getElementById('save-name-btn');
  const cancelBtn = document.getElementById('cancel-name-btn');

  if (!editIcon || !nameDisplay || !nameEdit || !nameInput) return;

  editIcon.addEventListener('click', () => {
    nameDisplay.style.display = 'none';
    editIcon.style.display = 'none';
    nameEdit.style.display = 'flex';
    nameInput.value = nameDisplay.textContent;
    nameInput.focus();
  });

  cancelBtn?.addEventListener('click', () => {
    nameEdit.style.display = 'none';
    nameDisplay.style.display = 'inline';
    editIcon.style.display = 'inline';
  });

  saveBtn?.addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    if (!newName || newName.length < 2) {
      showMessage('error', 'Name must be at least 2 characters', 3000);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    nameEdit.classList.add('inline-edit-loading');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to update name');

      // Update display
      nameDisplay.textContent = newName;
      nameEdit.style.display = 'none';
      nameDisplay.style.display = 'inline';
      editIcon.style.display = 'inline';

      // Update avatar initial
      const initialEl = document.getElementById('profile-initial');
      if (initialEl) {
        initialEl.textContent = newName.charAt(0).toUpperCase();
      }

      showMessage('success', 'Name updated successfully', 3000);
    } catch (err) {
      showMessage('error', err.message || 'Failed to update name', 4000);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      nameEdit.classList.remove('inline-edit-loading');
    }
  });
}

// Email modal handler
function wireEmailEdit() {
  const editIcon = document.getElementById('edit-email-icon');
  const modal = document.getElementById('email-change-modal');
  const closeBtn = document.getElementById('close-email-modal');
  const cancelBtn = document.getElementById('cancel-email-modal');
  const form = document.getElementById('email-change-form');
  const newEmailInput = document.getElementById('new-email-input');
  const currentPasswordInput = document.getElementById('current-password-email');

  if (!editIcon || !modal) return;

  editIcon.addEventListener('click', () => {
    modal.style.display = 'flex';
    newEmailInput?.focus();
  });

  const closeModal = () => {
    modal.style.display = 'none';
    form?.reset();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newEmail = newEmailInput?.value.trim() || '';
    const currentPassword = currentPasswordInput?.value || '';

    if (!newEmail || !currentPassword) {
      showMessage('error', 'Both email and password are required', 3000);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      const res = await fetch('/api/auth/request-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, currentPassword })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to request email change');

      showMessage('success', json.message || 'Confirmation email sent! Please check your new email inbox.', 5000);
      closeModal();
    } catch (err) {
      showMessage('error', err.message || 'Failed to request email change', 4000);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Request Email Change';
      }
    }
  });
}

// Mobile inline editing
function wireMobileEdit() {
  const editIcon = document.getElementById('edit-mobile-icon');
  const mobileDisplay = document.getElementById('profile-mobile-display');
  const mobileEdit = document.getElementById('profile-mobile-edit');
  const mobileInput = document.getElementById('edit-mobile-input');
  const saveBtn = document.getElementById('save-mobile-btn');
  const cancelBtn = document.getElementById('cancel-mobile-btn');

  if (!editIcon || !mobileDisplay || !mobileEdit || !mobileInput) return;

  editIcon.addEventListener('click', () => {
    mobileDisplay.style.display = 'none';
    editIcon.style.display = 'none';
    mobileEdit.style.display = 'block';
    mobileInput.value = mobileDisplay.textContent === '—' ? '' : mobileDisplay.textContent;
    mobileInput.focus();
  });

  cancelBtn?.addEventListener('click', () => {
    mobileEdit.style.display = 'none';
    mobileDisplay.style.display = 'inline';
    editIcon.style.display = 'inline';
  });

  saveBtn?.addEventListener('click', async () => {
    const newMobile = mobileInput.value.trim();

    // Basic phone validation (Philippines format: +63XXXXXXXXXX or 09XXXXXXXXX)
    if (newMobile && !/^(\+63|0)?9\d{9}$/.test(newMobile.replace(/\s+/g, ''))) {
      showMessage('error', 'Please enter a valid mobile number', 3000);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    mobileEdit.classList.add('inline-edit-loading');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: newMobile })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to update mobile');

      // Update display
      mobileDisplay.textContent = newMobile || '—';
      mobileEdit.style.display = 'none';
      mobileDisplay.style.display = 'inline';
      editIcon.style.display = 'inline';

      showMessage('success', 'Mobile number updated successfully', 3000);
    } catch (err) {
      showMessage('error', err.message || 'Failed to update mobile', 4000);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      mobileEdit.classList.remove('inline-edit-loading');
    }
  });
}

// Address editing
function wireAddressEdit() {
  const editBtn = document.getElementById('edit-address-btn');
  const addressDisplay = document.getElementById('address-display');
  const addressEdit = document.getElementById('address-edit');
  const saveBtn = document.getElementById('save-address-btn');
  const cancelBtn = document.getElementById('cancel-address-btn');

  if (!editBtn || !addressDisplay || !addressEdit) return;

  editBtn.addEventListener('click', () => {
    addressDisplay.style.display = 'none';
    editBtn.style.display = 'none';
    addressEdit.style.display = 'flex';

    // Prefill inputs
    const line1El = document.getElementById('edit-address-line-1');
    const line2El = document.getElementById('edit-address-line-2');
    const cityEl = document.getElementById('edit-address-city');
    const provinceEl = document.getElementById('edit-address-province');
    const postalEl = document.getElementById('edit-address-postal');
    const barangayEl = document.getElementById('edit-address-barangay');

    const line1Display = document.getElementById('address-line-1-display');
    const line2Display = document.getElementById('address-line-2-display');
    const cityDisplay = document.getElementById('address-city-display');
    const provinceDisplay = document.getElementById('address-province-display');
    const postalDisplay = document.getElementById('address-postal-display');
    const barangayDisplay = document.getElementById('address-barangay-display');

    if (line1El && line1Display) line1El.value = line1Display.textContent === '—' ? '' : line1Display.textContent;
    if (line2El && line2Display) line2El.value = line2Display.textContent === '—' ? '' : line2Display.textContent;
    if (cityEl && cityDisplay) cityEl.value = cityDisplay.textContent === '—' ? '' : cityDisplay.textContent;
    if (provinceEl && provinceDisplay) provinceEl.value = provinceDisplay.textContent === '—' ? '' : provinceDisplay.textContent;
    if (postalEl && postalDisplay) {
      const postalText = postalDisplay.textContent.replace(/[()]/g, '').trim();
      postalEl.value = postalText === '—' ? '' : postalText;
    }
    if (barangayEl && barangayDisplay) barangayEl.value = barangayDisplay.textContent === '—' ? '' : barangayDisplay.textContent;

    line1El?.focus();
  });

  cancelBtn?.addEventListener('click', () => {
    addressEdit.style.display = 'none';
    addressDisplay.style.display = 'block';
    editBtn.style.display = 'block';
  });

  saveBtn?.addEventListener('click', async () => {
    const line1 = document.getElementById('edit-address-line-1')?.value.trim() || '';
    const line2 = document.getElementById('edit-address-line-2')?.value.trim() || '';
    const city = document.getElementById('edit-address-city')?.value.trim() || '';
    const province = document.getElementById('edit-address-province')?.value.trim() || '';
    const postal = document.getElementById('edit-address-postal')?.value.trim() || '';
    const barangay = document.getElementById('edit-address-barangay')?.value.trim() || '';

    // Validate required fields
    if (!city || !province) {
      showMessage('error', 'City and province are required', 3000);
      return;
    }

    // Validate postal code format if provided
    if (postal && !/^\d{4}$/.test(postal)) {
      showMessage('error', 'Postal code must be 4 digits', 3000);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    addressEdit.classList.add('inline-edit-loading');

    try {
      const updateData = {
        address_line_1: line1,
        address_line_2: line2,
        city,
        province,
        postal_code: postal,
        barangay
      };

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to update address');

      // Re-render profile to update display
      const profile = await fetchProfile();
      renderProfile(profile);

      addressEdit.style.display = 'none';
      addressDisplay.style.display = 'block';
      editBtn.style.display = 'block';

      showMessage('success', 'Address updated successfully', 3000);
    } catch (err) {
      showMessage('error', err.message || 'Failed to update address', 4000);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
      addressEdit.classList.remove('inline-edit-loading');
    }
  });
}
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await checkAuthentication())) return;
  try {
    const profile = await fetchProfile();
    const role = profile?.role || profile?.normalizedRole || profile?.normalized_role || 'citizen';
    const roleLower = role.toLowerCase();
    const isStaff = roleLower === 'lgu' || roleLower === 'lgu-officer' || roleLower === 'lgu-admin';

    // Update UI based on role
    const titleEl = document.getElementById('content-title');
    const actionButton = document.getElementById('action-button');

    if (titleEl) {
      titleEl.textContent = isStaff ? 'Active Assignments' : 'Active Complaints';
    }

    if (actionButton) {
      if (isStaff) {
        actionButton.style.display = 'none';
      } else {
        actionButton.style.display = 'block';
      }
    }

    // Fetch data based on role
    const data = await fetchMyComplaints(role);

    renderProfile(profile);
    renderComplaints(data, role);

    // Prefill edit form (legacy form)
    const nameInput = document.getElementById('edit-name');
    const mobileInput = document.getElementById('edit-mobile');
    if (nameInput) nameInput.value = profile?.name || profile?.full_name || '';
    if (mobileInput) mobileInput.value = profile?.mobileNumber || profile?.mobile_number || profile?.mobile || '';
  } catch (err) {
    showMessage('error', err.message || 'Failed to load profile', 4000);
  }

  // Wire up all handlers
  wireChangePassword();
  wireFormToggle();
  wireNameEdit();
  wireEmailEdit();
  wireMobileEdit();
  wireAddressEdit();

  // Wire up legacy form (for backward compatibility)
  const form = document.getElementById('profile-edit-form');
  const toggleBtn = document.getElementById('toggle-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('edit-name')?.value || '').trim();
      const mobile = (document.getElementById('edit-mobile')?.value || '').trim();

      if (!name && !mobile) {
        showMessage('error', 'Enter a name or mobile number to update', 3000);
        return;
      }
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, mobileNumber: mobile })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to update profile');
        // Re-render with updated data
        renderProfile(json.data);
        // Hide form and show toggle button
        form.style.display = 'none';
        if (toggleBtn) toggleBtn.style.display = 'block';
        showMessage('success', 'Profile updated successfully', 3000);
      } catch (err) {
        showMessage('error', err.message || 'Update failed', 4000);
      }
    });
  }
});
