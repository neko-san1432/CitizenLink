document.addEventListener('DOMContentLoaded', async () => {
    // Initialize user data using shared utilities
    const user = await window.userUtils.initializeUserData();
    if (!user) return;
    
    // Setup profile form with user data
    setupProfileForm(user);

    // Setup cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
        window.location.href = '/dashboard';
    });
});

function setupProfileForm(user) {
    const profileForm = document.getElementById('profile-form');
    
    // Load user data from Supabase into form fields
    document.getElementById('full-name').value = user.name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('address').value = user.address || '';
    
    // Handle form submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            // Show loading state
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;
            
            // Get form data (name is read-only, so we don't include it in updates)
            const formData = {
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                address: document.getElementById('address').value
            };
            
            // Get password fields
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Check if changing password
            if (currentPassword || newPassword || confirmPassword) {
                if (!currentPassword) {
                    showToast('Please enter your current password', 'error');
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    showToast('New passwords do not match', 'error');
                    return;
                }
                
                // Add password change to form data
                formData.newPassword = newPassword;
            }
            
            // Update profile in Supabase
            const updatedUser = await window.userUtils.updateUserProfile(formData);
            
            if (updatedUser) {
                // Update local user data (name is read-only, so we don't update it)
                window.currentUser = {
                    ...window.currentUser,
                    phone: formData.phone,
                    address: formData.address
                };
                
                // Update header user name
                document.getElementById('header-user-name').textContent = formData.name;
                
                showToast('Profile updated successfully!');
                
                // Clear password fields
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
                
                
            }
            
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Failed to update profile. Please try again.', 'error');
        } finally {
            // Restore button state
            const submitBtn = profileForm.querySelector('button[type="submit"]');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    
    if (!toast) return;
    
    // Create toast elements
    const toastHeader = document.createElement('div');
    toastHeader.className = 'toast-header';
    
    const toastTitle = document.createElement('div');
    toastTitle.className = 'toast-title';
    toastTitle.textContent = type === 'success' ? 'Success' : 'Error';
    
    const toastClose = document.createElement('button');
    toastClose.className = 'toast-close';
    toastClose.innerHTML = '&times;';
    toastClose.addEventListener('click', () => {
        toast.classList.remove('show');
    });
    
    toastHeader.appendChild(toastTitle);
    toastHeader.appendChild(toastClose);
    
    const toastMessage = document.createElement('div');
    toastMessage.className = 'toast-message';
    toastMessage.textContent = message;
    
    // Clear previous content
    toast.innerHTML = '';
    
    // Add new content
    toast.appendChild(toastHeader);
    toast.appendChild(toastMessage);
    
    // Set toast class
    toast.className = 'toast';
    toast.classList.add(type);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
