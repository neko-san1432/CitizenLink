/**
 * LGU Profile Management
 * Handles LGU user profile management and updates
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('LGU Profile Management initialized');
    
    // Initialize user data
    const user = await window.userUtils?.initializeUserData();
    if (!user) {
        console.error('User not authenticated');
        return;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Load user profile data
    await loadProfileData();
});

// Setup event listeners
function setupEventListeners() {
    // Save profile button
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            await saveProfile();
        });
    }
    
    // Reset profile button
    const resetProfileBtn = document.getElementById('reset-profile-btn');
    if (resetProfileBtn) {
        resetProfileBtn.addEventListener('click', () => {
            resetProfileForm();
        });
    }
    
    // Form field change listeners for real-time validation
    const form = document.getElementById('lgu-profile-form');
    if (form) {
        const requiredFields = form.querySelectorAll('[required]');
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => {
                validateField(field);
            });
        });
    }
}

// Load profile data
async function loadProfileData() {
    try {
        console.log('Loading LGU profile data...');
        
        // Show loading state
        showLoadingState();
        
        // Get user from session storage
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        
        if (!user.id) {
            console.error('No user found in session');
            hideLoadingState();
            return;
        }
        
        // Fetch additional profile data from Supabase if available
        let profileData = user;
        
        if (window.getLGUProfile) {
            try {
                const supabaseProfile = await window.getLGUProfile(user.id);
                if (supabaseProfile) {
                    profileData = { ...user, ...supabaseProfile };
                }
            } catch (error) {
                console.warn('Could not fetch Supabase profile, using session data:', error);
            }
        }
        
        // Populate form with profile data
        populateProfileForm(profileData);
        
        // Hide loading state
        hideLoadingState();
        
    } catch (error) {
        console.error('Error loading profile data:', error);
        hideLoadingState();
        showToast('Error loading profile data', 'error');
    }
}

// Populate profile form
function populateProfileForm(profileData) {
    const form = document.getElementById('lgu-profile-form');
    if (!form) return;
    
    // Basic user info (read-only)
    const fullNameField = form.querySelector('[name="full_name"]');
    if (fullNameField) {
        fullNameField.value = profileData.name || profileData.full_name || '';
        fullNameField.readOnly = true;
        fullNameField.classList.add('form-control-plaintext');
    }
    
    const emailField = form.querySelector('[name="email"]');
    if (emailField) {
        emailField.value = profileData.email || '';
        emailField.readOnly = true;
        emailField.classList.add('form-control-plaintext');
    }
    
    // LGU-specific fields
    const departmentField = form.querySelector('[name="department"]');
    if (departmentField) {
        departmentField.value = profileData.department || '';
    }
    
    const positionField = form.querySelector('[name="position"]');
    if (positionField) {
        positionField.value = profileData.position || '';
    }
    
    const officeAddressField = form.querySelector('[name="office_address"]');
    if (officeAddressField) {
        officeAddressField.value = profileData.office_address || '';
    }
    
    const officeHoursField = form.querySelector('[name="office_hours"]');
    if (officeHoursField) {
        officeHoursField.value = profileData.office_hours || '';
    }
    
    const phoneField = form.querySelector('[name="phone"]');
    if (phoneField) {
        phoneField.value = profileData.phone || '';
    }
    
    const emergencyContactField = form.querySelector('[name="emergency_contact"]');
    if (emergencyContactField) {
        emergencyContactField.value = profileData.emergency_contact || '';
    }
    
    // Notification preferences
    const emailNotificationsField = form.querySelector('[name="email_notifications"]');
    if (emailNotificationsField) {
        emailNotificationsField.checked = profileData.email_notifications !== false;
    }
    
    const smsNotificationsField = form.querySelector('[name="sms_notifications"]');
    if (smsNotificationsField) {
        smsNotificationsField.checked = profileData.sms_notifications !== false;
    }
    
    const pushNotificationsField = form.querySelector('[name="push_notifications"]');
    if (pushNotificationsField) {
        pushNotificationsField.checked = profileData.push_notifications !== false;
    }
    
    // System preferences
    const languageField = form.querySelector('[name="language"]');
    if (languageField) {
        languageField.value = profileData.language || 'en';
    }
    
    const timezoneField = form.querySelector('[name="timezone"]');
    if (timezoneField) {
        timezoneField.value = profileData.timezone || 'UTC';
    }
    
    const themeField = form.querySelector('[name="theme"]');
    if (themeField) {
        themeField.value = profileData.theme || 'light';
    }
    
    console.log('Profile form populated with data:', profileData);
}

// Save profile
async function saveProfile() {
    try {
        const form = document.getElementById('lgu-profile-form');
        if (!form) return;
        
        // Validate form
        if (!validateForm()) {
            showToast('Please fix the errors in the form', 'error');
            return;
        }
        
        // Show saving state
        showSavingState();
        
        // Get form data
        const formData = new FormData(form);
        const profileData = {
            department: formData.get('department'),
            position: formData.get('position'),
            office_address: formData.get('office_address'),
            office_hours: formData.get('office_hours'),
            phone: formData.get('phone'),
            emergency_contact: formData.get('emergency_contact'),
            email_notifications: formData.get('email_notifications') === 'on',
            sms_notifications: formData.get('sms_notifications') === 'on',
            push_notifications: formData.get('push_notifications') === 'on',
            language: formData.get('language'),
            timezone: formData.get('timezone'),
            theme: formData.get('theme')
        };
        
        // Get user from session
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        
        if (!user.id) {
            throw new Error('No user found in session');
        }
        
        // Save to Supabase
        let savedProfile;
        if (window.updateLGUProfile) {
            savedProfile = await window.updateLGUProfile(user.id, profileData);
        } else {
            // Fallback to mock update
            savedProfile = updateMockLGUProfile(user.id, profileData);
        }
        
        if (savedProfile) {
            // Update session storage with new profile data
            const updatedUser = { ...user, ...profileData };
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
            
            showToast('Profile updated successfully!', 'success');
            
            // Refresh sidebar user name if available
            if (window.refreshSidebarUserName) {
                window.refreshSidebarUserName();
            }
        }
        
        // Hide saving state
        hideSavingState();
        
    } catch (error) {
        console.error('Error saving profile:', error);
        hideSavingState();
        showToast('Error saving profile', 'error');
    }
}

// Validate form
function validateForm() {
    const form = document.getElementById('lgu-profile-form');
    if (!form) return false;
    
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Validate individual field
function validateField(field) {
    const value = field.value.trim();
    const isRequired = field.hasAttribute('required');
    
    // Remove existing validation classes
    field.classList.remove('is-valid', 'is-invalid');
    
    // Check if required field is empty
    if (isRequired && !value) {
        field.classList.add('is-invalid');
        showFieldError(field, 'This field is required');
        return false;
    }
    
    // Validate email format
    if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            field.classList.add('is-invalid');
            showFieldError(field, 'Please enter a valid email address');
            return false;
        }
    }
    
    // Validate phone format
    if (field.name === 'phone' && value) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
            field.classList.add('is-invalid');
            showFieldError(field, 'Please enter a valid phone number');
            return false;
        }
    }
    
    // Field is valid
    field.classList.add('is-valid');
    hideFieldError(field);
    return true;
}

// Show field error
function showFieldError(field, message) {
    // Remove existing error message
    hideFieldError(field);
    
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback';
    errorDiv.textContent = message;
    errorDiv.id = `${field.id || field.name}-error`;
    
    // Insert after the field
    field.parentNode.appendChild(errorDiv);
}

// Hide field error
function hideFieldError(field) {
    const errorId = `${field.id || field.name}-error`;
    const existingError = document.getElementById(errorId);
    if (existingError) {
        existingError.remove();
    }
}

// Reset profile form
function resetProfileForm() {
    const form = document.getElementById('lgu-profile-form');
    if (!form) return;
    
    // Reset form to original values
    loadProfileData();
    
    // Clear validation states
    const fields = form.querySelectorAll('.is-valid, .is-invalid');
    fields.forEach(field => {
        field.classList.remove('is-valid', 'is-invalid');
    });
    
    // Clear error messages
    const errorMessages = form.querySelectorAll('.invalid-feedback');
    errorMessages.forEach(error => error.remove());
    
    showToast('Form reset to original values', 'info');
}

// Show loading state
function showLoadingState() {
    const profileContent = document.getElementById('profile-content');
    if (profileContent) {
        profileContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading profile data...</p>
            </div>
        `;
    }
}

// Hide loading state
function hideLoadingState() {
    // Loading state is cleared when populateProfileForm is called
}

// Show saving state
function showSavingState() {
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Saving...
        `;
    }
}

// Hide saving state
function hideSavingState() {
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Changes';
    }
}

// Mock functions (fallback when Supabase functions aren't available)
function updateMockLGUProfile(userId, profileData) {
    // In a real app, this would update the database
    console.log('Mock update LGU profile:', userId, profileData);
    return {
        id: userId,
        ...profileData,
        updated_at: new Date().toISOString()
    };
}

// Utility functions
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    // Create toast content
    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}
