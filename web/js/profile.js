document.addEventListener('DOMContentLoaded', () => {
    // Get user
    const user = checkAuth();
    if (!user) return;

    // Setup profile form
    setupProfileForm(user);

    // Setup cancel button
    document.getElementById('cancel-btn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
});

function setupProfileForm(user) {
    const profileForm = document.getElementById('profile-form');
    
    // Load user data
    document.getElementById('full-name').value = user.name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('address').value = user.address || '';
    
    // Handle form submission
    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = {
            name: document.getElementById('full-name').value,
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
            formData.currentPassword = currentPassword;
            formData.newPassword = newPassword;
        }
        
        // Get notification preferences
        formData.emailNotifications = document.getElementById('email-notifications').checked;
        formData.smsNotifications = document.getElementById('sms-notifications').checked;
        
        // Update user data in localStorage
        const updatedUser = { ...user, ...formData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        showToast('Profile updated successfully');
        
        // Clear password fields
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        
        // Update header user name
        document.getElementById('header-user-name').textContent = formData.name;
        document.getElementById('user-name').textContent = formData.name;
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