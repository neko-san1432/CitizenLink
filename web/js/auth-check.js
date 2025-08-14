// Check if user is logged in
function checkAuth() {
  console.log('checkAuth() called');
  const user = JSON.parse(sessionStorage.getItem('user'));
  console.log('User from sessionStorage:', user);
  
  if (!user) {
    console.log('No user found, redirecting to login');
    // Redirect to login page
    window.location.href = '/login';
    return null;
  }
  
  // Check if on the correct platform
  const currentPath = window.location.pathname;
  console.log('Current path:', currentPath);
  console.log('User type:', user.type);
  
  if (user.type === 'citizen' && !currentPath.includes('/citizen/') && !currentPath.includes('/dashboard') && !currentPath.includes('/profile') && !currentPath.includes('/complaints') && !currentPath.includes('/submit-complaint') && !currentPath.includes('/analytics') && !currentPath.includes('/news')) {
    console.log('Citizen user on unauthorized path, redirecting to dashboard');
    window.location.href = '/dashboard';
    return null;
  }
  
  if (user.type === 'lgu' && !currentPath.includes('/lgu/') && !currentPath.includes('/admin-dashboard') && !currentPath.includes('/admin-complaints') && !currentPath.includes('/admin-heatmap') && !currentPath.includes('/admin-insights')) {
    console.log('LGU user on unauthorized path, redirecting to admin dashboard');
    window.location.href = '/admin-dashboard';
    return null;
  }
  
  console.log('User authorized for current path');
  return user;
}

// Update UI with user info
function updateUserInfo(user) {
  const userNameElements = document.querySelectorAll('#user-name, #header-user-name');
  
  userNameElements.forEach(element => {
    if (element) {
      element.textContent = user.name;
    }
  });
}

// Handle logout
function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Clear user from localStorage
      sessionStorage.removeItem('user');
      
      // Redirect to login page
      window.location.href = '/login';
    });
  }
}

// Handle sidebar toggle
function setupSidebar() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebar = document.querySelector('.sidebar');
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
    });
  }
  
  if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });
  }
}

// Handle user menu dropdown
function setupUserMenu() {
  const userMenuBtn = document.querySelector('.user-menu-btn');
  const userMenu = document.querySelector('.user-menu');
  
  if (userMenuBtn && userMenu) {
    userMenuBtn.addEventListener('click', () => {
      userMenu.classList.toggle('open');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target)) {
        userMenu.classList.remove('open');
      }
    });
  }
}

// Toast notification function
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

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  
  if (user) {
    updateUserInfo(user);
    setupLogout();
    setupSidebar();
    setupUserMenu();
  }
});