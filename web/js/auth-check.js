// Check if user is logged in
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (!user) {
    // Redirect to login page
    window.location.href = '../login.html';
    return null;
  }
  
  // Check if on the correct platform
  const currentPath = window.location.pathname;
  
  if (user.type === 'citizen' && !currentPath.includes('/citizen/')) {
    window.location.href = '../citizen/dashboard.html';
    return null;
  }
  
  if (user.type === 'lgu' && !currentPath.includes('/lgu/')) {
    window.location.href = '../lgu/dashboard.html';
    return null;
  }
  
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
      localStorage.removeItem('user');
      
      // Redirect to login page
      window.location.href = '../login.html';
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